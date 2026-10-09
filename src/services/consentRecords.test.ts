import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import type { UserConsents } from "@/utils/privacy";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let gate = deferred();
let started = deferred();
let accounts: Record<string, UserConsents>;
let writes: string[];
let acknowledgements: string[];
let failFirst = false;
mock.module("@/services/firestore", () => ({
  FirestoreService: {
    updateUserConsents: async (uid: string, changes: UserConsents) => {
      if (failFirst) {
        failFirst = false;
        throw new Error("Record denied");
      }
      writes.push(uid);
      accounts[uid] = { ...accounts[uid], ...changes };
    },
  },
}));
mock.module("@/services/firebase", () => ({
  TelemetryService: {
    pendingRevocationTicket: async () => {
      started.resolve();
      await gate.promise;
      return { analytics: 1 };
    },
    clearPendingRevocation: async (uid: string) => {
      acknowledgements.push(uid);
    },
  },
}));
const { ConsentRecordService } = await import("@/services/consentRecords");
const disabled = { analytics: { granted: false, updatedAt: "old" } };
const granted = { analytics: { granted: true, updatedAt: "new" } };
beforeEach(() => {
  gate = deferred();
  started = deferred();
  accounts = {};
  writes = [];
  acknowledgements = [];
  failFirst = false;
});

test("a delayed startup revocation is recorded before a newer grant and preserves the grant", async () => {
  const replay = ConsentRecordService.record("owner", disabled, () => true);
  await started.promise;
  const choice = ConsentRecordService.record("owner", granted, () => true, { analytics: 1 });
  assert.deepEqual(writes, []);
  gate.resolve();
  await Promise.all([replay, choice]);
  assert.deepEqual(writes, ["owner", "owner"]);
  assert.deepEqual(accounts.owner.analytics, granted.analytics);
});

test("queued work from an ended session is dropped without erasing its pending revocation", async () => {
  let current = true;
  const stale = ConsentRecordService.record("owner", disabled, () => current);
  const rejected = assert.rejects(stale, /ended session/);
  await started.promise;
  current = false;
  const fresh = ConsentRecordService.record("owner", granted, () => true, {});
  gate.resolve();
  await Promise.all([rejected, fresh]);
  assert.deepEqual(writes, ["owner"]);
  assert.deepEqual(acknowledgements, ["owner"]);
  assert.deepEqual(accounts.owner.analytics, granted.analytics);
});

test("one account's pending replay does not block another account's consent", async () => {
  const replay = ConsentRecordService.record("owner", disabled, () => true);
  await started.promise;
  await ConsentRecordService.record("other", granted, () => true, {});
  assert.deepEqual(writes, ["other"]);
  gate.resolve();
  await replay;
  assert.deepEqual(accounts.other.analytics, granted.analytics);
});

test("a failed replay does not stop a newer choice from being recorded", async () => {
  failFirst = true;
  const replay = ConsentRecordService.record("owner", disabled, () => true);
  const rejected = assert.rejects(replay, /Record denied/);
  await started.promise;
  const choice = ConsentRecordService.record("owner", granted, () => true, {});
  gate.resolve();
  await Promise.all([rejected, choice]);
  assert.deepEqual(accounts.owner.analytics, granted.analytics);
  assert.deepEqual(acknowledgements, ["owner"]);
});
