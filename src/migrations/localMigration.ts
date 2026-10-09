import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  runTransaction,
  writeBatch,
  type Firestore,
  type DocumentReference,
} from "firebase/firestore";
import {
  generateDataKey,
  importDataKey,
  decryptValue,
  isEncryptedValue,
} from "../utils/fieldCrypto";
import { encryptFields, SECURE_FIELDS } from "../utils/secureFields";

export const MIGRATION_COLLECTIONS = [
  "caregivers",
  "schedule",
  "payments",
  "paymentHistory",
] as const;
const GLOBAL_COLLECTIONS = [
  "users",
  "houses",
  "house_keys",
  "user_house_access",
  "house_invitations",
  "caregiver_links",
  "caregiver_access",
] as const;
type Row = { path: string; id: string; data: Record<string, any> };
export type MigrationInventory = Row[];
export type MigrationIssue = { path: string; code: string };
export type MigrationPlan = {
  houses: number;
  keysToCreate: number;
  recordsToEncrypt: number;
  plaintextFields: number;
  encryptedFields: number;
  accessRecordsToNormalize: number;
  legacyInvitesToExpire: number;
  deletedHouseIds: string[];
  deletedHouseRecords: number;
  issues: MigrationIssue[];
};
export class MigrationBlockedError extends Error {
  constructor(public readonly plan: MigrationPlan) {
    super("Migration preflight found records requiring repair; no migration writes started.");
    this.name = "MigrationBlockedError";
  }
}

export async function readMigrationInventory(db: Firestore): Promise<MigrationInventory> {
  const records = new Map<string, Row>();
  for (const name of GLOBAL_COLLECTIONS) {
    for (const snapshot of (await getDocs(collection(db, name))).docs)
      records.set(snapshot.ref.path, {
        path: snapshot.ref.path,
        id: snapshot.id,
        data: snapshot.data(),
      });
  }
  // Collection groups find old deleted houses' children too; parent-only scans miss them.
  for (const name of MIGRATION_COLLECTIONS) {
    for (const snapshot of (await getDocs(collectionGroup(db, name))).docs) {
      if (!new RegExp(`^houses/[^/]+/${name}/[^/]+$`).test(snapshot.ref.path)) continue;
      records.set(snapshot.ref.path, {
        path: snapshot.ref.path,
        id: snapshot.id,
        data: snapshot.data(),
      });
    }
  }
  return [...records.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function planMigration(
  inventory: MigrationInventory,
  options: { finishDeletedHouses?: boolean; authUserIds?: ReadonlySet<string> } = {},
): MigrationPlan {
  const rows = new Map(inventory.map((row) => [row.path, row]));
  const houses = new Map(
    inventory
      .filter((row) => row.path.startsWith("houses/") && row.path.split("/").length === 2)
      .map((row) => [row.id, row]),
  );
  const plan: MigrationPlan = {
    houses: houses.size,
    keysToCreate: 0,
    recordsToEncrypt: 0,
    plaintextFields: 0,
    encryptedFields: 0,
    accessRecordsToNormalize: 0,
    legacyInvitesToExpire: 0,
    deletedHouseIds: [],
    deletedHouseRecords: 0,
    issues: [],
  };
  const deleted = new Set<string>();
  const keys = new Map<string, Uint8Array>();
  for (const [houseId, house] of houses) {
    if (
      house.data.id !== houseId ||
      typeof house.data.createdBy !== "string" ||
      !house.data.createdBy
    )
      plan.issues.push({ path: house.path, code: "invalid-house-owner-or-id" });
    if (options.authUserIds && !options.authUserIds.has(house.data.createdBy))
      plan.issues.push({ path: house.path, code: "house-owner-not-in-auth" });
    const key = rows.get(`house_keys/${houseId}`);
    if (!key) plan.keysToCreate++;
    else {
      try {
        if (key.data.version !== 1) throw new Error("Unsupported key");
        keys.set(houseId, importDataKey(key.data.key));
      } catch {
        plan.issues.push({ path: key.path, code: "invalid-existing-key" });
      }
    }
  }
  const accessGroups = new Map<string, Row[]>();
  for (const row of inventory) {
    const parts = row.path.split("/");
    const houseId =
      parts[0] === "houses" && parts.length === 4
        ? parts[1]
        : parts[0] === "house_keys"
          ? row.id
          : [
                "user_house_access",
                "house_invitations",
                "caregiver_links",
                "caregiver_access",
              ].includes(parts[0])
            ? row.data.houseId
            : undefined;
    const requiresHouseReference =
      (parts[0] === "houses" && parts.length === 4) ||
      [
        "house_keys",
        "user_house_access",
        "house_invitations",
        "caregiver_links",
        "caregiver_access",
      ].includes(parts[0]);
    if (
      requiresHouseReference &&
      (typeof houseId !== "string" || !houseId || houseId.includes("/"))
    ) {
      plan.issues.push({ path: row.path, code: "invalid-house-reference" });
      continue;
    }
    if (houseId && !houses.has(houseId)) {
      deleted.add(houseId);
      plan.deletedHouseRecords++;
      continue;
    }
    if (
      parts.length === 4 &&
      houseId &&
      (parts[2] === "caregivers" || parts[2] === "paymentHistory")
    ) {
      const fields = SECURE_FIELDS[parts[2]];
      let plaintext = 0;
      for (const field of fields) {
        const value = row.data[field];
        if (value === undefined || value === null) continue;
        if (isEncryptedValue(value)) {
          plan.encryptedFields++;
          try {
            const key = keys.get(houseId);
            if (!key) throw new Error("Missing key");
            decryptValue(key, value, `${row.path}#${field}`);
          } catch {
            plan.issues.push({
              path: `${row.path}#${field}`,
              code: "ciphertext-not-readable-with-existing-key",
            });
          }
        } else if (
          typeof value === "string" ||
          (typeof value === "number" && Number.isFinite(value))
        ) {
          plaintext++;
          plan.plaintextFields++;
        } else
          plan.issues.push({ path: `${row.path}#${field}`, code: "invalid-sensitive-field-type" });
      }
      if (plaintext) plan.recordsToEncrypt++;
    }
    if (parts[0] === "user_house_access") {
      const data = row.data;
      if (
        typeof data.userId !== "string" ||
        !data.userId ||
        !["owner", "manager"].includes(data.role)
      ) {
        plan.issues.push({ path: row.path, code: "invalid-access-record" });
        continue;
      }
      if (options.authUserIds && !options.authUserIds.has(data.userId))
        plan.issues.push({ path: row.path, code: "access-user-not-in-auth" });
      if (data.role === "owner" && houses.get(data.houseId)?.data.createdBy !== data.userId)
        plan.issues.push({ path: row.path, code: "owner-grant-does-not-match-house-owner" });
      const canonical = `${data.houseId}_${data.userId}`;
      accessGroups.set(canonical, [...(accessGroups.get(canonical) ?? []), row]);
      if (row.id !== canonical) plan.accessRecordsToNormalize++;
    }
    if (parts[0] === "house_invitations" && row.data.status === "pending" && !row.data.expiresAtTs)
      plan.legacyInvitesToExpire++;
  }
  for (const group of accessGroups.values())
    if (new Set(group.map((row) => row.data.role)).size > 1)
      plan.issues.push({ path: group[0].path, code: "conflicting-access-roles" });
  for (const [houseId, house] of houses) {
    if (
      !inventory.some(
        (row) =>
          row.path.startsWith("user_house_access/") &&
          row.data.houseId === houseId &&
          row.data.userId === house.data.createdBy &&
          row.data.role === "owner",
      )
    )
      plan.issues.push({ path: house.path, code: "missing-owner-access-record" });
  }
  plan.deletedHouseIds = [...deleted].sort();
  if (deleted.size && !options.finishDeletedHouses)
    for (const houseId of deleted)
      plan.issues.push({ path: `houses/${houseId}`, code: "deleted-house-cleanup-required" });
  return plan;
}

async function deleteRefs(db: Firestore, refs: DocumentReference[]) {
  for (let start = 0; start < refs.length; start += 400) {
    const batch = writeBatch(db);
    refs.slice(start, start + 400).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export async function applyMigration(
  db: Firestore,
  inventory: MigrationInventory,
  options: {
    finishDeletedHouses?: boolean;
    authUserIds?: ReadonlySet<string>;
    // Test hook deliberately interrupts between atomic operations; resume uses the DB.
    afterOperation?: (name: string) => Promise<void>;
  } = {},
): Promise<MigrationPlan> {
  const plan = planMigration(inventory, options);
  if (plan.issues.length) throw new MigrationBlockedError(plan);
  const checkpoint = async (name: string) => options.afterOperation?.(name);
  const houses = inventory.filter(
    (row) => row.path.startsWith("houses/") && row.path.split("/").length === 2,
  );
  for (const house of houses) {
    const keyRef = doc(db, "house_keys", house.id);
    const encoded = await runTransaction(db, async (transaction) => {
      const [currentHouse, currentKey] = await Promise.all([
        transaction.get(doc(db, house.path)),
        transaction.get(keyRef),
      ]);
      if (!currentHouse.exists()) throw new Error(`House changed during migration: ${house.id}`);
      if (currentKey.exists()) {
        const data = currentKey.data();
        if (data.version !== 1) throw new Error("Unsupported key version");
        importDataKey(data.key);
        return data.key as string;
      }
      const key = generateDataKey();
      transaction.set(keyRef, {
        key,
        version: 1,
        createdAt: new Date().toISOString(),
        createdBy: currentHouse.data().createdBy,
      });
      return key;
    });
    const key = importDataKey(encoded);
    await checkpoint("house-key");
    const documents = inventory.filter(
      (row) =>
        row.path.startsWith(`houses/${house.id}/`) &&
        ["caregivers", "paymentHistory"].includes(row.path.split("/")[2]),
    );
    for (const row of documents) {
      const fields = SECURE_FIELDS[row.path.split("/")[2] as keyof typeof SECURE_FIELDS];
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, row.path);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error(`Document changed during migration: ${row.path}`);
        const data = snapshot.data();
        const plain: Record<string, string | number> = {};
        for (const field of fields) {
          const value = data[field];
          if (value === undefined || value === null) continue;
          if (isEncryptedValue(value)) decryptValue(key, value, `${row.path}#${field}`);
          else if (
            typeof value === "string" ||
            (typeof value === "number" && Number.isFinite(value))
          )
            plain[field] = value;
          else throw new Error(`Invalid field changed during migration: ${row.path}#${field}`);
        }
        if (Object.keys(plain).length)
          transaction.update(reference, encryptFields(plain, fields, key, row.path));
      });
      await checkpoint("encrypted-record");
    }
  }
  const groups = new Map<string, Row[]>();
  for (const row of inventory.filter(
    (row) =>
      row.path.startsWith("user_house_access/") && !plan.deletedHouseIds.includes(row.data.houseId),
  )) {
    const id = `${row.data.houseId}_${row.data.userId}`;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  for (const [id, group] of groups) {
    const canonical = doc(db, "user_house_access", id);
    await runTransaction(db, async (transaction) => {
      const source = group.find((row) => row.id === id) ?? group[0];
      const [current, original, house] = await Promise.all([
        transaction.get(canonical),
        transaction.get(doc(db, source.path)),
        transaction.get(doc(db, "houses", source.data.houseId)),
      ]);
      if (!house.exists()) throw new Error("House disappeared during access migration");
      const data = current.exists() ? current.data() : original.exists() ? original.data() : null;
      if (
        !data ||
        data.userId !== source.data.userId ||
        data.houseId !== source.data.houseId ||
        data.role !== source.data.role
      )
        throw new Error("Access changed during migration");
      if (data.role === "owner" && house.data().createdBy !== data.userId)
        throw new Error("Owner grant changed during migration");
      if (!current.exists())
        transaction.set(canonical, {
          userId: data.userId,
          houseId: data.houseId,
          role: data.role,
          ...(data.addedAt !== undefined && { addedAt: data.addedAt }),
        });
    });
    await deleteRefs(
      db,
      group.filter((row) => row.id !== id).map((row) => doc(db, row.path)),
    );
    await checkpoint("normalized-access");
  }
  for (const row of inventory.filter(
    (row) =>
      row.path.startsWith("house_invitations/") &&
      !plan.deletedHouseIds.includes(row.data.houseId) &&
      row.data.status === "pending" &&
      !row.data.expiresAtTs,
  )) {
    await runTransaction(db, async (transaction) => {
      const reference = doc(db, row.path);
      const current = await transaction.get(reference);
      if (current.exists() && current.data().status === "pending" && !current.data().expiresAtTs)
        transaction.update(reference, { status: "expired" });
    });
    await checkpoint("expired-legacy-invitation");
  }
  if (options.finishDeletedHouses)
    for (const houseId of plan.deletedHouseIds) {
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(doc(db, "houses", houseId))).exists())
          throw new Error("Deleted house was recreated; cleanup refused");
      });
      const related = inventory.filter(
        (row) =>
          row.path.startsWith(`houses/${houseId}/`) ||
          row.path === `house_keys/${houseId}` ||
          ([
            "user_house_access",
            "house_invitations",
            "caregiver_links",
            "caregiver_access",
          ].includes(row.path.split("/")[0]) &&
            row.data.houseId === houseId),
      );
      await deleteRefs(
        db,
        related.map((row) => doc(db, row.path)),
      );
      await checkpoint("finished-deleted-house");
    }
  const verified = planMigration(await readMigrationInventory(db), {
    ...options,
    finishDeletedHouses: false,
  });
  if (
    verified.issues.length ||
    verified.plaintextFields ||
    verified.accessRecordsToNormalize ||
    verified.legacyInvitesToExpire ||
    verified.keysToCreate
  )
    throw new Error(
      "Migration verification incomplete; keep clients frozen and rerun after repair",
    );
  return verified;
}
