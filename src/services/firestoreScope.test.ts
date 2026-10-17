/**
 * House scope of FirestoreService writes, with Firestore replaced by an in-memory
 * fake: a write keeps the house and key it started with, and is refused if the
 * selected house changed (or the user signed out) while it was waiting.
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { decryptValue, generateDataKey, importDataKey } from "@/utils/fieldCrypto";
import { encryptFields, SECURE_FIELDS } from "@/utils/secureFields";
import { buildPaymentKey } from "@/utils/paymentDomain";

// Set by React Native in the app
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

type Ref = { path: string; id: string };
type Op = { type: "set" | "update" | "delete"; path: string; data?: Record<string, any> };

const stored = new Map<string, Record<string, unknown>>();
const commits: Op[][] = [];
const queries: unknown[][] = [];
const transactionReads: string[] = [];
// Lets a test hold a read until it has switched houses
let beforeRead: (path: string) => Promise<void> = async () => {};
let failTransactionWritePath: string | null = null;
let autoId = 0;
let queryResults: { id: string; ref: Ref; data: () => Record<string, unknown> }[] = [];
let scheduleResults: { id: string; ref: Ref; data: () => Record<string, unknown> }[] = [];

const join = (...parts: string[]) => parts.filter(Boolean).join("/");
const ref = (path: string): Ref => ({ path, id: path.split("/").pop()! });

mock.module("@react-native-firebase/firestore", () => ({
  getFirestore: () => ({}),
  collection: (base: { path?: string }, ...segments: string[]) => ({
    path: join(base?.path ?? "", ...segments),
  }),
  doc: (base: { path?: string }, ...segments: string[]) =>
    ref(
      segments.length
        ? join(base?.path ?? "", ...segments)
        : join(base?.path ?? "", `auto${++autoId}`),
    ),
  getDoc: async ({ path }: Ref) => {
    await beforeRead(path);
    const data = stored.get(path);
    return { exists: () => data !== undefined, data: () => data, id: ref(path).id };
  },
  getDocs: async (target?: unknown) => {
    const docs = Array.isArray(target) ? queryResults : scheduleResults;
    return {
      docs,
      forEach: (visit: (record: (typeof queryResults)[number]) => void) => docs.forEach(visit),
    };
  },
  writeBatch: () => {
    const ops: Op[] = [];
    return {
      set: (r: Ref, data: Record<string, unknown>) => ops.push({ type: "set", path: r.path, data }),
      update: (r: Ref, data: Record<string, unknown>) =>
        ops.push({ type: "update", path: r.path, data }),
      delete: (r: Ref) => ops.push({ type: "delete", path: r.path }),
      commit: async () => {
        commits.push(ops);
      },
    };
  },
  query: (...args: unknown[]) => {
    queries.push(args);
    return args;
  },
  where: (...args: unknown[]) => args,
  orderBy: (...args: unknown[]) => args,
  onSnapshot: () => () => {},
  runTransaction: async (_db: unknown, update: (transaction: any) => Promise<void>) => {
    const ops: Op[] = [];
    let writeStarted = false;
    await update({
      get: async ({ path }: Ref) => {
        if (writeStarted) throw new Error("Firestore transaction read after write");
        transactionReads.push(path);
        await beforeRead(path);
        const data = stored.get(path);
        return { exists: () => data !== undefined, data: () => data, ref: ref(path) };
      },
      set: (r: Ref, data: Record<string, unknown>) => {
        writeStarted = true;
        if (r.path === failTransactionWritePath)
          throw new Error("Injected transaction write failure");
        ops.push({ type: "set", path: r.path, data });
      },
      update: (r: Ref, data: Record<string, unknown>) => {
        writeStarted = true;
        if (r.path === failTransactionWritePath)
          throw new Error("Injected transaction write failure");
        ops.push({ type: "update", path: r.path, data });
      },
    });
    commits.push(ops);
    for (const op of ops) stored.set(op.path, op.data!);
  },
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  arrayUnion: (...values: unknown[]) => values,
  arrayRemove: (...values: unknown[]) => values,
  Timestamp: { fromDate: (date: Date) => date },
}));

const keys: Record<string, Uint8Array> = {
  A: importDataKey(generateDataKey()),
  B: importDataKey(generateDataKey()),
};
mock.module("@/services/houseKeys", () => ({
  HouseKeyService: { getKey: async (houseId: string) => keys[houseId], clear: () => {} },
}));
mock.module("@/services/firebase", () => ({
  CrashlyticsService: { log: () => {}, logError: () => {} },
}));

mock.module("@/services/feedbackReports", () => ({
  listOwnReports: async () => [],
  deleteOwnReports: async () => {},
}));

const { FirestoreService, LockedRecordError } = await import("./firestore");

const caregiverPath = (houseId: string) => `houses/${houseId}/caregivers/c1`;
const storeCaregiver = (houseId: string, key = keys[houseId], email?: string) =>
  stored.set(
    caregiverPath(houseId),
    encryptFields(
      {
        id: "c1",
        name: "Ana",
        frequency: "Semanal",
        amount: 200,
        ...(email && { email }),
        ...(email && { additionalAmount: 30 }),
      },
      SECURE_FIELDS.caregivers,
      key,
      caregiverPath(houseId),
    ),
  );

beforeEach(() => {
  stored.clear();
  commits.length = 0;
  queries.length = 0;
  transactionReads.length = 0;
  beforeRead = async () => {};
  failTransactionWritePath = null;
  queryResults = [];
  scheduleResults = [];
  FirestoreService.cleanup();
});

test("a day edit preserves other caregivers from the current server snapshot", async () => {
  await FirestoreService.initialize("u1", "A");
  stored.set("houses/A/schedule/2026-10-05", {
    day: ["other"],
    night: [],
    dayExtra: [],
    nightExtra: [],
  });
  await FirestoreService.updateDaySchedule("2026-10-05", "c1", "day", false, true);
  assert.deepEqual(commits[0][0].data!.day, ["other", "c1"]);
});

test("a write is encrypted with its own house's key and path", async () => {
  storeCaregiver("A");
  await FirestoreService.initialize("u1", "A");
  await FirestoreService.updateCaregiver("c1", { name: "Ana Maria" });

  assert.equal(commits.length, 1);
  const [update] = commits[0];
  assert.equal(update.path, caregiverPath("A"));
  const name = decryptValue(keys.A, update.data!.name, `${caregiverPath("A")}#name`);
  assert.equal(name, "Ana Maria");
});

test("switching houses while a write waits refuses it instead of mixing houses", async () => {
  storeCaregiver("A");
  await FirestoreService.initialize("u1", "A");

  let release!: () => void;
  beforeRead = (path) =>
    path === caregiverPath("A") ? new Promise((resolve) => (release = resolve)) : Promise.resolve();
  const write = FirestoreService.updateCaregiver("c1", { name: "Ana Maria" });

  // The user opens house B before the read of house A returns
  beforeRead = async () => {};
  await FirestoreService.initialize("u1", "B");
  release();

  await assert.rejects(write, /selected house changed/);
  assert.equal(commits.length, 0);
});

test("signing out while a write waits refuses it", async () => {
  storeCaregiver("A");
  await FirestoreService.initialize("u1", "A");

  let release!: () => void;
  beforeRead = (path) =>
    path === caregiverPath("A") ? new Promise((resolve) => (release = resolve)) : Promise.resolve();
  const write = FirestoreService.updateCaregiver("c1", { disabled: true });
  FirestoreService.cleanup();
  release();

  await assert.rejects(write, /selected house changed/);
  assert.equal(commits.length, 0);
});

test("a failed link write rolls back a combined additional-amount clear", async () => {
  storeCaregiver("A", keys.A, "ana@example.com");
  const linkPath = "caregiver_links/A__c1";
  const originalLink = {
    houseId: "A",
    caregiverId: "c1",
    caregiverName: "Ana",
    email: "ana@example.com",
    status: "accepted",
    shifts: [],
  };
  stored.set(linkPath, originalLink);
  await FirestoreService.initialize("u1", "A");
  failTransactionWritePath = linkPath;

  await assert.rejects(
    FirestoreService.updateCaregiver("c1", {
      name: "Changed Name",
      email: "new@example.com",
      disabled: true,
      additionalAmount: 0,
    }),
    /Injected transaction write failure/,
  );

  assert.equal(commits.length, 0);
  const storedCaregiver = stored.get(caregiverPath("A"))!;
  assert.equal(
    decryptValue(keys.A, storedCaregiver.name as string, `${caregiverPath("A")}#name`),
    "Ana",
  );
  assert.equal(
    decryptValue(keys.A, storedCaregiver.email as string, `${caregiverPath("A")}#email`),
    "ana@example.com",
  );
  assert.equal(
    decryptValue(
      keys.A,
      storedCaregiver.additionalAmount as string,
      `${caregiverPath("A")}#additionalAmount`,
    ),
    30,
  );
  assert.equal(storedCaregiver.disabled, undefined);
  assert.deepEqual(stored.get(linkPath), originalLink);
});

test("clearing an additional rate revalidates legacy query results and canonical marks transactionally", async () => {
  storeCaregiver("A", keys.A, "ana@example.com");
  await FirestoreService.initialize("u1", "A");
  const key = buildPaymentKey({
    date: new Date(2026, 9, 5, 12),
    shift: "day",
    frequency: "Semanal",
    mode: "additional",
  });
  const schedule = { day: ["c1"], dayAdditional: ["c1"] };
  scheduleResults = [
    {
      id: "2026-10-05",
      ref: ref("houses/A/schedule/2026-10-05"),
      data: () => schedule,
    },
  ];
  stored.set("houses/A/schedule/2026-10-05", schedule);
  const legacyPath = "houses/A/payments/legacy-additional";
  queryResults = [
    {
      id: "legacy-additional",
      ref: ref(legacyPath),
      data: () => ({ caregiverId: "c1", paymentKey: key }),
    },
  ];
  // The old query result is stale: only its reference is returned, not its marker document.
  await assert.rejects(
    FirestoreService.updateCaregiver("c1", { additionalAmount: 0 }),
    /pending additional shifts/i,
  );
  assert.ok(transactionReads.includes(legacyPath));
  assert.ok(transactionReads.includes("houses/A/payments/c1__additional_day_2026-10-05"));
  assert.equal(commits.length, 0);
});

test("a caregiver whose data can't be decrypted is never overwritten", async () => {
  // Stored with another key, e.g. a tampered or misplaced record
  storeCaregiver("A", keys.B);
  await FirestoreService.initialize("u1", "A");

  await assert.rejects(
    FirestoreService.updateCaregiver("c1", { disabled: true }),
    LockedRecordError,
  );
  assert.equal(commits.length, 0);
});

test("paid shifts and their history entry are written in one transaction", async () => {
  storeCaregiver("A");
  await FirestoreService.initialize("u1", "A");
  await FirestoreService.recordPayment("c1", "Semanal", ["k1", "k2"], {
    caregiverId: "c1",
    caregiverName: "Ana",
    date: "2026-10-05T00:00:00.000Z",
    frequency: "Semanal",
    description: "Semana",
    amount: 400,
    paidAt: "2026-10-05T00:00:00.000Z",
    managerName: "Gerente",
    periodKey: "2026-10-03",
    paymentKeys: ["k1", "k2"],
    historyKey: "c1::2026-10-03",
  });

  assert.equal(commits.length, 1);
  const paths = commits[0].map((op) => op.path);
  assert.deepEqual(paths, [
    "houses/A/payments/c1__k1",
    "houses/A/payments/c1__k2",
    "houses/A/paymentHistory/c1__2026-10-03",
  ]);
  const history = commits[0][2].data!;
  assert.equal(
    decryptValue(keys.A, history.amount, "houses/A/paymentHistory/c1__2026-10-03#amount"),
    400,
  );
});

test("a stale payment cannot overwrite an already paid shift", async () => {
  storeCaregiver("A");
  await FirestoreService.initialize("u1", "A");
  stored.set("houses/A/payments/c1__k1", { paymentKey: "k1", caregiverId: "c1" });
  await assert.rejects(
    FirestoreService.recordPayment("c1", "Semanal", ["k1", "k2"], null),
    /already paid/,
  );
  assert.equal(commits.length, 0);
});

test("changing payment frequency cannot pay the same physical shift twice", async () => {
  storeCaregiver("A");
  await FirestoreService.initialize("u1", "A");
  const date = new Date(2026, 9, 5, 12);
  const weekly = buildPaymentKey({ date, shift: "day", frequency: "Semanal" });
  const monthly = buildPaymentKey({ date, shift: "day", frequency: "Mensal" });
  await FirestoreService.recordPayment("c1", "Semanal", [weekly], null);
  await assert.rejects(
    FirestoreService.recordPayment("c1", "Mensal", [monthly], null),
    /already paid/,
  );
  assert.equal(commits.length, 1);
});

test("a newly unreadable rate is rejected even before the UI receives its snapshot", async () => {
  storeCaregiver("A", keys.B);
  await FirestoreService.initialize("u1", "A");
  await assert.rejects(
    FirestoreService.recordPayment("c1", "Semanal", ["k1"], null),
    LockedRecordError,
  );
  assert.equal(commits.length, 0);
});

test("an unreadable caregiver can be disabled without overwriting its encrypted rates", async () => {
  storeCaregiver("A", keys.B);
  await FirestoreService.initialize("u1", "A");
  await FirestoreService.disableCaregiver("c1");
  assert.equal(commits.length, 1);
  assert.equal(commits[0][0].type, "update");
  assert.equal(commits[0][0].data!.disabled, true);
  assert.equal("amount" in commits[0][0].data!, false);
  assert.equal("name" in commits[0][0].data!, false);
});

test("unverified account export and deletion never query email-based grants", async () => {
  await FirestoreService.exportUserData("u1", "unverified@example.com", false);
  await FirestoreService.deleteUserAccount("u1", "unverified@example.com", false);
  assert.equal(
    queries.some((args) =>
      args.some((value) => Array.isArray(value) && ["email", "invitedEmail"].includes(value[0])),
    ),
    false,
  );
});

test("conflicting legacy membership roles are rejected without losing either original record", async () => {
  queryResults = ["owner", "manager"].map((role, index) => ({
    id: `legacy-${index}`,
    ref: ref(`user_house_access/legacy-${index}`),
    data: () => ({ userId: "u1", houseId: "A", role, addedAt: "now" }),
  }));
  const state = await FirestoreService.getUserHouseState("u1");
  assert.deepEqual(state.houses, []);
  assert.deepEqual(state.issues, [{ houseId: "A", reason: "conflicting-access" }]);
  assert.equal(commits.length, 0);
});

test("large sets of consistent legacy memberships are migrated in bounded batches", async () => {
  stored.set("houses/A", { id: "A", createdBy: "u1", managers: [] });
  queryResults = Array.from({ length: 520 }, (_, index) => ({
    id: `legacy-${index}`,
    ref: ref(`user_house_access/legacy-${index}`),
    data: () => ({ userId: "u1", houseId: "A", role: "owner", addedAt: "now" }),
  }));
  assert.equal((await FirestoreService.getUserHouses("u1")).length, 1);
  assert.ok(commits.length > 1);
  assert.ok(commits.every((operations) => operations.length <= 500));
  assert.equal(commits.flat().filter((operation) => operation.type === "set").length, 1);
  assert.equal(commits.flat().filter((operation) => operation.type === "delete").length, 520);
});
