import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  closeSync,
  fstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDocFromServer, setDoc, type Firestore } from "firebase/firestore";
import { readMigrationInventory } from "../migrations/localMigration";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if ((!firestoreHost || !authHost) && process.env.REQUIRE_AUTH_EMULATOR)
  throw new Error("Migration CLI tests require both local Auth and Firestore emulators");
const project = "demo-homecare-migration-cli-tests";
const openRules =
  "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }";
let env: RulesTestEnvironment;
let owner: string;
let directory: string;

function run(args: string[], overrides: Record<string, string> = {}) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["src/migrations/cli.ts", "--project", project, ...args],
      {
        env: { ...process.env, ...overrides },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, "houses/h1"), { id: "h1", createdBy: owner, name: "Legacy" });
    await setDoc(doc(db, "user_house_access/legacy"), {
      userId: owner,
      houseId: "h1",
      role: "owner",
    });
    await setDoc(doc(db, "houses/h1/caregivers/c1"), { name: "Ana", amount: 153.25 });
  });
}

(firestoreHost && authHost ? describe : describe.skip)("local migration CLI", () => {
  before(async () => {
    directory = mkdtempSync(join(tmpdir(), "homecare-migration-cli-"));
    const response = await fetch(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
        body: JSON.stringify({
          email: `owner-${Date.now()}@example.test`,
          password: "Test-only-123!",
          targetProjectId: project,
          returnSecureToken: true,
        }),
      },
    );
    const account = (await response.json()) as { localId?: string };
    assert.ok(account.localId, "Local Auth fixture failed");
    owner = account.localId;
    const [host, port] = firestoreHost!.split(":");
    env = await initializeTestEnvironment({
      projectId: project,
      firestore: { host, port: Number(port) },
    });
  });
  beforeEach(async () => {
    await env.clearFirestore();
    const response = await fetch(
      `http://${firestoreHost}/emulator/v1/projects/${project}:securityRules`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: { files: [{ name: "firestore.rules", content: openRules }] },
        }),
      },
    );
    assert.ok(response.ok);
  });
  after(async () => {
    await env?.cleanup();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  test("refuses live projects and non-loopback endpoints", async () => {
    assert.match((await run(["--project", "homecare-live"])).output, /requires a demo-\* project/);
    const result = await run([], { FIRESTORE_EMULATOR_HOST: "example.com:8180" });
    assert.equal(result.code, 1);
    assert.match(result.output, /running local emulator/);
  });

  test("empty or wrong datasets fail every mode without claiming migration success", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, "users/only-profile"), {
        id: "only-profile",
      });
      for (const mode of ["--dry-run", "--apply", "--verify"]) {
        const result = await run([mode]);
        assert.equal(result.code, 1, result.output);
        assert.match(result.output, /empty-or-wrong-emulator-dataset/);
        assert.doesNotMatch(result.output, /MIGRATED_AND_VERIFIED/);
      }
      assert.equal(
        (await readMigrationInventory(context.firestore() as unknown as Firestore)).length,
        1,
      );
    });
  });

  test("dry-run is read-only; apply saves a private original backup, installs rules, verifies and reruns", async () => {
    await seed();
    const dry = await run(["--dry-run"]);
    assert.equal(dry.code, 0, dry.output);
    const original = (
      await getDocFromServer(
        doc(
          env.unauthenticatedContext().firestore() as unknown as Firestore,
          "houses/h1/caregivers/c1",
        ),
      )
    ).data();
    assert.equal(original!.name, "Ana");
    const backup = join(directory, "original.json");
    const applied = await run(["--apply", "--backup", backup]);
    assert.equal(applied.code, 0, applied.output);
    assert.match(applied.output, /"status": "MIGRATED_AND_VERIFIED"/);
    const descriptor = openSync(backup, "r");
    try {
      assert.equal(fstatSync(descriptor).mode & 0o777, 0o600);
      const saved = JSON.parse(readFileSync(descriptor, "utf8"));
      assert.deepEqual(
        saved.records.find((row: { path: string }) => row.path === "houses/h1/caregivers/c1").data,
        original,
      );
    } finally {
      closeSync(descriptor);
    }
    await assert.rejects(
      getDocFromServer(
        doc(env.unauthenticatedContext().firestore() as unknown as Firestore, "houses/h1"),
      ),
      /permission/i,
    );
    assert.equal((await run(["--verify"])).code, 0);
    const again = await run(["--apply", "--backup", join(directory, "rerun.json")]);
    assert.equal(again.code, 0, again.output);
    assert.match(again.output, /ALREADY_MIGRATED_AND_VERIFIED/);
  });

  test("backup collision leaves rules alone; failed backup after freeze denies clients until successful retry", async () => {
    await seed();
    const existing = join(directory, "existing-file");
    writeFileSync(existing, "sentinel");
    const collision = await run(["--apply", "--backup", existing]);
    assert.equal(collision.code, 1);
    assert.match(collision.output, /Backup path already exists/);
    assert.equal(readFileSync(existing, "utf8"), "sentinel");
    const client = env.unauthenticatedContext().firestore() as unknown as Firestore;
    assert.equal((await getDocFromServer(doc(client, "houses/h1"))).exists(), true);
    const failed = await run(["--apply", "--backup", join(existing, "impossible.json")]);
    assert.equal(failed.code, 1);
    assert.match(failed.output, /clients remain frozen/);
    await assert.rejects(getDocFromServer(doc(client, "houses/h1")), /permission/i);
    const resumed = await run(["--apply", "--backup", join(directory, "resume.json")]);
    assert.equal(resumed.code, 0, resumed.output);
    assert.equal((await run(["--verify"])).code, 0);
    const ownerDb = env.authenticatedContext(owner).firestore() as unknown as Firestore;
    assert.equal((await getDocFromServer(doc(ownerDb, "houses/h1"))).exists(), true);
  });
});
