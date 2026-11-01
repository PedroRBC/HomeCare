import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "bun:test";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import * as firestore from "firebase/firestore";
import type { NotePayload, ShiftNote } from "@/utils/shiftNotes";

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host && process.env.REQUIRE_FIRESTORE_EMULATOR) throw new Error("Missing Firestore emulator");
let env: RulesTestEnvironment;
let db: firestore.Firestore;
mock.module("@react-native-firebase/firestore", () => ({
  ...firestore,
  getFirestore: () => db,
  // Wait for acknowledged server state, not the web SDK's first cached snapshot.
  onSnapshot: (
    reference: firestore.Query,
    next: (snapshot: firestore.QuerySnapshot) => void,
    fail: (error: Error) => void,
  ) =>
    firestore.onSnapshot(
      reference,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.metadata.fromCache) next(snapshot);
      },
      fail,
    ),
}));
const { ShiftNotesService, getNoteKey, NoteConflictError } = await import("@/services/shiftNotes");
const context = { houseId: "h1", date: "2026-10-31", shift: "day" as const };
const handover: NotePayload = {
  kind: "handover",
  authorName: "Clinical author",
  medication: true,
  meals: false,
  activities: true,
  pending: [{ id: "p1", text: "Verificar pressão" }],
  observations: "Observação clínica",
};
const as = (uid: string) =>
  env
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true })
    .firestore() as unknown as firestore.Firestore;
const readCurrent = (kind: NotePayload["kind"], key: Uint8Array) =>
  new Promise<ShiftNote[]>((resolve, reject) => {
    const off = ShiftNotesService.subscribe(
      "h1",
      "2026-10-31:day",
      kind,
      key,
      (notes) => {
        off();
        resolve(notes);
      },
      reject,
    );
  });

(host ? describe : describe.skip)("ShiftNotesService integration", () => {
  before(async () => {
    const [hostname, port] = host!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-homecare-notes-service",
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
      const admin = ctx.firestore() as unknown as firestore.Firestore;
      const records = {
        "houses/h1": { id: "h1" },
        "user_house_access/h1_family": { userId: "family", houseId: "h1", role: "owner" },
        "caregiver_links/h1__c1": {
          houseId: "h1",
          caregiverId: "c1",
          email: "cg@example.com",
          status: "accepted",
        },
        "caregiver_links/h1__c2": {
          houseId: "h1",
          caregiverId: "c2",
          email: "next@example.com",
          status: "accepted",
        },
        "caregiver_access/h1_cg": { userId: "cg", houseId: "h1", linkId: "h1__c1" },
        "caregiver_access/h1_next": { userId: "next", houseId: "h1", linkId: "h1__c2" },
        "houses/h1/schedule/2026-10-30": { day: ["c1"], night: [] },
        "houses/h1/schedule/2026-10-31": { day: ["c1"], night: ["c2"] },
      };
      await Promise.all(
        Object.entries(records).map(([path, data]) =>
          firestore.setDoc(firestore.doc(admin, path), data),
        ),
      );
    });
    db = as("cg");
  });
  test("CRUD encrypts notes, references the real schedule and reports stale/concurrent edits", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover);
    const [note] = await readCurrent("handover", key);
    assert.deepEqual(note.payload, handover);
    assert.deepEqual(note.pendingStatus, { p1: "open" });
    const raw = (
      await firestore.getDoc(firestore.doc(db, `houses/h1/shiftNotes/${note.id}`))
    ).data()!;
    assert.equal(raw.scheduleRef.path, "houses/h1/schedule/2026-10-31");
    assert.ok(raw.payload.startsWith("enc:v1:"));
    assert.ok(!JSON.stringify(raw).includes("Observação clínica"));
    const results = await Promise.allSettled([
      ShiftNotesService.save(context, "cg", key, { ...handover, observations: "A" }, note),
      ShiftNotesService.save(context, "cg", key, { ...handover, observations: "B" }, note),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(
      rejected?.status === "rejected" && rejected.reason instanceof NoteConflictError,
      rejected?.status === "rejected" ? String(rejected.reason) : "missing rejection",
    );
    await assert.rejects(ShiftNotesService.remove("h1", note), NoteConflictError);
    const [updated] = await readCurrent("handover", key);
    await ShiftNotesService.remove("h1", updated);
    assert.equal((await readCurrent("handover", key)).length, 0);
  });
  test("family/caregiver exchange messages; family export never includes clinical content", async () => {
    const clinicalKey = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", clinicalKey, handover);
    db = as("family");
    const key = await getNoteKey("h1", "family");
    assert.notDeepEqual(key, clinicalKey);
    await ShiftNotesService.save(context, "family", key, {
      kind: "message",
      text: "Consulta às 9h",
    });
    const exported = await ShiftNotesService.export("h1", "family");
    assert.equal(exported.length, 1);
    assert.ok(JSON.stringify(exported).includes("Consulta às 9h"));
    assert.ok(!JSON.stringify(exported).includes("Clinical author"));
    await assert.rejects(getNoteKey("h1", "family", true));
    db = as("cg");
    const [message] = await readCurrent("message", key);
    assert.equal(message.payload.kind, "message");
    await ShiftNotesService.save(context, "cg", key, { kind: "message", text: "Combinado" });
    assert.equal((await readCurrent("message", key)).length, 2);
  });
  test("next caregiver sees chronological handover and resolves pending tasks with progress", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover);
    await ShiftNotesService.save({ ...context, date: "2026-10-30" }, "cg", key, {
      ...handover,
      observations: "Older shift, written later",
    });
    db = as("next");
    const [previous] = await new Promise<ShiftNote[]>((resolve, reject) => {
      const off = ShiftNotesService.subscribePrevious(
        "h1",
        "c1",
        "2026-10-31:night",
        "2026-10-31:day",
        key,
        (notes) => {
          off();
          resolve(notes);
        },
        reject,
      );
    });
    assert.equal(previous.shiftKey, "2026-10-31:day");
    await ShiftNotesService.resolve({ ...context, shift: "night" }, "next", previous, "p1", "done");
    const [resolved] = await readCurrent("handover", key);
    assert.deepEqual(resolved.pendingStatus, { p1: "done" });
    assert.deepEqual(resolved.payload, handover);
    await assert.rejects(
      ShiftNotesService.resolve({ ...context, shift: "night" }, "next", previous, "p1", "open"),
      NoteConflictError,
    );
  });
  test("revocation denies clinical keys, but own export and erasure still work", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover);
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(ctx.firestore() as unknown as firestore.Firestore, "caregiver_links/h1__c1"),
        { status: "declined" },
      ),
    );
    await assert.rejects(getNoteKey("h1", "cg", true));
    const exported = await ShiftNotesService.exportOwn("cg");
    assert.equal(exported.length, 1);
    assert.equal(exported[0].readable, false);
    assert.ok(String(exported[0].encryptedPayload).startsWith("enc:v1:"));
    await ShiftNotesService.deleteOwn("cg");
    assert.equal((await ShiftNotesService.exportOwn("cg")).length, 0);
  });
  test("tampered ciphertext fails visibly instead of rendering wrong clinical data", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover);
    const [note] = await readCurrent("handover", key);
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          `houses/h1/shiftNotes/${note.id}`,
        ),
        { payload: "enc:v1:tampered" },
      ),
    );
    await assert.rejects(
      new Promise<ShiftNote[]>((resolve, reject) => {
        const off = ShiftNotesService.subscribe(
          "h1",
          "2026-10-31:day",
          "handover",
          key,
          (notes) => {
            off();
            resolve(notes);
          },
          (error) => {
            off();
            reject(error);
          },
        );
      }),
    );
  });
});
