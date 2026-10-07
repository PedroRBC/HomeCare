import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, Bytes, GeoPoint, DocumentReference, type Firestore } from "firebase/firestore";
import {
  applyMigration,
  planMigration,
  readMigrationInventory,
  MigrationBlockedError,
  type MigrationPlan,
} from "./localMigration";

function argumentsOf(args: string[]) {
  let project = "demo-homecare-migration",
    mode: "dry-run" | "apply" | "verify" = "dry-run",
    finishDeletedHouses = false,
    backup: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--project") {
      project = args[++index];
      if (!project) throw new Error("--project needs a value");
    } else if (arg === "--backup") {
      backup = args[++index];
      if (!backup) throw new Error("--backup needs a path");
    } else if (arg === "--apply" || arg === "--verify") {
      if (mode !== "dry-run") throw new Error("Choose one mode");
      mode = arg === "--apply" ? "apply" : "verify";
    } else if (arg === "--dry-run") {
      if (mode !== "dry-run") throw new Error("Choose one mode");
    } else if (arg === "--finish-deleted-houses") finishDeletedHouses = true;
    else if (arg === "--help") return null;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { project, mode, finishDeletedHouses, backup };
}
function localEndpoint(value: string | undefined, name: string) {
  if (!value || !/^(127\.0\.0\.1|localhost):\d+$/.test(value))
    throw new Error(`${name} must identify a running local emulator (localhost:port)`);
  return value;
}
function backupValue(value: any): any {
  if (value instanceof Timestamp)
    return { type: "firestore-timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof Bytes) return { type: "firestore-bytes", base64: value.toBase64() };
  if (value instanceof GeoPoint)
    return { type: "firestore-geopoint", latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { type: "firestore-reference", path: value.path };
  if (Array.isArray(value)) return value.map(backupValue);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, backupValue(item)]));
  if (typeof value === "number" && !Number.isFinite(value))
    return { type: "firestore-special-number", value: String(value) };
  return value;
}

function requireDataset(plan: MigrationPlan) {
  if (!plan.houses && !plan.deletedHouseRecords)
    plan.issues.push({ path: "houses", code: "empty-or-wrong-emulator-dataset" });
  if (plan.issues.length) throw new MigrationBlockedError(plan);
}

async function main() {
  const options = argumentsOf(process.argv.slice(2));
  if (!options) {
    console.log(
      "bun run migrate:local -- [--dry-run | --apply | --verify] [--finish-deleted-houses] [--project demo-id] [--backup file]",
    );
    return;
  }
  if (!/^demo-[a-z0-9-]+$/.test(options.project))
    throw new Error("This migration command is local-only and requires a demo-* project");
  const firestoreHost = localEndpoint(
    process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8180",
    "FIRESTORE_EMULATOR_HOST",
  );
  const authHost = localEndpoint(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9199",
    "FIREBASE_AUTH_EMULATOR_HOST",
  );
  const [host, port] = firestoreHost.split(":");
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const finalRules = readFileSync(resolve(projectRoot, "firestore.rules"), "utf8");
  const freezeRules =
    "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }";
  const setRules = async (content: string) => {
    const response = await fetch(
      `http://${firestoreHost}/emulator/v1/projects/${options.project}:securityRules`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: { files: [{ name: "firestore.rules", content }] } }),
      },
    );
    if (!response.ok) throw new Error(`Could not set local emulator rules (${response.status})`);
  };
  const authUserIds = new Set<string>();
  let page = "";
  do {
    const url = new URL(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${options.project}/accounts:batchGet`,
    );
    url.searchParams.set("maxResults", "1000");
    if (page) url.searchParams.set("nextPageToken", page);
    const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
    if (!response.ok) throw new Error(`Local Auth inventory failed (${response.status})`);
    const data: any = await response.json();
    for (const user of data.users ?? []) authUserIds.add(user.localId);
    page = data.nextPageToken ?? "";
  } while (page);
  const env = await initializeTestEnvironment({
    projectId: options.project,
    firestore: { host, port: Number(port) },
  });
  let frozen = false;
  try {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      let inventory = await readMigrationInventory(db);
      const settings = { finishDeletedHouses: options.finishDeletedHouses, authUserIds };
      let plan = planMigration(inventory, settings);
      console.log(JSON.stringify({ mode: options.mode, project: options.project, plan }, null, 2));
      requireDataset(plan);
      if (options.mode === "dry-run") return;
      if (options.mode === "verify") {
        if (
          plan.plaintextFields ||
          plan.accessRecordsToNormalize ||
          plan.legacyInvitesToExpire ||
          plan.keysToCreate ||
          plan.deletedHouseIds.length
        )
          throw new Error("Verification incomplete: run the apply mode first");
        console.log(
          "VERIFIED: all active houses use readable ciphertext and canonical access records.",
        );
        return;
      }
      // Freeze first, then take the actual backup/inventory. A stale dry-run cannot
      // authorize applying over changes that arrived immediately before the freeze.
      if (options.backup && existsSync(resolve(options.backup)))
        throw new Error(
          "Backup path already exists; choose a new file. Clients were not frozen by this run.",
        );
      await setRules(freezeRules);
      frozen = true;
      inventory = await readMigrationInventory(db);
      plan = planMigration(inventory, settings);
      requireDataset(plan);
      const changesNeeded = !!(
        plan.keysToCreate ||
        plan.recordsToEncrypt ||
        plan.accessRecordsToNormalize ||
        plan.legacyInvitesToExpire ||
        plan.deletedHouseRecords
      );
      const backup = resolve(
        options.backup ??
          resolve(
            projectRoot,
            "reports/migrations",
            `${options.project}-${Date.now()}.backup.json`,
          ),
      );
      mkdirSync(dirname(backup), { recursive: true, mode: 0o700 });
      writeFileSync(
        backup,
        JSON.stringify(
          {
            format: "homecare-local-migration-backup",
            formatVersion: 1,
            project: options.project,
            createdAt: new Date().toISOString(),
            records: inventory.map((row) => ({ ...row, data: backupValue(row.data) })),
          },
          null,
          2,
        ),
        { mode: 0o600, flag: "wx" },
      );
      console.log(`Backup saved: ${backup}`);
      const verified = await applyMigration(db, inventory, settings);
      await setRules(finalRules);
      frozen = false;
      console.log(
        JSON.stringify(
          {
            status: changesNeeded ? "MIGRATED_AND_VERIFIED" : "ALREADY_MIGRATED_AND_VERIFIED",
            project: options.project,
            verified,
          },
          null,
          2,
        ),
      );
    });
  } finally {
    await env.cleanup();
    if (frozen)
      console.error(
        "Migration did not complete; local clients remain frozen. Repair the reported issue and rerun --apply to resume. The backup includes keys and personal data; keep it local.",
      );
  }
}

main().catch((error) => {
  console.error(
    error instanceof MigrationBlockedError
      ? JSON.stringify({ status: "BLOCKED", issues: error.plan.issues }, null, 2)
      : String(error),
  );
  process.exitCode = 1;
});
