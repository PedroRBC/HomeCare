import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc, writeBatch, type Firestore } from "firebase/firestore";
import {
  applyMigration,
  planMigration,
  readMigrationInventory,
  MigrationBlockedError,
} from "../migrations/localMigration";
import { decryptValue, importDataKey, generateDataKey, encryptValue } from "../utils/fieldCrypto";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator && process.env.REQUIRE_FIRESTORE_EMULATOR)
  throw new Error("Local migration tests require the Firestore emulator");
let env: RulesTestEnvironment;
const validAuth = new Set(["owner", "manager"]);

async function seed(db: Firestore) {
  const batch = writeBatch(db);
  batch.set(doc(db, "houses/h1"), {
    id: "h1",
    createdBy: "owner",
    name: "Old house",
    managers: [
      { userId: "owner", role: "owner" },
      { userId: "manager", role: "manager" },
    ],
  });
  batch.set(doc(db, "users/owner"), {
    id: "owner",
    displayName: "Owner",
    consents: { analytics: { granted: false } },
  });
  batch.set(doc(db, "user_house_access/old-owner"), {
    userId: "owner",
    houseId: "h1",
    role: "owner",
    addedAt: "old",
  });
  batch.set(doc(db, "user_house_access/old-manager"), {
    userId: "manager",
    houseId: "h1",
    role: "manager",
    addedAt: "old",
  });
  batch.set(doc(db, "houses/h1/caregivers/c1"), {
    id: "c1",
    name: "Ana 🌙",
    email: "ana@example.com",
    amount: 332,
    dayAmount: 153.25,
    nightAmount: 178.75,
    frequency: "Semanal",
    disabled: false,
  });
  batch.set(doc(db, "houses/h1/paymentHistory/p1"), {
    id: "p1",
    caregiverName: "Ana 🌙",
    managerName: "Owner",
    amount: 153.25,
    description: "Old payment",
  });
  batch.set(doc(db, "houses/h1/schedule/2026-10-05"), {
    day: ["c1"],
    night: [],
    nightExtra: ["c1"],
  });
  batch.set(doc(db, "houses/h1/payments/old"), { caregiverId: "c1", paymentKey: "old-key" });
  batch.set(doc(db, "house_invitations/old"), {
    houseId: "h1",
    invitedBy: "owner",
    invitedEmail: "guest@example.com",
    status: "pending",
    expiresAt: "2026-10-14T00:00:00.000Z",
  });
  await batch.commit();
}
const settings = { authUserIds: validAuth };

(emulator ? describe : describe.skip)("local migration command engine", () => {
  before(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-homecare-local-migrator",
      firestore: {
        host,
        port: Number(port),
        rules:
          "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }",
      },
    });
  });
  beforeEach(() => env.clearFirestore());
  after(() => env?.cleanup());

  test("dry-run lists changes without changing data or generating a house key", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      const beforeData = await readMigrationInventory(db);
      const plan = planMigration(beforeData, settings);
      assert.deepEqual(plan.issues, []);
      assert.equal(plan.plaintextFields, 9);
      assert.equal(plan.keysToCreate, 1);
      assert.equal(plan.accessRecordsToNormalize, 2);
      assert.equal(plan.legacyInvitesToExpire, 1);
      assert.deepEqual(await readMigrationInventory(db), beforeData);
    });
  });

  test("apply encrypts all unopened-house data, normalizes roles, expires unsafe invites and is idempotent", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      const original = await readMigrationInventory(db);
      const verified = await applyMigration(db, original, settings);
      assert.equal(verified.plaintextFields, 0);
      assert.equal(verified.encryptedFields, 9);
      const migrated = await readMigrationInventory(db);
      const key = importDataKey(migrated.find((row) => row.path === "house_keys/h1")!.data.key);
      const caregiver = migrated.find((row) => row.path === "houses/h1/caregivers/c1")!;
      assert.equal(decryptValue(key, caregiver.data.name, `${caregiver.path}#name`), "Ana 🌙");
      assert.equal(
        decryptValue(key, caregiver.data.dayAmount, `${caregiver.path}#dayAmount`),
        153.25,
      );
      assert.deepEqual(
        migrated.find((row) => row.path === "houses/h1/schedule/2026-10-05")!.data,
        original.find((row) => row.path === "houses/h1/schedule/2026-10-05")!.data,
      );
      assert.deepEqual(
        migrated.find((row) => row.path === "houses/h1/payments/old")!.data,
        original.find((row) => row.path === "houses/h1/payments/old")!.data,
      );
      assert.deepEqual(
        migrated.find((row) => row.path === "users/owner")!.data,
        original.find((row) => row.path === "users/owner")!.data,
      );
      assert.equal(
        migrated.find((row) => row.path === "user_house_access/h1_manager")!.data.role,
        "manager",
      );
      assert.equal(
        migrated.find((row) => row.path === "house_invitations/old")!.data.status,
        "expired",
      );
      await applyMigration(db, migrated, settings);
      assert.deepEqual(await readMigrationInventory(db), migrated);
    });
  });

  test("interrupted apply resumes with the same existing key and never double-encrypts finished fields", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      await assert.rejects(
        applyMigration(db, await readMigrationInventory(db), {
          ...settings,
          afterOperation: async (name) => {
            if (name === "encrypted-record") throw new Error("Simulated process interruption");
          },
        }),
        /Simulated process interruption/,
      );
      const partial = await readMigrationInventory(db);
      const existing = partial.find((row) => row.path === "house_keys/h1")!.data.key;
      const finished = partial.find((row) => row.path === "houses/h1/caregivers/c1")!.data.name;
      await applyMigration(db, partial, settings);
      const completed = await readMigrationInventory(db);
      assert.equal(completed.find((row) => row.path === "house_keys/h1")!.data.key, existing);
      assert.equal(
        completed.find((row) => row.path === "houses/h1/caregivers/c1")!.data.name,
        finished,
      );
    });
  });

  test("conflicting roles and wrong owner claims fail preflight before any writes", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      await setDoc(doc(db, "user_house_access/bad-manager"), {
        userId: "manager",
        houseId: "h1",
        role: "owner",
      });
      const original = await readMigrationInventory(db);
      const plan = planMigration(original, settings);
      assert.ok(plan.issues.some((issue) => issue.code === "conflicting-access-roles"));
      assert.ok(
        plan.issues.some((issue) => issue.code === "owner-grant-does-not-match-house-owner"),
      );
      await assert.rejects(applyMigration(db, original, settings), MigrationBlockedError);
      assert.deepEqual(await readMigrationInventory(db), original);
    });
  });

  test("deleted-house children are found without a parent and cleanup preserves active houses", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      await setDoc(doc(db, "houses/deleted/caregivers/orphan"), { name: "Orphan", amount: 100 });
      await setDoc(doc(db, "user_house_access/orphan"), {
        userId: "owner",
        houseId: "deleted",
        role: "owner",
      });
      const original = await readMigrationInventory(db);
      assert.deepEqual(planMigration(original, settings).deletedHouseIds, ["deleted"]);
      await assert.rejects(applyMigration(db, original, settings), MigrationBlockedError);
      await applyMigration(db, original, { ...settings, finishDeletedHouses: true });
      const completed = await readMigrationInventory(db);
      assert.ok(completed.some((row) => row.path === "houses/h1"));
      assert.equal(
        completed.some(
          (row) =>
            row.path.startsWith("houses/deleted/") || row.path === "user_house_access/orphan",
        ),
        false,
      );
    });
  });

  test("missing house references fail preflight before converting any active data", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      await setDoc(doc(db, "user_house_access/missing-house"), {
        userId: "manager",
        role: "manager",
      });
      await setDoc(doc(db, "caregiver_links/missing-house"), { email: "ana@example.com" });
      const original = await readMigrationInventory(db);
      const plan = planMigration(original, settings);
      for (const path of ["user_house_access/missing-house", "caregiver_links/missing-house"])
        assert.ok(
          plan.issues.some(
            (issue) => issue.path === path && issue.code === "invalid-house-reference",
          ),
        );
      await assert.rejects(applyMigration(db, original, settings), MigrationBlockedError);
      assert.deepEqual(await readMigrationInventory(db), original);
    });
  });

  test("missing or wrong keys refuse recovery rather than generating a replacement over ciphertext", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      const encoded = generateDataKey();
      await setDoc(doc(db, "houses/h1/caregivers/c1"), {
        name: encryptValue(importDataKey(encoded), "Ana", "houses/h1/caregivers/c1#name"),
        amount: 200,
      });
      const missing = await readMigrationInventory(db);
      await assert.rejects(applyMigration(db, missing, settings), MigrationBlockedError);
      assert.equal((await getDocs(collection(db, "house_keys"))).size, 0);
      await setDoc(doc(db, "house_keys/h1"), { key: generateDataKey(), version: 1 });
      const wrong = await readMigrationInventory(db);
      await assert.rejects(applyMigration(db, wrong, settings), MigrationBlockedError);
      assert.deepEqual(await readMigrationInventory(db), wrong);
    });
  });

  test("520 duplicate legacy grants normalize using bounded writes", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await seed(db);
      for (let start = 0; start < 520; start += 200) {
        const batch = writeBatch(db);
        for (let index = start; index < Math.min(start + 200, 520); index++)
          batch.set(doc(db, "user_house_access", `copy-${index}`), {
            houseId: "h1",
            userId: "manager",
            role: "manager",
          });
        await batch.commit();
      }
      await applyMigration(db, await readMigrationInventory(db), settings);
      assert.equal((await getDocs(collection(db, "user_house_access"))).size, 2);
    });
  });
});
