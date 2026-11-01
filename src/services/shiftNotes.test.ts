import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

let uid: string | null = "u1";
let records: Map<string, Record<string, unknown>>;
let offline = false;
let cachedServerPage = false;
let afterRead: (() => void) | undefined;
const where = (_field: string, _op: string, value: string) => ({ uid: value });
mock.module("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: uid ? { uid } : null }),
}));
mock.module("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
const deniedKey = async () => {
  throw Object.assign(new Error("Access revoked"), { code: "firestore/permission-denied" });
};
mock.module("@react-native-firebase/firestore", () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  collectionGroup: () => ({}),
  doc: () => ({}),
  documentId: () => "__name__",
  where,
  orderBy: () => ({}),
  limit: (size: number) => ({ size }),
  startAfter: (cursor: { id: string }) => ({ cursor: cursor.id }),
  query: (...parts: object[]) => Object.assign({}, ...parts),
  getDoc: deniedKey,
  getDocFromServer: deniedKey,
  getDocs: async () => ({ docs: [], size: 0, empty: true, metadata: { fromCache: true } }),
  getDocsFromServer: async (q: { uid: string; size: number; cursor?: string }) => {
    if (offline) throw new Error("Server unavailable");
    const docs = [...records.entries()]
      .filter(([id, data]) => data.authorUid === q.uid && (!q.cursor || id > q.cursor))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, q.size)
      .map(([id, data]) => ({
        id,
        data: () => data,
        ref: { id, parent: { parent: { id: "h1" } } },
      }));
    afterRead?.();
    return { docs, empty: docs.length === 0, metadata: { fromCache: cachedServerPage } };
  },
  onSnapshot: () => () => {},
  runTransaction: async () => {},
  serverTimestamp: () => ({}),
  writeBatch: () => {
    const ids: string[] = [];
    return {
      delete: (ref: { id: string }) => ids.push(ref.id),
      commit: async () => ids.forEach((id) => records.delete(id)),
    };
  },
}));
const { ShiftNotesService } = await import("./shiftNotes");

beforeEach(() => {
  uid = "u1";
  offline = false;
  cachedServerPage = false;
  afterRead = undefined;
  records = new Map(
    Array.from({ length: 205 }, (_, i) => [
      `n${String(i).padStart(4, "0")}`,
      { authorUid: "u1", kind: "handover", shiftKey: "2026-10-31:day", payload: "enc:v1:archived" },
    ]),
  );
  records.set("other", { authorUid: "u2", payload: "Other user's data" });
});

test("deletion drains every authoritative page, not an incomplete local cache", async () => {
  await ShiftNotesService.deleteOwn("u1");
  assert.deepEqual([...records.keys()], ["other"]);
});
test("export traverses every authoritative page, retaining unreadable own ciphertext without other users' data", async () => {
  const exported = await ShiftNotesService.exportOwn("u1");
  assert.equal(exported.length, 205);
  assert.equal(new Set(exported.map((note) => note.id)).size, 205);
  assert.ok(exported.every((note) => note.authorUid === "u1" && note.readable === false));
});
test("offline rights operations fail instead of reporting successful partial deletion/export", async () => {
  offline = true;
  await assert.rejects(ShiftNotesService.deleteOwn("u1"));
  await assert.rejects(ShiftNotesService.exportOwn("u1"));
  assert.equal(records.size, 206);
});
test("connection loss between deletion pages is reported and a retry drains the remaining notes", async () => {
  afterRead = () => {
    offline = true;
  };
  await assert.rejects(ShiftNotesService.deleteOwn("u1"));
  assert.ok(records.size > 1 && records.size < 206);
  offline = false;
  afterRead = undefined;
  await ShiftNotesService.deleteOwn("u1");
  assert.deepEqual([...records.keys()], ["other"]);
});
test("connection loss after an export page never returns a successful partial archive", async () => {
  afterRead = () => {
    offline = true;
  };
  await assert.rejects(ShiftNotesService.exportOwn("u1"));
  assert.equal(records.size, 206);
});

test("cached responses and account changes cannot authorize deletion or a complete export", async () => {
  cachedServerPage = true;
  await assert.rejects(ShiftNotesService.deleteOwn("u1"));
  await assert.rejects(ShiftNotesService.exportOwn("u1"));
  assert.equal(records.size, 206);
  cachedServerPage = false;
  afterRead = () => {
    uid = "u2";
  };
  await assert.rejects(ShiftNotesService.deleteOwn("u1"));
  assert.equal(records.size, 206);
  await assert.rejects(ShiftNotesService.exportOwn("u1"));
});
