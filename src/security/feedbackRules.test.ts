import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator && process.env.REQUIRE_FIRESTORE_EMULATOR)
  throw new Error("Feedback rules tests require FIRESTORE_EMULATOR_HOST");
let env: RulesTestEnvironment;
const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const report = (reporterUid = "author") => ({
  schemaVersion: 1,
  reporterUid,
  type: "bug",
  title: "Keyboard covers button",
  description: "The keyboard hides the save button on the form.",
  steps: "Open the form",
  expected: "Visible button",
  actual: "Hidden button",
  context: {
    appVersion: null,
    appBuild: null,
    platform: "android",
    osVersion: "15",
    language: "pt",
  },
  status: "open",
  issueUrl: null,
  reviewerUid: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
const triage = () => ({ status: "in_review", reviewerUid: "staff", updatedAt: serverTimestamp() });
async function grant(enabled = true) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, "staff_access", "staff"), {
      enabled,
    });
  });
}

(emulator ? describe : describe.skip)("private feedback rules", () => {
  before(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-homecare-feedback",
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync(process.env.FIRESTORE_RULES_FILE ?? "firestore.rules", "utf8"),
      },
    });
  });
  beforeEach(() => env.clearFirestore());
  after(() => env?.cleanup());

  test("signed-in users can submit without a house or an email", async () => {
    await assertSucceeds(setDoc(doc(as("author"), "feedback_reports", "r1"), report()));
    await assertSucceeds(getDoc(doc(as("author"), "feedback_reports", "r1")));
  });
  test("a feedback report can omit bug details", async () => {
    await assertSucceeds(
      setDoc(doc(as("author"), "feedback_reports", "r1"), {
        ...report(),
        type: "feedback",
        steps: "",
        expected: "",
        actual: "",
      }),
    );
    await assertFails(
      setDoc(doc(as("author"), "feedback_reports", "r2"), { ...report(), type: "feedback" }),
    );
  });
  test("anonymous access, including nonexistent documents, is denied", async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(setDoc(doc(db, "feedback_reports", "r1"), report()));
    await assertFails(getDoc(doc(db, "feedback_reports", "missing")));
    await assertFails(getDocs(query(collection(db, "feedback_reports"), limit(50))));
  });
  test("transactions can check unused IDs; retries cannot modify submitted content", async () => {
    const db = as("author");
    const ref = doc(db, "feedback_reports", "r1");
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists()) tx.set(ref, report());
      }),
    );
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        await tx.get(ref);
      }),
    );
    await assertFails(setDoc(ref, { ...report(), title: "Another submission" }));
  });
  test("authors cannot spoof identity, timestamps, initial triage or add arbitrary data", async () => {
    const invalid = [
      { reporterUid: "victim" },
      { schemaVersion: 2 },
      { type: "other" },
      { createdAt: Timestamp.fromMillis(0) },
      { updatedAt: Timestamp.fromMillis(0) },
      { status: "resolved" },
      { reviewerUid: "staff" },
      { issueUrl: "https://github.com/a/b/issues/1" },
      { token: "secret" },
      { context: { ...report().context, email: "private@example.com" } },
      { context: { ...report().context, platform: 5 } },
      { context: { ...report().context, language: "a".repeat(31) } },
      { context: { ...report().context, appBuild: "a".repeat(101) } },
    ];
    for (const [index, change] of invalid.entries())
      await assertFails(
        setDoc(doc(as("author"), "feedback_reports", `r${index}`), { ...report(), ...change }),
      );
    const { actual: _actual, ...missingField } = report();
    await assertFails(setDoc(doc(as("author"), "feedback_reports", "missing"), missingField));
  });
  test("blank and oversized text is rejected, including optional bug fields", async () => {
    for (const [index, change] of [
      { title: "  \n  " },
      { title: "ab" },
      { title: "x".repeat(121) },
      { description: " ".repeat(20) },
      { description: "x".repeat(5001) },
      { steps: "x".repeat(3001) },
      { expected: "x".repeat(2001) },
      { actual: "x".repeat(2001) },
    ].entries()) {
      await assertFails(
        setDoc(doc(as("author"), "feedback_reports", `r${index}`), { ...report(), ...change }),
      );
    }
  });
  test("authors can query only their own reports and must bound the query", async () => {
    await setDoc(doc(as("author"), "feedback_reports", "r1"), report());
    const db = as("author");
    await assertSucceeds(
      getDocs(
        query(collection(db, "feedback_reports"), where("reporterUid", "==", "author"), limit(50)),
      ),
    );
    await assertFails(getDocs(query(collection(db, "feedback_reports"), limit(50))));
    await assertFails(
      getDocs(
        query(collection(db, "feedback_reports"), where("reporterUid", "==", "victim"), limit(50)),
      ),
    );
    await assertFails(
      getDocs(query(collection(db, "feedback_reports"), where("reporterUid", "==", "author"))),
    );
    await assertFails(
      getDocs(
        query(collection(db, "feedback_reports"), where("reporterUid", "==", "author"), limit(51)),
      ),
    );
  });
  test("other users cannot read, edit, or delete an author's report", async () => {
    await setDoc(doc(as("author"), "feedback_reports", "r1"), report());
    const ref = doc(as("stranger"), "feedback_reports", "r1");
    await assertFails(getDoc(ref));
    await assertFails(updateDoc(ref, triage()));
    await assertFails(deleteDoc(ref));
    await assertFails(
      updateDoc(doc(as("author"), "feedback_reports", "r1"), {
        status: "resolved",
        reviewerUid: "author",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(as("author"), "feedback_reports", "r1")));
  });
  test("profile self-promotion and house ownership do not grant staff access", async () => {
    await setDoc(doc(as("author"), "feedback_reports", "r1"), report());
    await setDoc(doc(as("owner"), "users", "owner"), { id: "owner", isStaff: true, enabled: true });
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore() as unknown as Firestore, "user_house_access", "house_owner"),
        { userId: "owner", houseId: "house", role: "owner" },
      );
    });
    await assertFails(getDoc(doc(as("owner"), "feedback_reports", "r1")));
    await assertFails(setDoc(doc(as("owner"), "staff_access", "owner"), { enabled: true }));
    const db = as("owner");
    const batch = writeBatch(db);
    batch.set(doc(db, "staff_access", "owner"), { enabled: true });
    batch.update(doc(db, "feedback_reports", "r1"), { ...triage(), reviewerUid: "owner" });
    await assertFails(batch.commit());
  });
  test("staff grants are readable only by the matching account and never client-writable", async () => {
    await grant();
    const db = as("staff");
    await assertSucceeds(getDoc(doc(db, "staff_access", "staff")));
    await assertFails(getDoc(doc(as("author"), "staff_access", "staff")));
    await assertFails(getDocs(collection(db, "staff_access")));
    await assertFails(setDoc(doc(db, "staff_access", "new-staff"), { enabled: true }));
    await assertFails(updateDoc(doc(db, "staff_access", "staff"), { enabled: false }));
    await assertFails(deleteDoc(doc(db, "staff_access", "staff")));
  });
  test("approved staff read bounded lists and change only triage fields", async () => {
    await setDoc(doc(as("author"), "feedback_reports", "r1"), report());
    await grant();
    const db = as("staff");
    const ref = doc(db, "feedback_reports", "r1");
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(query(collection(db, "feedback_reports"), limit(50))));
    await assertFails(getDocs(collection(db, "feedback_reports")));
    await assertSucceeds(
      updateDoc(ref, { ...triage(), issueUrl: "https://github.com/pedrorbc/homecare/issues/12" }),
    );
    for (const change of [
      { title: "Rewritten title" },
      { description: "Rewritten description" },
      { reporterUid: "staff" },
      { context: { ...report().context, platform: "ios" } },
      { createdAt: serverTimestamp() },
      { privateNote: "not allowed" },
      { reviewerUid: "someone-else" },
      { updatedAt: Timestamp.fromMillis(0) },
      { status: "other" },
    ]) {
      await assertFails(updateDoc(ref, { ...triage(), ...change }));
    }
    await assertSucceeds(deleteDoc(ref));
  });
  test("malicious and noncanonical issue links are rejected", async () => {
    await setDoc(doc(as("author"), "feedback_reports", "r1"), report());
    await grant();
    for (const issueUrl of [
      "javascript:alert(1)",
      "https://github.com.evil.test/a/b/issues/1",
      "https://github.com/a/b/pull/1",
      "https://github.com/a/b/issues/0",
      "https://github.com/a/b/issues/1?token=secret",
      "https://github.com/a/b/issues/1\n",
    ]) {
      await assertFails(
        updateDoc(doc(as("staff"), "feedback_reports", "r1"), { ...triage(), issueUrl }),
      );
    }
  });
  test("revocation takes effect without refreshing the staff token", async () => {
    await setDoc(doc(as("author"), "feedback_reports", "r1"), report());
    await grant();
    const db = as("staff");
    const ref = doc(db, "feedback_reports", "r1");
    await assertSucceeds(getDoc(ref));
    await grant(false);
    await assertFails(getDoc(ref));
    await assertFails(getDocs(query(collection(db, "feedback_reports"), limit(50))));
    await assertFails(updateDoc(ref, triage()));
    await assertFails(deleteDoc(ref));
  });
});
