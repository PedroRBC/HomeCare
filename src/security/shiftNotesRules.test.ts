import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host && process.env.REQUIRE_FIRESTORE_EMULATOR) throw new Error("Missing Firestore emulator");
let env: RulesTestEnvironment;
const as = (uid: string, verified = true) =>
  env
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified })
    .firestore() as unknown as Firestore;
const path = "houses/h1/shiftNotes/n1";
const note = (authorUid = "cg", kind = "handover", shiftKey = "2026-10-31:day") => ({
  authorUid,
  caregiverId: kind === "handover" ? "c1" : null,
  kind,
  shiftKey,
  scheduleRef: doc(as(authorUid), "houses/h1/schedule", shiftKey.split(":")[0]),
  payload: "enc:v1:encrypted-content",
  pendingStatus: kind === "handover" ? { p1: "open" } : {},
  resolvedFrom: null,
  revision: 1,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  updatedBy: authorUid,
});
const edit = (revision: number, uid = "cg") => ({
  revision,
  updatedAt: serverTimestamp(),
  updatedBy: uid,
});
(host ? describe : describe.skip)("shift notes rules", () => {
  before(async () => {
    const [hostname, port] = host!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-homecare-shift-notes",
      firestore: {
        host: hostname,
        port: Number(port),
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });
  after(() => env?.cleanup());
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      await Promise.all([
        setDoc(doc(db, "houses/h1"), { id: "h1" }),
        setDoc(doc(db, "user_house_access/h1_owner"), {
          userId: "owner",
          role: "owner",
          houseId: "h1",
        }),
        setDoc(doc(db, "caregiver_links/h1__c1"), {
          houseId: "h1",
          caregiverId: "c1",
          email: "cg@example.com",
          status: "accepted",
          disabled: false,
        }),
        setDoc(doc(db, "caregiver_links/h1__c2"), {
          houseId: "h1",
          caregiverId: "c2",
          email: "next@example.com",
          status: "accepted",
          disabled: false,
        }),
        setDoc(doc(db, "caregiver_access/h1_cg"), {
          userId: "cg",
          houseId: "h1",
          linkId: "h1__c1",
        }),
        setDoc(doc(db, "caregiver_access/h1_next"), {
          userId: "next",
          houseId: "h1",
          linkId: "h1__c2",
        }),
        setDoc(doc(db, "houses/h1/schedule/2026-10-31"), { day: ["c1"], night: ["c2"] }),
      ]);
    });
  });
  test("family can exchange messages but cannot read handovers or clinical keys, including list queries", async () => {
    await assertSucceeds(setDoc(doc(as("cg"), path), note()));
    await assertFails(getDocs(collection(as("owner"), "houses/h1/shiftNotes")));
    await assertFails(getDoc(doc(as("owner"), path)));
    await assertSucceeds(
      setDoc(doc(as("owner"), "houses/h1/shiftNotes/m1"), note("owner", "message")),
    );
    await assertSucceeds(
      getDocs(
        query(collection(as("owner"), "houses/h1/shiftNotes"), where("kind", "==", "message")),
      ),
    );
    await assertSucceeds(getDoc(doc(as("cg"), "houses/h1/shiftNotes/m1")));
    for (const collectionName of ["shift_note_keys", "shift_handover_keys"]) {
      await assertSucceeds(
        setDoc(doc(as("cg"), `${collectionName}/h1`), {
          key: "a".repeat(43) + "=",
          createdBy: "cg",
        }),
      );
      await assertFails(updateDoc(doc(as("cg"), `${collectionName}/h1`), { key: "b".repeat(44) }));
    }
    await assertSucceeds(getDoc(doc(as("owner"), "shift_note_keys/h1")));
    await assertFails(getDoc(doc(as("owner"), "shift_handover_keys/h1")));
    await assertFails(getDoc(doc(as("cg"), "house_keys/h1")));
    await assertSucceeds(getDoc(doc(as("next"), "shift_handover_keys/h1")));
  });
  test("strangers, unverified, disabled, declined and pending caregivers cannot read or write shared notes", async () => {
    await assertFails(setDoc(doc(as("stranger"), path), note("stranger", "message")));
    await assertFails(getDocs(collection(as("cg", false), "houses/h1/shiftNotes")));
    for (const change of [
      { status: "pending" },
      { status: "declined" },
      { status: "accepted", disabled: true },
    ]) {
      await env.withSecurityRulesDisabled((ctx) =>
        updateDoc(doc(ctx.firestore() as unknown as Firestore, "caregiver_links/h1__c1"), change),
      );
      await assertFails(getDocs(collection(as("cg"), "houses/h1/shiftNotes")));
      await assertFails(setDoc(doc(as("cg"), path), note()));
      await assertFails(getDoc(doc(as("cg"), "shift_note_keys/h1")));
      await assertFails(getDoc(doc(as("cg"), "shift_handover_keys/h1")));
    }
  });
  test("handover requires real assignment and a reference to the same schedule document", async () => {
    await assertFails(setDoc(doc(as("owner"), path), note("owner")));
    await assertFails(setDoc(doc(as("cg"), path), note("cg", "handover", "2026-10-31:night")));
    await assertFails(setDoc(doc(as("cg"), path), note("cg", "message", "2026-11-01:day")));
    await assertFails(setDoc(doc(as("cg"), "houses/h2/shiftNotes/n1"), note()));
    await assertFails(
      setDoc(doc(as("cg"), path), {
        ...note(),
        scheduleRef: doc(as("cg"), "houses/h2/schedule/2026-10-31"),
      }),
    );
  });
  test("authors edit with revision checking; identity, type, reference and context are immutable", async () => {
    await setDoc(doc(as("cg"), path), note());
    await assertSucceeds(updateDoc(doc(as("cg"), path), { payload: "enc:v1:updated", ...edit(2) }));
    await assertFails(
      updateDoc(doc(as("owner"), path), { payload: "enc:v1:stolen", ...edit(3, "owner") }),
    );
    for (const change of [
      { authorUid: "owner" },
      { kind: "message" },
      { caregiverId: "c2" },
      { scheduleRef: doc(as("cg"), "houses/h1/schedule/2026-11-01") },
      { shiftKey: "2026-10-31:night" },
      { revision: 2 },
      { payload: "plaintext" },
      { extra: "field" },
    ]) {
      await assertFails(updateDoc(doc(as("cg"), path), { ...edit(3), ...change }));
    }
    await assertSucceeds(deleteDoc(doc(as("cg"), path)));
  });
  test("next assigned caregiver resolves structured tasks without rewriting the clinical note", async () => {
    await setDoc(doc(as("cg"), path), note());
    const resolution = {
      pendingStatus: { p1: "done" },
      resolvedFrom: "2026-10-31:night",
      ...edit(2, "next"),
    };
    await assertSucceeds(updateDoc(doc(as("next"), path), resolution));
    for (const change of [
      { pendingStatus: { p1: "invalid" } },
      { pendingStatus: {} },
      { pendingStatus: { p1: "done", p2: "open" } },
      { payload: "enc:v1:tampered" },
      { resolvedFrom: "2026-10-31:day" },
      { resolvedFrom: "2026-11-01:day" },
    ]) {
      await assertFails(
        updateDoc(doc(as("next"), path), { ...resolution, ...edit(3, "next"), ...change }),
      );
    }
    await assertFails(updateDoc(doc(as("owner"), path), { ...resolution, ...edit(3, "owner") }));
    await assertFails(
      updateDoc(doc(as("cg"), path), { ...resolution, pendingStatus: { p1: "open" }, ...edit(3) }),
    );
  });
  test("previous handover query is house/caregiver scoped and ordered by shift, not creation time", async () => {
    await setDoc(doc(as("cg"), path), note());
    await assertSucceeds(
      getDocs(
        query(
          collection(as("next"), "houses/h1/shiftNotes"),
          where("kind", "==", "handover"),
          where("caregiverId", "==", "c1"),
          where("shiftKey", "<", "2026-10-31:night"),
          orderBy("shiftKey", "desc"),
          limit(1),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(collection(as("owner"), "houses/h1/shiftNotes"), where("kind", "==", "handover")),
      ),
    );
  });
  test("family moderates only messages; clinical deletion belongs to the author", async () => {
    await setDoc(doc(as("cg"), path), note());
    await assertFails(deleteDoc(doc(as("owner"), path)));
    await assertSucceeds(deleteDoc(doc(as("cg"), path)));
    const messagePath = "houses/h1/shiftNotes/message-to-moderate";
    await setDoc(doc(as("cg"), messagePath), note("cg", "message"));
    await assertFails(deleteDoc(doc(as("stranger"), messagePath)));
    await assertSucceeds(deleteDoc(doc(as("owner"), messagePath)));
    for (const change of [
      { payload: "plain" },
      { pendingStatus: { p1: "invalid" } },
      { revision: 0 },
      { authorUid: "owner" },
      { kind: "unknown" },
      { createdAt: "forged" },
      { shiftKey: "../x:day" },
    ]) {
      await assertFails(setDoc(doc(as("cg"), path), { ...note(), ...change }));
    }
  });
});
