import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "bun:test";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import * as firestore from "firebase/firestore";
import { encryptValue } from "@/utils/fieldCrypto";
import type { NotePayload, ShiftNote } from "@/utils/shiftNotes";

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host && process.env.REQUIRE_FIRESTORE_EMULATOR) throw new Error("Missing Firestore emulator");
let env: RulesTestEnvironment;
let db: firestore.Firestore;
let currentUid = "cg";
mock.module("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: currentUid } }),
}));
mock.module("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
mock.module("@react-native-firebase/firestore", () => ({
  ...firestore,
  getFirestore: () => db,
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
const as = (uid: string) => {
  currentUid = uid;
  return env
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true })
    .firestore() as unknown as firestore.Firestore;
};
const readCurrent = (kind: NotePayload["kind"], key: Uint8Array) =>
  new Promise<ShiftNote[]>((resolve, reject) => {
    const off = ShiftNotesService.subscribe(
      "h1",
      "2026-10-31:day",
      kind,
      key,
      (notes, _unreadable, confirmed) => {
        if (!confirmed) return;
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
  for (const previous of [false, true]) {
    for (const exists of [false, true]) {
      test(`cached empty ${previous ? "previous discovery" : "current handovers"} waits for server ${exists ? "existing note" : "empty result"}`, async () => {
        const key = await getNoteKey("h1", "cg", true);
        if (exists) await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
        db = as("cg");
        const client = db;
        await firestore.disableNetwork(client);
        type Update = { notes: ShiftNote[]; confirmed: boolean | undefined };
        let first!: (value: Update) => void;
        let server!: (value: Update) => void;
        const cached = new Promise<Update>((resolve) => {
          first = resolve;
        });
        const confirmed = new Promise<Update>((resolve) => {
          server = resolve;
        });
        const next = (notes: ShiftNote[], _unreadable: number, isConfirmed?: boolean) => {
          const value = { notes, confirmed: isConfirmed };
          first(value);
          if (isConfirmed) server(value);
        };
        const fail = (error: Error) => {
          throw error;
        };
        const off = previous
          ? ShiftNotesService.subscribePrevious(
              "h1",
              "2026-10-31:night",
              "2026-10-31:day",
              key,
              next,
              fail,
            )
          : ShiftNotesService.subscribe("h1", "2026-10-31:day", "handover", key, next, fail);
        try {
          const initial = await cached;
          assert.deepEqual(initial.notes, []);
          assert.equal(initial.confirmed, false);
          await firestore.enableNetwork(client);
          const result = await confirmed;
          assert.equal(result.notes.length, exists ? 1 : 0);
          if (exists) assert.deepEqual(result.notes[0].payload, handover);
        } finally {
          off();
          await firestore.enableNetwork(client);
        }
      });
    }
  }
  test("malformed communication key preserves own ciphertext alongside healthy clinical export", async () => {
    const clinicalKey = await getNoteKey("h1", "cg", true);
    const messageKey = await getNoteKey("h1", "cg");
    await ShiftNotesService.save(context, "cg", clinicalKey, handover, "h1__c1");
    await ShiftNotesService.save(
      context,
      "cg",
      messageKey,
      { kind: "message", text: "Synthetic message" },
      null,
    );
    const message = (await readCurrent("message", messageKey))[0];
    const ciphertext = (
      await firestore.getDoc(firestore.doc(db, `houses/h1/shiftNotes/${message.id}`))
    ).data()!.payload;
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(ctx.firestore() as unknown as firestore.Firestore, "shift_note_keys/h1"),
        { key: "a".repeat(44) },
      ),
    );
    const result = await ShiftNotesService.exportOwn("cg");
    assert.equal(result.length, 2);
    assert.deepEqual(
      result.find(
        (note) => note.kind === "handover" || (note.payload as NotePayload)?.kind === "handover",
      )!.payload,
      handover,
    );
    assert.equal(result.find((note) => note.id === message.id)!.encryptedPayload, ciphertext);
    const houseExport = await ShiftNotesService.export("h1", "cg");
    assert.equal(houseExport.length, 1);
    assert.equal(houseExport[0].encryptedPayload, ciphertext);
    await firestore.disableNetwork(db);
    try {
      await assert.rejects(
        ShiftNotesService.export("h1", "cg"),
        (error: any) => error.code === "unavailable",
      );
    } finally {
      await firestore.enableNetwork(db);
    }
    db = as("stranger");
    await assert.rejects(
      ShiftNotesService.export("h1", "stranger"),
      (error: any) => error.code === "permission-denied",
    );
  });

  test("CRUD encrypts notes, references the real schedule and reports stale/concurrent edits", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
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
      ShiftNotesService.save(
        context,
        "cg",
        key,
        { ...handover, observations: "A" },
        "h1__c1",
        note,
      ),
      ShiftNotesService.save(
        context,
        "cg",
        key,
        { ...handover, observations: "B" },
        "h1__c1",
        note,
      ),
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
  test("an existing handover conflicts when saved as creation and edits only with its loaded version", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    const updated = { ...handover, observations: "Loaded editor draft" };
    for (let attempt = 0; attempt < 2; attempt++)
      await assert.rejects(
        ShiftNotesService.save(context, "cg", key, updated, "h1__c1"),
        NoteConflictError,
      );
    const [existing] = await readCurrent("handover", key);
    assert.deepEqual(existing.payload, handover);
    await ShiftNotesService.save(context, "cg", key, updated, "h1__c1", existing);
    const [saved] = await readCurrent("handover", key);
    assert.deepEqual(saved.payload, updated);
    assert.equal(saved.revision, existing.revision + 1);
  });

  test("family/caregiver exchange messages; family export never includes clinical content", async () => {
    const clinicalKey = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", clinicalKey, handover, "h1__c1");
    db = as("family");
    const key = await getNoteKey("h1", "family");
    assert.notDeepEqual(key, clinicalKey);
    await ShiftNotesService.save(
      context,
      "family",
      key,
      {
        kind: "message",
        text: "Consulta às 9h",
      },
      null,
    );
    const exported = await ShiftNotesService.export("h1", "family");
    assert.equal(exported.length, 1);
    assert.ok(JSON.stringify(exported).includes("Consulta às 9h"));
    assert.ok(!JSON.stringify(exported).includes("Clinical author"));
    await assert.rejects(getNoteKey("h1", "family", true));
    db = as("cg");
    const [message] = await readCurrent("message", key);
    assert.equal(message.payload.kind, "message");
    await ShiftNotesService.save(context, "cg", key, { kind: "message", text: "Combinado" }, null);
    assert.equal((await readCurrent("message", key)).length, 2);
  });
  test("next caregiver sees chronological handover and resolves pending tasks with progress", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    await ShiftNotesService.save(
      { ...context, date: "2026-10-30" },
      "cg",
      key,
      {
        ...handover,
        observations: "Older shift, written later",
      },
      "h1__c1",
    );
    db = as("next");
    const [previous] = await new Promise<ShiftNote[]>((resolve, reject) => {
      const off = ShiftNotesService.subscribePrevious(
        "h1",
        "2026-10-31:night",
        "2026-10-31:day",
        key,
        (notes, _unreadable, confirmed) => {
          if (!confirmed) return;
          off();
          resolve(notes);
        },
        reject,
      );
    });
    assert.equal(previous.shiftKey, "2026-10-31:day");
    await ShiftNotesService.resolve(
      { ...context, shift: "night" },
      "next",
      previous,
      "p1",
      "done",
      "h1__c2",
    );
    const [resolved] = await readCurrent("handover", key);
    assert.deepEqual(resolved.pendingStatus, { p1: "done" });
    assert.deepEqual(resolved.payload, handover);
    await assert.rejects(
      ShiftNotesService.resolve(
        { ...context, shift: "night" },
        "next",
        previous,
        "p1",
        "open",
        "h1__c2",
      ),
      NoteConflictError,
    );
  });
  test("author edits that add and remove tasks keep another caregiver's completed status", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    db = as("next");
    const [original] = await readCurrent("handover", key);
    await ShiftNotesService.resolve(
      { ...context, shift: "night" },
      "next",
      original,
      "p1",
      "done",
      "h1__c2",
    );
    db = as("cg");
    const [resolved] = await readCurrent("handover", key);
    const added = { ...handover, pending: [...handover.pending, { id: "p2", text: "Dar banho" }] };
    await ShiftNotesService.save(context, "cg", key, added, "h1__c1", resolved);
    const [edited] = await readCurrent("handover", key);
    assert.deepEqual(edited.payload, added);
    assert.deepEqual(edited.pendingStatus, { p1: "done", p2: "open" });
    const removed = { ...handover, pending: [{ id: "p2", text: "Dar banho" }] };
    await ShiftNotesService.save(context, "cg", key, removed, "h1__c1", edited);
    const [final] = await readCurrent("handover", key);
    assert.deepEqual(final.payload, removed);
    assert.deepEqual(final.pendingStatus, { p2: "open" });
  });
  for (const changed of [false, true]) {
    test(`completed instruction ${changed ? "edited text gets a new open identity" : "unchanged text keeps its identity and completion"}`, async () => {
      const key = await getNoteKey("h1", "cg", true);
      await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
      db = as("next");
      const [original] = await readCurrent("handover", key);
      await ShiftNotesService.resolve(
        { ...context, shift: "night" },
        "next",
        original,
        "p1",
        "done",
        "h1__c2",
      );
      db = as("cg");
      const [completed] = await readCurrent("handover", key);
      const text = changed ? "Nova orientação clínica" : "Verificar pressão";
      await ShiftNotesService.save(
        context,
        "cg",
        key,
        { ...handover, pending: [{ id: "p1", text }] },
        "h1__c1",
        completed,
      );
      const [saved] = await readCurrent("handover", key);
      assert.equal(saved.payload.kind, "handover");
      if (saved.payload.kind !== "handover") throw new Error("Expected handover");
      const item = saved.payload.pending[0];
      assert.equal(item.text, text);
      if (changed) assert.notEqual(item.id, "p1");
      else assert.equal(item.id, "p1");
      assert.deepEqual(saved.pendingStatus, { [item.id]: changed ? "open" : "done" });
      assert.equal(saved.generation, completed.generation);
      assert.equal(saved.revision, completed.revision + 1);
    });
  }
  test("concurrent instruction resolution rejects an author's stale text edit", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    const [authorVersion] = await readCurrent("handover", key);
    db = as("next");
    await ShiftNotesService.resolve(
      { ...context, shift: "night" },
      "next",
      authorVersion,
      "p1",
      "done",
      "h1__c2",
    );
    db = as("cg");
    await assert.rejects(
      ShiftNotesService.save(
        context,
        "cg",
        key,
        { ...handover, pending: [{ id: "p1", text: "Changed while resolved" }] },
        "h1__c1",
        authorVersion,
      ),
      NoteConflictError,
    );
    const [saved] = await readCurrent("handover", key);
    assert.deepEqual(saved.payload, handover);
    assert.deepEqual(saved.pendingStatus, { p1: "done" });
  });

  test("revocation denies clinical keys, but own export and erasure still work", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
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
  test("delete and recreate cannot reuse an old editor's revision or delete the new generation", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    const [old] = await readCurrent("handover", key);
    await ShiftNotesService.remove("h1", old);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    const [fresh] = await readCurrent("handover", key);
    assert.equal(fresh.id, old.id);
    assert.equal(fresh.revision, old.revision);
    assert.notEqual(fresh.generation, old.generation);
    await assert.rejects(
      ShiftNotesService.resolve({ ...context, shift: "night" }, "cg", old, "p1", "done", "h1__c1"),
      NoteConflictError,
    );
    await assert.rejects(
      ShiftNotesService.save(
        context,
        "cg",
        key,
        { ...handover, observations: "stale" },
        "h1__c1",
        old,
      ),
      NoteConflictError,
    );
    await assert.rejects(ShiftNotesService.remove("h1", old), NoteConflictError);
    assert.equal((await readCurrent("handover", key)).length, 1);
  });
  test("reassigning the previous shift does not hide the recorded handover", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          "houses/h1/schedule/2026-10-31",
        ),
        { day: ["c2"] },
      ),
    );
    db = as("next");
    const notes = await new Promise<ShiftNote[]>((resolve, reject) => {
      const off = ShiftNotesService.subscribePrevious(
        "h1",
        "2026-10-31:night",
        "2026-10-31:day",
        key,
        (notes, _unreadable, confirmed) => {
          if (!confirmed) return;
          off();
          resolve(notes);
        },
        reject,
      );
    });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].caregiverId, "c1");
  });
  test("recorded handovers survive removing every prior assignment, including all authors of that shift", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as firestore.Firestore;
      const original = (
        await firestore.getDoc(firestore.doc(admin, "houses/h1/shiftNotes/2026-10-31:day__cg"))
      ).data()!;
      await firestore.setDoc(firestore.doc(admin, "houses/h1/shiftNotes/second"), {
        ...original,
        authorUid: "another",
        payload: encryptValue(key, JSON.stringify(handover), "houses/h1/shiftNotes/second:payload"),
      });
      await firestore.deleteDoc(firestore.doc(admin, "houses/h1/schedule/2026-10-30"));
      await firestore.updateDoc(firestore.doc(admin, "houses/h1/schedule/2026-10-31"), { day: [] });
    });
    db = as("next");
    const notes = await new Promise<ShiftNote[]>((resolve, reject) => {
      const off = ShiftNotesService.subscribePrevious(
        "h1",
        "2026-10-31:night",
        null,
        key,
        (notes, _unreadable, confirmed) => {
          if (!confirmed) return;
          off();
          resolve(notes);
        },
        reject,
      );
    });
    assert.equal(notes.length, 2);
    assert.ok(notes.every((note) => note.shiftKey === "2026-10-31:day"));
    await ShiftNotesService.resolve(
      { ...context, shift: "night" },
      "next",
      notes[0],
      "p1",
      "done",
      "h1__c2",
    );
  });
  test("a newer occupied shift with no handover does not fall back to an older recorded note", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save({ ...context, date: "2026-10-30" }, "cg", key, handover, "h1__c1");
    db = as("next");
    const notes = await new Promise<ShiftNote[]>((resolve, reject) => {
      const off = ShiftNotesService.subscribePrevious(
        "h1",
        "2026-10-31:night",
        "2026-10-31:day",
        key,
        (notes, _unreadable, confirmed) => {
          if (!confirmed) return;
          off();
          resolve(notes);
        },
        reject,
      );
    });
    assert.deepEqual(notes, []);
  });
  test("an assigned second link is used instead of a different house-access link", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as firestore.Firestore;
      await firestore.setDoc(firestore.doc(admin, "caregiver_links/h1__c3"), {
        houseId: "h1",
        caregiverId: "c3",
        email: "cg@example.com",
        status: "accepted",
        disabled: false,
      });
      await firestore.updateDoc(firestore.doc(admin, "houses/h1/schedule/2026-10-31"), {
        day: ["c3"],
      });
    });
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c3");
    const [note] = await readCurrent("handover", key);
    assert.equal(note.caregiverId, "c3");
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          "houses/h1/schedule/2026-10-31",
        ),
        { night: ["c3"] },
      ),
    );
    await ShiftNotesService.resolve(
      { ...context, shift: "night" },
      "cg",
      note,
      "p1",
      "done",
      "h1__c3",
    );
    assert.equal((await readCurrent("handover", key))[0].pendingStatus.p1, "done");
  });
  test("an invalid family message accepted by the rules cannot suppress valid messages or clinical data", async () => {
    const clinicalKey = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", clinicalKey, handover, "h1__c1");
    db = as("family");
    const messageKey = await getNoteKey("h1", "family");
    await firestore.setDoc(firestore.doc(db, "houses/h1/shiftNotes/invalid-message"), {
      authorUid: "family",
      caregiverId: null,
      kind: "message",
      shiftKey: "2026-10-31:day",
      scheduleRef: firestore.doc(db, "houses/h1/schedule/2026-10-31"),
      payload: "enc:v1:invalid",
      pendingStatus: {},
      resolvedFrom: null,
      resolvedByCaregiverId: null,
      revision: 1,
      generation: crypto.randomUUID(),
      createdAt: firestore.serverTimestamp(),
      updatedAt: firestore.serverTimestamp(),
      updatedBy: "family",
    });
    await ShiftNotesService.save(
      context,
      "family",
      messageKey,
      { kind: "message", text: "Valid message" },
      null,
    );
    db = as("cg");
    const result = await new Promise<{ notes: ShiftNote[]; unreadable: number }>(
      (resolve, reject) => {
        const off = ShiftNotesService.subscribe(
          "h1",
          "2026-10-31:day",
          "message",
          messageKey,
          (notes, unreadable, confirmed) => {
            if (!confirmed) return;
            off();
            resolve({ notes, unreadable });
          },
          reject,
        );
      },
    );
    assert.equal(result.notes.length, 1);
    assert.equal(result.unreadable, 1);
    assert.equal((await readCurrent("handover", clinicalKey)).length, 1);
  });

  test("an invalid record is reported without suppressing a valid clinical note", async () => {
    const key = await getNoteKey("h1", "cg", true);
    await ShiftNotesService.save(context, "cg", key, handover, "h1__c1");
    const [note] = await readCurrent("handover", key);
    const raw = (
      await firestore.getDoc(firestore.doc(db, `houses/h1/shiftNotes/${note.id}`))
    ).data()!;
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.setDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          "houses/h1/shiftNotes/corrupt",
        ),
        { ...raw, payload: "enc:v1:invalid" },
      ),
    );
    const result = await new Promise<{ notes: ShiftNote[]; unreadable: number }>(
      (resolve, reject) => {
        const off = ShiftNotesService.subscribe(
          "h1",
          "2026-10-31:day",
          "handover",
          key,
          (notes, unreadable, confirmed) => {
            if (!confirmed) return;
            off();
            resolve({ notes, unreadable });
          },
          reject,
        );
      },
    );
    assert.equal(result.notes.length, 1);
    assert.equal(result.unreadable, 1);
    assert.deepEqual(result.notes[0].payload, handover);
  });
});
