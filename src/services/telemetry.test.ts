import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

const stored = new Map<string, string>();
const applied: boolean[] = [];
const events: string[] = [];
let analyticsEnabled = false;
let crashReportsEnabled = false;
let beforeAnalytics: () => Promise<void> = async () => {};
let beforeRecord: () => Promise<void> = async () => {};
let beforeStorageRead: () => Promise<void> = async () => {};
mock.module("@/services/firestore", () => ({
  FirestoreService: { updateUserConsents: async () => beforeRecord() },
}));

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    clear: async () => stored.clear(),
    getItem: async (key: string) => {
      await beforeStorageRead();
      return stored.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
    removeItem: async (key: string) => {
      stored.delete(key);
    },
  },
}));
mock.module("@react-native-firebase/analytics", () => ({
  getAnalytics: () => ({}),
  setConsent: async () => {},
  setAnalyticsCollectionEnabled: async (_instance: unknown, enabled: boolean) => {
    await beforeAnalytics();
    analyticsEnabled = enabled;
    applied.push(enabled);
  },
  setUserProperty: async () => {},
  logEvent: async (_instance: unknown, name: string) => {
    events.push(name);
  },
  resetAnalyticsData: async () => {},
  setUserId: async () => {},
}));
mock.module("@react-native-firebase/crashlytics", () => ({
  getCrashlytics: () => ({}),
  setCrashlyticsCollectionEnabled: async (_instance: unknown, enabled: boolean) => {
    crashReportsEnabled = enabled;
  },
  deleteUnsentReports: async () => {},
  setUserId: async () => {},
  setAttribute: async () => {},
  log: () => {},
  recordError: () => {},
}));

const { initializeFirebase, TelemetryService, AnalyticsService } = await import("./firebase");
const { ConsentRecordService } = await import("./consentRecords");
const { ConsentStorageService } = await import("./consentStorage");
const enabled = { analytics: true, crashReports: true };
const disabled = { analytics: false, crashReports: false };

beforeEach(async () => {
  beforeRecord = async () => {};
  beforeStorageRead = async () => {};
  beforeAnalytics = async () => {};
  await TelemetryService.apply(disabled);
  stored.clear();
  applied.length = 0;
  events.length = 0;
  analyticsEnabled = false;
  crashReportsEnabled = false;
  beforeAnalytics = async () => {};
});

test("startup disables a previous account's persisted telemetry preference", async () => {
  stored.set("homecare.telemetryConsent", JSON.stringify(enabled));
  analyticsEnabled = true;
  crashReportsEnabled = true;
  await initializeFirebase();
  assert.equal(analyticsEnabled, false);
  assert.equal(crashReportsEnabled, false);
  // The old device-wide preference is ignored, rather than rewritten and reused.
  assert.deepEqual(JSON.parse(stored.get("homecare.telemetryConsent")!), enabled);
});

test("a slow enable finishes before a later revocation, leaving both SDKs disabled", async () => {
  let release!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => (started = resolve));
  beforeAnalytics = async () => {
    started();
    await new Promise<void>((resolve) => (release = resolve));
  };
  const optIn = TelemetryService.apply(enabled);
  await startedPromise;
  beforeAnalytics = async () => {};
  const revoke = TelemetryService.apply(disabled);
  release();
  await Promise.all([optIn, revoke]);
  assert.deepEqual(applied, [true, false]);
  assert.equal(analyticsEnabled, false);
  assert.equal(crashReportsEnabled, false);
});

test("queued telemetry choices from an ended session are discarded", async () => {
  assert.equal(await TelemetryService.apply(enabled, () => false), false);
  assert.deepEqual(applied, []);
  assert.equal(stored.has("homecare.telemetryConsent"), false);
});

test("concurrent revocations retain both purposes and stay scoped to their account", async () => {
  await Promise.all([
    TelemetryService.addPendingRevocation("u1", { analytics: false, crashReports: true }),
    TelemetryService.addPendingRevocation("u1", { analytics: true, crashReports: false }),
  ]);
  assert.deepEqual(await TelemetryService.pendingRevocation("u1"), disabled);
  assert.equal(await TelemetryService.pendingRevocation("u2"), null);
  await TelemetryService.clearPendingRevocation(
    "u1",
    ["analytics"],
    await TelemetryService.pendingRevocationTicket("u1"),
  );
  assert.deepEqual(await TelemetryService.pendingRevocation("u1"), {
    analytics: true,
    crashReports: false,
  });
});

test("an older remote acknowledgement cannot clear a later revocation of the same purpose", async () => {
  const older = await TelemetryService.addPendingRevocation("u1", {
    analytics: false,
    crashReports: true,
  });
  await TelemetryService.addPendingRevocation("u1", { analytics: false, crashReports: true });
  await TelemetryService.clearPendingRevocation("u1", ["analytics"], older);
  assert.deepEqual(await TelemetryService.pendingRevocation("u1"), {
    analytics: false,
    crashReports: true,
  });
});

test("a remote consent acknowledgement after deletion cannot recreate real telemetry storage", async () => {
  let current = true;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const recording = new Promise<void>((resolve) => {
    started = resolve;
  });
  beforeRecord = async () => {
    started();
    await gate;
  };
  const record = ConsentRecordService.record("deleted-owner", {}, () => current, {});
  await recording;
  current = false;
  await ConsentStorageService.clearDeviceData(() => true);
  release();
  await record;
  assert.equal(stored.size, 0);
});

test("deletion drains a real telemetry acknowledgement already inside its storage read", async () => {
  let current = true;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  beforeStorageRead = async () => {
    started();
    await gate;
  };
  const ack = ConsentStorageService.acknowledge(
    () => current,
    () => TelemetryService.clearPendingRevocation("deleted-owner", [], {}),
  );
  await reading;
  current = false;
  const cleanup = ConsentStorageService.clearDeviceData(() => true);
  release();
  await Promise.all([ack, cleanup]);
  assert.equal(stored.size, 0);
});

test("SDK failure rejects enforcement and does not persist a successful choice", async () => {
  beforeAnalytics = async () => {
    throw new Error("SDK unavailable");
  };
  await assert.rejects(TelemetryService.apply(disabled), /telemetry revocation/);
  assert.equal(stored.has("homecare.telemetryConsent"), false);
});

test("an Analytics disable failure still attempts to disable Crashlytics", async () => {
  crashReportsEnabled = true;
  beforeAnalytics = async () => {
    throw new Error("Analytics unavailable");
  };
  await assert.rejects(TelemetryService.apply(disabled), /telemetry revocation/);
  assert.equal(crashReportsEnabled, false);
});

test("app events stop as soon as revocation is requested, even when native enforcement fails", async () => {
  await TelemetryService.apply(enabled);
  await AnalyticsService.trackEvent("allowed");
  beforeAnalytics = async () => {
    throw new Error("SDK unavailable");
  };
  await assert.rejects(TelemetryService.apply(disabled), /telemetry revocation/);
  await AnalyticsService.trackEvent("must-not-be-emitted");
  assert.deepEqual(events, ["allowed"]);
});
