import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

let currentUid: string | null = "user-1";
let records: Map<string, Record<string, any>>;
let transactionWrites = 0;
let pendingRead: (() => Promise<void>) | undefined;
let batchCommits = 0;

const firestore = {};
const collection = (_db: unknown, name: string) => ({ collection: name });
const doc = (_db: unknown, name: string, id: string) => ({ collection: name, id });
const documentId = () => "__name__";
const where = (field: string, op: string, value: unknown) => ({ where: { field, op, value } });
const orderBy = (field: string) => ({ orderBy: field });
const limit = (count: number) => ({ limit: count });
const startAfter = (cursor: any) => ({ cursor: cursor.id });
const query = (...parts: any[]) => Object.assign({}, ...parts);
const serverTimestamp = () => ({ toDate: () => new Date("2026-01-01T00:00:00.000Z") });

mock.module("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: currentUid ? { uid: currentUid } : null }),
}));
mock.module("expo-crypto", () => ({ randomUUID: () => "generated-id" }));
mock.module("@react-native-firebase/firestore", () => ({
  collection,
  doc,
  documentId,
  getDocsFromServer: async (q: any) => {
    const matching = [...records.entries()]
      .filter(([, data]) => data.reporterUid === q.where.value)
      .filter(([id]) => !q.cursor || id > q.cursor)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, q.limit)
      .map(([id, data]) => ({ id, ref: { id }, data: () => data }));
    return { docs: matching, empty: matching.length === 0 };
  },
  getFirestore: () => firestore,
  limit,
  orderBy,
  query,
  runTransaction: async (_db: unknown, callback: (transaction: any) => Promise<unknown>) => {
    const writes: [any, Record<string, unknown>][] = [];
    const result = await callback({
      get: async (ref: any) => {
        if (pendingRead) {
          const waitForRead = pendingRead;
          pendingRead = undefined;
          await waitForRead();
        }
        const data = records.get(ref.id);
        return { exists: () => Boolean(data), data: () => data };
      },
      set: (ref: any, data: Record<string, unknown>) => writes.push([ref, data]),
    });
    for (const [ref, data] of writes) {
      transactionWrites++;
      records.set(ref.id, data);
    }
    return result;
  },
  serverTimestamp,
  startAfter,
  where,
  writeBatch: () => {
    const deletes: string[] = [];
    return {
      delete: (ref: any) => deletes.push(ref.id),
      commit: async () => {
        batchCommits++;
        deletes.forEach((id) => records.delete(id));
      },
    };
  },
}));

const { deleteOwnReports, listOwnReports, submitFeedbackReport } =
  await import("@/services/feedbackReports");
const validDraft = {
  type: "bug" as const,
  title: "Calendar is blank",
  description: "The calendar does not load after sign in.",
  steps: "Open the calendar",
  expected: "The calendar should appear",
  actual: "The screen is blank",
};
const context = {
  appVersion: "1.2.3",
  appBuild: "44",
  platform: "ios",
  osVersion: "18.0",
  language: "en",
};
const report = (id: string, uid = "user-1") => ({
  schemaVersion: 1,
  reporterUid: uid,
  ...validDraft,
  context,
  status: "open",
  issueUrl: null,
  reviewerUid: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

beforeEach(() => {
  currentUid = "user-1";
  records = new Map();
  transactionWrites = 0;
  pendingRead = undefined;
  batchCommits = 0;
});

test("uses the authenticated UID and stable IDs make identical retries idempotent", async () => {
  const first = await submitFeedbackReport(validDraft, context, "stable-id");
  const retry = await submitFeedbackReport(validDraft, context, "stable-id");

  assert.equal(first, "stable-id");
  assert.equal(retry, "stable-id");
  assert.equal(transactionWrites, 1);
  assert.equal(records.get("stable-id")?.reporterUid, "user-1");
  assert.equal(records.get("stable-id")?.status, "open");
  assert.equal(records.get("stable-id")?.issueUrl, null);
  assert.equal(records.get("stable-id")?.reviewerUid, null);
  assert.deepEqual(Object.keys(records.get("stable-id") ?? {}).sort(), [
    "actual",
    "context",
    "createdAt",
    "description",
    "expected",
    "issueUrl",
    "reporterUid",
    "reviewerUid",
    "schemaVersion",
    "status",
    "steps",
    "title",
    "type",
    "updatedAt",
  ]);
});

test("rejects content conflicts and cannot accept a reporter UID supplied in the draft", async () => {
  await submitFeedbackReport(validDraft, context, "stable-id");
  await assert.rejects(
    submitFeedbackReport({ ...validDraft, title: "Different report" }, context, "stable-id"),
    /already uses this reference/,
  );
  await assert.rejects(
    submitFeedbackReport({ ...validDraft, reporterUid: "spoofed" } as any, context, "other-id"),
  );
  assert.equal(transactionWrites, 1);
});

test("does not write when the authenticated session changes during the transaction", async () => {
  let signalRead!: () => void;
  const readStarted = new Promise<void>((resolve) => {
    signalRead = resolve;
  });
  let releaseRead!: () => void;
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  pendingRead = async () => {
    signalRead();
    await readGate;
  };
  const submission = submitFeedbackReport(validDraft, context, "session-id");
  await readStarted;
  currentUid = "user-2";
  releaseRead();
  await assert.rejects(submission, /different or ended account session/);
  assert.equal(transactionWrites, 0);
});

test("lists all own reports in pages and strips reporter and reviewer identity", async () => {
  for (let index = 0; index < 123; index++) {
    records.set(`report-${String(index).padStart(3, "0")}`, report(`report-${index}`));
  }
  records.set("other-user-report", report("other-user-report", "user-2"));

  const exported = await listOwnReports("user-1");
  assert.equal(exported.length, 123);
  assert.equal("reporterUid" in exported[0], false);
  assert.equal("reviewerUid" in exported[0], false);
  assert.equal(exported[0].id, "report-000");
});

test("deletes own reports in bounded batches without touching another account", async () => {
  for (let index = 0; index < 123; index++) {
    records.set(`report-${String(index).padStart(3, "0")}`, report(`report-${index}`));
  }
  records.set("other-user-report", report("other-user-report", "user-2"));

  await deleteOwnReports("user-1");
  assert.deepEqual([...records.keys()], ["other-user-report"]);
  assert.equal(batchCommits, 3);
});

test("submission and own-report operations reject a mismatched account", async () => {
  await assert.rejects(
    submitFeedbackReport(validDraft, context, "wrong-session", "somebody-else"),
    /different or ended account session/,
  );
  await assert.rejects(listOwnReports("somebody-else"), /different or ended account session/);
  await assert.rejects(deleteOwnReports("somebody-else"), /different or ended account session/);
});
