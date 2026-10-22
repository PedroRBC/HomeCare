import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { acceptPolicies, needsConsent, telemetryConsents } from "@/utils/privacy";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const storage = new Map<string, string>();
let unavailable = false;
let pauseRead: (() => Promise<void>) | undefined;
let pauseWrite: (() => Promise<void>) | undefined;
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    clear: async () => storage.clear(),
    getItem: async (key: string) => {
      await pauseRead?.();
      if (unavailable) throw new Error("Storage unavailable");
      return storage.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      await pauseWrite?.();
      if (unavailable) throw new Error("Storage unavailable");
      storage.set(key, value);
    },
  },
}));

// A fresh module has no in-memory state from the previous app process.
const freshStore = async () =>
  (await import(`./consentStorage.ts?restart=${Math.random()}`)).ConsentStorageService;
const accepted = {
  ...acceptPolicies(),
  ...telemetryConsents({ analytics: false, crashReports: false }),
};

beforeEach(() => {
  storage.clear();
  unavailable = false;
  pauseRead = undefined;
  pauseWrite = undefined;
});

test("accepted policies survive a new app process using only device storage", async () => {
  const first = await freshStore();
  await first.remember("owner", accepted);
  const restarted = await freshStore();
  assert.deepEqual(await restarted.load("owner"), accepted);
  assert.equal(needsConsent(await restarted.load("owner")), false);
});

test("one account's acceptance never applies to another account", async () => {
  const store = await freshStore();
  await store.remember("owner", accepted);
  assert.equal(await store.load("other"), undefined);
});

test("partial and concurrent preference writes preserve policies and each other", async () => {
  const store = await freshStore();
  await store.remember("owner", accepted);
  const updatedAt = "2026-10-22T00:00:00.000Z";
  await Promise.all([
    store.remember("owner", { analytics: { granted: true, updatedAt } }),
    store.remember("owner", { crashReports: { granted: true, updatedAt } }),
  ]);
  assert.deepEqual(await store.load("owner"), {
    ...accepted,
    analytics: { granted: true, updatedAt },
    crashReports: { granted: true, updatedAt },
  });
});

test("outdated policies stay outdated after restoring local acceptance", async () => {
  const store = await freshStore();
  await store.remember("owner", {
    ...accepted,
    terms: { version: "2020-01-01", acceptedAt: "2020-01-01T00:00:00.000Z" },
  });
  assert.equal(needsConsent(await store.load("owner")), true);
});

test("corrupt local data is ignored instead of treating it as consent", async () => {
  const store = await freshStore();
  await store.remember("owner", accepted);
  const key = [...storage.keys()][0];
  for (const value of [
    "not json",
    "null",
    "[]",
    JSON.stringify({ ...accepted, analytics: true }),
  ]) {
    storage.set(key, value);
    assert.equal(await store.load("owner"), undefined);
  }
});

test("a session ending during a local read cannot recreate its deleted account record", async () => {
  const store = await freshStore();
  let current = true;
  let resume!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  pauseRead = async () => {
    started();
    await gate;
  };
  const writing = store.remember("owner", accepted, () => current);
  await reading;
  current = false;
  storage.clear();
  resume();
  await writing;
  assert.equal(storage.size, 0);
});

test("account deletion waits for an in-flight native write before clearing device data", async () => {
  const store = await freshStore();
  let resume!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const writing = new Promise<void>((resolve) => {
    started = resolve;
  });
  pauseWrite = async () => {
    started();
    await gate;
  };
  const record = store.remember("owner", accepted);
  await writing;
  const cleanup = store.clearDeviceData(() => true);
  resume();
  await Promise.all([record, cleanup]);
  assert.equal(storage.size, 0);
});

test("deletion waits for an in-flight revocation acknowledgement and drops later stale acknowledgements", async () => {
  const store = await freshStore();
  let current = true;
  let resume!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const writing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const acknowledgement = store.acknowledge(
    () => current,
    async () => {
      started();
      await gate;
      storage.set("homecare.telemetryRevocation.owner", "recorded");
    },
  );
  await writing;
  current = false;
  const cleanup = store.clearDeviceData(() => true);
  const stale = store.acknowledge(
    () => current,
    async () => {
      storage.set("homecare.telemetryRevocation.owner", "stale");
    },
  );
  resume();
  await Promise.all([acknowledgement, cleanup, stale]);
  assert.equal(storage.size, 0);
});

test("a stale deletion cannot clear a newly signed-in account's data", async () => {
  const store = await freshStore();
  await store.remember("other", accepted);
  await store.clearDeviceData(() => false);
  assert.deepEqual(await store.load("other"), accepted);
});

test("unavailable local storage does not discard a successful account record", async () => {
  const store = await freshStore();
  unavailable = true;
  await store.remember("owner", accepted);
  assert.equal(await store.load("owner"), undefined);
});
