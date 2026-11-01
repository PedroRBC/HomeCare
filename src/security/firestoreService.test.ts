/** Application services against real Firestore transactions and the production rules.
 * Only the native SDK bridge and optional crash reporting are replaced.
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "bun:test";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import * as firestore from "firebase/firestore";
import { decryptValue, importDataKey, isEncryptedValue } from "@/utils/fieldCrypto";
import { buildPaymentKey } from "@/utils/paymentDomain";
import { localEndpoint, setFirestoreEmulatorRules } from "../migrations/emulator";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const emulator = process.env.FIRESTORE_EMULATOR_HOST
  ? localEndpoint(process.env.FIRESTORE_EMULATOR_HOST, "FIRESTORE_EMULATOR_HOST")
  : undefined;
const setRules = (rules: string) =>
  setFirestoreEmulatorRules(emulator!, "demo-homecare-services", rules);
if (!emulator && process.env.REQUIRE_FIRESTORE_EMULATOR)
  throw new Error("Firestore emulator required");
let env: RulesTestEnvironment;
let db: firestore.Firestore;
let currentUid = "owner";
let afterCaregiverLinksRead: (() => Promise<void>) | undefined;
let paymentQueryGate: {
  entered: () => void;
  enteredPromise: Promise<void>;
  wait: Promise<void>;
  release: () => void;
} | null = null;
const pauseNextPaymentQuery = () => {
  let entered!: () => void;
  let release!: () => void;
  const gate = {
    enteredPromise: new Promise<void>((resolve) => (entered = resolve)),
    wait: new Promise<void>((resolve) => (release = resolve)),
    entered: () => entered(),
    release: () => release(),
  };
  paymentQueryGate = gate;
  return gate;
};
mock.module("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: currentUid } }),
}));
mock.module("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
mock.module("@react-native-firebase/firestore", () => ({
  ...firestore,
  getFirestore: () => db,
  getDocs: async (reference: any) => {
    const snapshot = await firestore.getDocs(reference);
    if (
      afterCaregiverLinksRead &&
      snapshot.docs.some((record) => record.ref.parent.id === "caregiver_links")
    ) {
      const checkpoint = afterCaregiverLinksRead;
      afterCaregiverLinksRead = undefined;
      await checkpoint();
    }
    const gate = paymentQueryGate;
    if (gate && snapshot.docs.some((record) => record.ref.parent.id === "payments")) {
      paymentQueryGate = null;
      gate.entered();
      await gate.wait;
    }
    return snapshot;
  },
}));
mock.module("@/services/firebase", () => ({
  CrashlyticsService: { log: () => {}, logError: () => {} },
}));
const { FirestoreService, HouseAccessRepairError } = await import("@/services/firestore");
const { getNoteKey, ShiftNotesService } = await import("@/services/shiftNotes");
let houseId: string;

const caregiver = (email = "") => ({
  name: "Ana Private",
  frequency: "Semanal" as const,
  amount: 200,
  dayAmount: 200,
  nightAmount: 250,
  additionalAmount: 30,
  email,
});
const history = (caregiverId: string, paymentKeys: string[]) => ({
  caregiverId,
  caregiverName: "Ana Private",
  date: "2026-10-06T00:00:00.000Z",
  frequency: "Semanal",
  description: "Private payment",
  amount: 200,
  paidAt: "2026-10-06T00:00:00.000Z",
  managerName: "Owner",
  periodKey: "2026-10-03",
  paymentKeys,
  historyKey: `${caregiverId}::2026-10-03`,
});
const documents = (collectionName: string) =>
  firestore.getDocs(firestore.collection(db, `houses/${houseId}/${collectionName}`));

(emulator ? describe : describe.skip)("FirestoreService integration", () => {
  before(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-homecare-services",
      firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") },
    });
  });
  after(() => env?.cleanup());
  beforeEach(async () => {
    FirestoreService.cleanup();
    paymentQueryGate = null;
    afterCaregiverLinksRead = undefined;
    await env.clearFirestore();
    currentUid = "owner";
    db = env
      .authenticatedContext("owner", { email: "owner@example.com", email_verified: true })
      .firestore() as unknown as firestore.Firestore;
    await FirestoreService.createUserProfile("owner", "owner@example.com", "Owner");
    houseId = (await FirestoreService.createHouse({ name: "Service House", createdBy: "owner" }))
      .id;
    await FirestoreService.initialize("owner", houseId, "Service House");
  });

  test("schedule access repairs a disabled pointer before clinical keys and shared notes initialize", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as firestore.Firestore;
      for (const [id, disabled] of [
        ["c1", false],
        ["old", true],
      ] as const) {
        await firestore.setDoc(firestore.doc(admin, `caregiver_links/${houseId}__${id}`), {
          houseId,
          caregiverId: id,
          email: "cg@example.com",
          status: "accepted",
          disabled,
        });
      }
      await firestore.setDoc(firestore.doc(admin, `caregiver_access/${houseId}_cg`), {
        userId: "cg",
        houseId,
        linkId: `${houseId}__old`,
      });
      await firestore.setDoc(firestore.doc(admin, `houses/${houseId}/schedule/2026-10-31`), {
        day: ["c1"],
        night: [],
      });
    });
    currentUid = "cg";
    db = env
      .authenticatedContext("cg", { email: "cg@example.com", email_verified: true })
      .firestore() as unknown as firestore.Firestore;
    await assert.rejects(getNoteKey(houseId, "cg", true));
    await new Promise<void>((resolve, reject) => {
      const off = FirestoreService.subscribeToHouseSchedule(
        houseId,
        { userId: "cg", linkId: `${houseId}__c1` },
        () => {
          off();
          resolve();
        },
        reject,
      );
    });
    const access = (
      await firestore.getDoc(firestore.doc(db, `caregiver_access/${houseId}_cg`))
    ).data()!;
    assert.equal(access.linkId, `${houseId}__c1`);
    const clinicalKey = await getNoteKey(houseId, "cg", true);
    assert.equal(clinicalKey.length, 32);
    assert.equal((await getNoteKey(houseId, "cg")).length, 32);
    const context = { houseId, date: "2026-10-31", shift: "day" as const };
    const handover = {
      kind: "handover" as const,
      medication: true,
      meals: false,
      activities: false,
      pending: [],
      observations: "Synthetic clinical note",
    };
    await ShiftNotesService.save(context, "cg", clinicalKey, handover, `${houseId}__c1`);
    assert.equal(
      (
        await firestore.getDocs(
          firestore.query(
            firestore.collection(db, `houses/${houseId}/shiftNotes`),
            firestore.where("kind", "==", "handover"),
          ),
        )
      ).size,
      1,
    );
    await assert.rejects(
      ShiftNotesService.save(
        { ...context, shift: "night" },
        "cg",
        clinicalKey,
        handover,
        `${houseId}__c1`,
      ),
    );
    // A failed pointer write must surface even if the previously saved pointer could read the schedule.
    await new Promise<void>((resolve, reject) => {
      const off = FirestoreService.subscribeToHouseSchedule(
        houseId,
        { userId: "cg", linkId: `${houseId}__missing` },
        () => {
          off();
          reject(new Error("Access failure was hidden"));
        },
        () => {
          off();
          resolve();
        },
      );
    });
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          `caregiver_links/${houseId}__c1`,
        ),
        { disabled: true },
      ),
    );
    await assert.rejects(getNoteKey(houseId, "cg", true));
    await assert.rejects(
      firestore.getDocs(
        firestore.query(
          firestore.collection(db, `houses/${houseId}/shiftNotes`),
          firestore.where("kind", "==", "handover"),
        ),
      ),
    );
  });

  test("caregiver creation encrypts server fields and email removal immediately revokes access", async () => {
    const id = await FirestoreService.addCaregiver(caregiver("ana@example.com"));
    const path = `houses/${houseId}/caregivers/${id}`;
    const stored = (await firestore.getDoc(firestore.doc(db, path))).data()!;
    assert.ok(isEncryptedValue(stored.name));
    assert.ok(isEncryptedValue(stored.email));
    const key = importDataKey(
      (await firestore.getDoc(firestore.doc(db, "house_keys", houseId))).data()!.key,
    );
    assert.equal(decryptValue(key, stored.amount, `${path}#amount`), 200);
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    const ownerDb = db;
    db = env
      .authenticatedContext("ana", { email: "ana@example.com", email_verified: true })
      .firestore() as unknown as firestore.Firestore;
    await FirestoreService.respondToCaregiverLink(`${houseId}__${id}`, "accepted", "ana");
    await documents("schedule");
    db = ownerDb;
    await FirestoreService.updateCaregiver(id, { email: "" });
    const ana = env
      .authenticatedContext("ana", { email: "ana@example.com", email_verified: true })
      .firestore() as unknown as firestore.Firestore;
    await assert.rejects(
      firestore.getDocs(firestore.collection(ana, `houses/${houseId}/schedule`)),
      /permission/i,
    );
    assert.equal(
      (await firestore.getDoc(firestore.doc(db, "caregiver_links", `${houseId}__${id}`))).exists(),
      false,
    );
  });

  test("concurrent schedule assignments preserve both caregivers", async () => {
    const a = await FirestoreService.addCaregiver(caregiver());
    const b = await FirestoreService.addCaregiver({ ...caregiver(), name: "B" });
    await Promise.all([
      FirestoreService.updateDaySchedule("2026-10-06", a, "day", false, true),
      FirestoreService.updateDaySchedule("2026-10-06", b, "day", false, true),
    ]);
    const day = (
      await firestore.getDoc(firestore.doc(db, `houses/${houseId}/schedule/2026-10-06`))
    ).data()!;
    assert.deepEqual(new Set(day.day), new Set([a, b]));
  });

  test("concurrent payments produce one marker and one history, and reversal removes both", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    const keys = [
      buildPaymentKey({ date: new Date(2026, 9, 6, 12), shift: "day", frequency: "Semanal" }),
    ];
    const results = await Promise.allSettled([
      FirestoreService.recordPayment(id, "Semanal", keys, history(id, keys)),
      FirestoreService.recordPayment(id, "Semanal", keys, history(id, keys)),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await documents("payments")).size, 1);
    const entries = await documents("paymentHistory");
    assert.equal(entries.size, 1);
    assert.ok(isEncryptedValue(entries.docs[0].data().amount));
    await FirestoreService.deletePaymentRecord(entries.docs[0].id, id, keys);
    assert.equal((await documents("payments")).size, 0);
    assert.equal((await documents("paymentHistory")).size, 0);
  });

  test("a denied history write leaves no paid markers", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    const rules = readFileSync("firestore.rules", "utf8").replace(
      "allow create: if isMember(houseId) && startsEncryptedRecord(collectionName);",
      "allow create: if collectionName != 'paymentHistory' && isMember(houseId) && startsEncryptedRecord(collectionName);",
    );
    await setRules(rules);
    try {
      await assert.rejects(
        FirestoreService.recordPayment(id, "Semanal", ["k1"], history(id, ["k1"])),
        /permission/i,
      );
      assert.equal((await documents("payments")).size, 0);
      assert.equal((await documents("paymentHistory")).size, 0);
    } finally {
      await setRules(readFileSync("firestore.rules", "utf8"));
    }
  });

  test("additional assignment requires a regular shift and protects paid add-ons from removal", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await assert.rejects(
      FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true),
      /regular shift is required/i,
    );
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true);

    const paymentKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
      mode: "additional",
    });
    await assert.rejects(
      FirestoreService.recordPayment(id, "Semanal", [paymentKey], history(id, [paymentKey]), {
        dayRate: 200,
        nightRate: 250,
        additionalRate: 29,
      }),
      /rates changed/i,
    );
    assert.equal((await documents("payments")).size, 0);

    const entry = {
      ...history(id, [paymentKey]),
      amount: 30,
      dayRate: 200,
      nightRate: 250,
      additionalRate: 30,
    };
    await FirestoreService.recordPayment(id, "Semanal", [paymentKey], entry, {
      dayRate: 200,
      nightRate: 250,
      additionalRate: 30,
    });
    const storedHistory = (await documents("paymentHistory")).docs[0].data();
    assert.ok(isEncryptedValue(storedHistory.dayRate));
    assert.ok(isEncryptedValue(storedHistory.nightRate));
    assert.ok(isEncryptedValue(storedHistory.additionalRate));

    await assert.rejects(
      FirestoreService.updateShiftAdditional("2026-10-06", id, "day", false),
      /already paid/i,
    );
    await assert.rejects(
      FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, false),
      /already paid/i,
    );

    await FirestoreService.deletePaymentRecord((await documents("paymentHistory")).docs[0].id, id, [
      paymentKey,
    ]);
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, false);
    const schedule = (
      await firestore.getDoc(firestore.doc(db, `houses/${houseId}/schedule/2026-10-06`))
    ).data()!;
    assert.deepEqual(schedule.day, []);
    assert.deepEqual(schedule.dayAdditional, []);
  });

  test("reversing a paid add-on after clearing its rate rolls back history and every marker", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true);
    const regularKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
    });
    const additionalKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
      mode: "additional",
    });
    await FirestoreService.recordPayment(
      id,
      "Semanal",
      [regularKey, additionalKey],
      history(id, [regularKey, additionalKey]),
    );
    await FirestoreService.updateCaregiver(id, { additionalAmount: 0 });

    const mixedHistory = (await documents("paymentHistory")).docs[0];
    await assert.rejects(
      FirestoreService.deletePaymentRecord(mixedHistory.id, id, [regularKey, additionalKey]),
      (error: Error) =>
        error.message === "Configure a positive additional amount before reversing this payment",
    );
    assert.equal((await documents("paymentHistory")).size, 1);
    const marks = await documents("payments");
    assert.equal(marks.size, 2);
    assert.deepEqual(
      new Set(marks.docs.map((record) => record.data().paymentKey)),
      new Set([regularKey, additionalKey]),
    );
  });

  test("positive rate reversal reopens only the additional payment component", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true);
    const regularKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
    });
    const additionalKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
      mode: "additional",
    });
    await FirestoreService.recordPayment(id, "Semanal", [regularKey], history(id, [regularKey]));
    await FirestoreService.recordPayment(id, "Semanal", [additionalKey], {
      ...history(id, [additionalKey]),
      historyKey: `${id}::additional`,
    });
    const additionalHistory = (await documents("paymentHistory")).docs.find(
      (record) => record.data().historyKey === `${id}::additional`,
    )!;
    await FirestoreService.updateCaregiver(id, { additionalAmount: 0 });
    await FirestoreService.updateCaregiver(id, { additionalAmount: 30 });

    await FirestoreService.deletePaymentRecord(additionalHistory.id, id, [additionalKey]);
    const marks = await documents("payments");
    assert.equal(marks.size, 1);
    assert.equal(marks.docs[0].data().paymentKey, regularKey);
    assert.equal((await documents("paymentHistory")).size, 1);
    await assert.rejects(
      FirestoreService.recordPayment(id, "Semanal", [regularKey], null),
      /already paid/i,
    );
    await FirestoreService.recordPayment(id, "Semanal", [additionalKey], null);
  });

  test("reversal remains allowed when an additional key no longer has a schedule flag", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true);
    const key = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
      mode: "additional",
    });
    await FirestoreService.recordPayment(id, "Semanal", [key], history(id, [key]));
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      await firestore.updateDoc(firestore.doc(admin, `houses/${houseId}/schedule/2026-10-06`), {
        dayAdditional: [],
      });
    });
    await FirestoreService.updateCaregiver(id, { additionalAmount: 0 });
    const entry = (await documents("paymentHistory")).docs[0];

    await FirestoreService.deletePaymentRecord(entry.id, id, [key]);
    assert.equal((await documents("payments")).size, 0);
    assert.equal((await documents("paymentHistory")).size, 0);
  });

  test("reversal does not delete a canonical marker for another historical payment key", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    const weeklyKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
    });
    const monthlyKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Mensal",
    });
    await FirestoreService.recordPayment(id, "Mensal", [monthlyKey], history(id, [monthlyKey]));
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      await firestore.setDoc(firestore.doc(admin, `houses/${houseId}/payments/legacy-weekly`), {
        caregiverId: id,
        paymentKey: weeklyKey,
      });
      await firestore.setDoc(
        firestore.doc(admin, `houses/${houseId}/paymentHistory/legacy-weekly`),
        {
          caregiverId: id,
          paymentKeys: [weeklyKey],
        },
      );
    });

    await FirestoreService.deletePaymentRecord("legacy-weekly", id, [weeklyKey]);
    const remaining = await documents("payments");
    assert.equal(remaining.size, 1);
    assert.equal(remaining.docs[0].data().paymentKey, monthlyKey);
    assert.equal((await documents("paymentHistory")).size, 1);
  });

  test("clearing revalidates a stale canonical and legacy query after reversal commits", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true);
    await FirestoreService.updateDaySchedule("2026-10-07", id, "night", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-07", id, "night", true);
    const canonicalKey = buildPaymentKey({
      date: new Date(2026, 9, 6, 12),
      shift: "day",
      frequency: "Semanal",
      mode: "additional",
    });
    const legacyKey = buildPaymentKey({
      date: new Date(2026, 9, 7, 12),
      shift: "night",
      frequency: "Semanal",
      mode: "additional",
    });
    await FirestoreService.recordPayment(
      id,
      "Semanal",
      [canonicalKey, legacyKey],
      history(id, [canonicalKey, legacyKey]),
    );
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      await firestore.setDoc(firestore.doc(admin, `houses/${houseId}/payments/old-additional`), {
        caregiverId: id,
        paymentKey: legacyKey,
      });
    });
    const entry = (await documents("paymentHistory")).docs[0];
    const gate = pauseNextPaymentQuery();
    const clearing = FirestoreService.updateCaregiver(id, { additionalAmount: 0 });
    await gate.enteredPromise;
    try {
      await FirestoreService.deletePaymentRecord(entry.id, id, [canonicalKey, legacyKey]);
    } finally {
      gate.release();
    }
    await assert.rejects(clearing, /pending additional shifts/i);
    assert.equal((await documents("paymentHistory")).size, 0);
    assert.equal((await documents("payments")).size, 0);
    const caregiverPath = `houses/${houseId}/caregivers/${id}`;
    const stored = (await firestore.getDoc(firestore.doc(db, caregiverPath))).data()!;
    const key = importDataKey(
      (await firestore.getDoc(firestore.doc(db, "house_keys", houseId))).data()!.key,
    );
    assert.equal(
      decryptValue(key, stored.additionalAmount, `${caregiverPath}#additionalAmount`),
      30,
    );
  });

  test("clearing additional amount is rejected while an add-on remains unpaid", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await FirestoreService.updateDaySchedule("2026-10-06", id, "night", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "night", true);
    await assert.rejects(
      FirestoreService.updateCaregiver(id, { additionalAmount: 0 }),
      /pending additional shifts/i,
    );
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "night", false);
    await FirestoreService.updateCaregiver(id, { additionalAmount: 0 });
    const stored = (
      await firestore.getDoc(firestore.doc(db, `houses/${houseId}/caregivers/${id}`))
    ).data()!;
    assert.ok(isEncryptedValue(stored.additionalAmount));
  });

  test("a failed caregiver-link write rolls back a concurrent additional-amount clear", async () => {
    const id = await FirestoreService.addCaregiver(caregiver("ana@example.com"));
    const originalRules = readFileSync("firestore.rules", "utf8");
    const ruleToChange =
      "return after == 'pending'\n        || (after == before && request.resource.data.email == resource.data.email);";
    assert.ok(originalRules.includes(ruleToChange));
    const failingRules = originalRules.replace(ruleToChange, "return false;");
    await setRules(failingRules);
    try {
      await assert.rejects(
        FirestoreService.updateCaregiver(id, {
          name: "Changed Name",
          email: "new@example.com",
          disabled: true,
          additionalAmount: 0,
        }),
        /permission/i,
      );
      const caregiverPath = `houses/${houseId}/caregivers/${id}`;
      const storedCaregiver = (await firestore.getDoc(firestore.doc(db, caregiverPath))).data()!;
      const key = importDataKey(
        (await firestore.getDoc(firestore.doc(db, "house_keys", houseId))).data()!.key,
      );
      assert.equal(decryptValue(key, storedCaregiver.name, `${caregiverPath}#name`), "Ana Private");
      assert.equal(
        decryptValue(key, storedCaregiver.email, `${caregiverPath}#email`),
        "ana@example.com",
      );
      assert.equal(
        decryptValue(key, storedCaregiver.additionalAmount, `${caregiverPath}#additionalAmount`),
        30,
      );
      assert.equal(storedCaregiver.disabled, undefined);
      const storedLink = (
        await firestore.getDoc(firestore.doc(db, "caregiver_links", `${houseId}__${id}`))
      ).data()!;
      assert.equal(storedLink.email, "ana@example.com");
      assert.equal(storedLink.caregiverName, "Ana Private");
    } finally {
      await setRules(originalRules);
    }
  });

  test("additional amounts reject non-finite and negative values", async () => {
    await assert.rejects(FirestoreService.addCaregiver({ ...caregiver(), additionalAmount: -1 }));
    await assert.rejects(
      FirestoreService.addCaregiver({ ...caregiver(), additionalAmount: Number.NaN }),
    );
  });

  test("legacy invitations can be replaced through the actual sending service", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await firestore.setDoc(
        firestore.doc(
          context.firestore() as unknown as firestore.Firestore,
          "house_invitations",
          "legacy",
        ),
        {
          id: "legacy",
          houseId,
          invitedBy: "owner",
          invitedEmail: "guest@example.com",
          status: "pending",
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      );
    });
    await FirestoreService.sendHouseInvitation(houseId, "guest@example.com", "owner", "Owner");
    const invitations = await firestore.getDocs(
      firestore.query(
        firestore.collection(db, "house_invitations"),
        firestore.where("houseId", "==", houseId),
      ),
    );
    assert.equal(invitations.size, 1);
    assert.notEqual(invitations.docs[0].id, "legacy");
    assert.ok(invitations.docs[0].data().expiresAtTs instanceof firestore.Timestamp);
  });

  test("personal export preserves additional flags for an accepted caregiver link", async () => {
    const id = await FirestoreService.addCaregiver(caregiver("ana@example.com"));
    await FirestoreService.updateDaySchedule("2026-10-06", id, "day", false, true);
    await FirestoreService.updateShiftAdditional("2026-10-06", id, "day", true);
    await FirestoreService.updateDaySchedule("2026-10-07", id, "night", true, true);
    await FirestoreService.updateDaySchedule("2026-10-08", id, "day", false, true);
    const otherId = await FirestoreService.addCaregiver(caregiver("other@example.com"));
    await FirestoreService.updateDaySchedule("2026-10-08", otherId, "day", false, true);
    await FirestoreService.updateDaySchedule("2026-10-09", otherId, "night", false, true);

    const ownerDb = db;
    currentUid = "ana";
    db = env
      .authenticatedContext("ana", { email: "ana@example.com", email_verified: true })
      .firestore() as unknown as firestore.Firestore;
    await FirestoreService.respondToCaregiverLink(`${houseId}__${id}`, "accepted", "ana");
    const exported = await FirestoreService.exportUserData("ana", "ana@example.com", true);
    assert.equal(exported.caregiverLinks.length, 1);
    const link = exported.caregiverLinks[0];
    assert.deepEqual(link.shifts, [
      { date: "2026-10-06", shift: "day", extra: false, additional: true },
      { date: "2026-10-07", shift: "night", extra: true },
      { date: "2026-10-08", shift: "day", extra: false },
    ]);
    assert.equal("additionalAmount" in link, false);
    db = ownerDb;
    currentUid = "owner";
  });

  for (const activeId of ["c1", "c2"]) {
    test(`personal export keeps the active access link when ${activeId} is active, retaining both histories`, async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const admin = ctx.firestore() as unknown as firestore.Firestore;
        for (const caregiverId of ["c1", "c2"]) {
          await firestore.setDoc(
            firestore.doc(admin, `caregiver_links/${houseId}__${caregiverId}`),
            {
              houseId,
              houseName: "Synthetic House",
              caregiverId,
              caregiverName: caregiverId,
              email: "cg@example.com",
              status: "accepted",
              disabled: caregiverId !== activeId,
            },
          );
        }
        await firestore.setDoc(firestore.doc(admin, `houses/${houseId}/schedule/2026-10-31`), {
          day: ["c1"],
          night: ["c2"],
        });
        await firestore.setDoc(firestore.doc(admin, `caregiver_access/${houseId}_cg`), {
          userId: "cg",
          houseId,
          linkId: `${houseId}__${activeId}`,
        });
      });
      currentUid = "cg";
      db = env
        .authenticatedContext("cg", { email: "cg@example.com", email_verified: true })
        .firestore() as unknown as firestore.Firestore;
      const key = await getNoteKey(houseId, "cg", true);
      const clinical = {
        kind: "handover" as const,
        medication: true,
        meals: false,
        activities: false,
        pending: [],
        observations: "Export must preserve clinical access",
      };
      await ShiftNotesService.save(
        { houseId, date: "2026-10-31", shift: activeId === "c1" ? "day" : "night" },
        "cg",
        key,
        clinical,
        `${houseId}__${activeId}`,
      );
      const exported = await FirestoreService.exportUserData("cg", "cg@example.com", true);
      assert.equal(exported.caregiverLinks.length, 2);
      for (const id of ["c1", "c2"]) {
        const link = exported.caregiverLinks.find((link) => link.caregiverId === id)!;
        assert.ok(link);
        assert.deepEqual(link.shifts, [
          { date: "2026-10-31", shift: id === "c1" ? "day" : "night", extra: false },
        ]);
      }
      const access = (
        await firestore.getDoc(firestore.doc(db, `caregiver_access/${houseId}_cg`))
      ).data()!;
      assert.equal(access.linkId, `${houseId}__${activeId}`);
      assert.deepEqual(await getNoteKey(houseId, "cg", true), key);
      assert.equal(
        (
          await firestore.getDocs(
            firestore.query(
              firestore.collection(db, `houses/${houseId}/shiftNotes`),
              firestore.where("kind", "==", "handover"),
            ),
          )
        ).size,
        1,
      );
    });
  }

  test("concurrent link activation during export cannot restore a stale disabled access pointer", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as firestore.Firestore;
      for (const caregiverId of ["c1", "c2"]) {
        await firestore.setDoc(firestore.doc(admin, `caregiver_links/${houseId}__${caregiverId}`), {
          houseId,
          houseName: "Synthetic House",
          caregiverId,
          caregiverName: caregiverId,
          email: "cg@example.com",
          status: "accepted",
          disabled: caregiverId !== "c1",
        });
      }
      await firestore.setDoc(firestore.doc(admin, `houses/${houseId}/schedule/2026-10-31`), {
        day: ["c1"],
        night: ["c2"],
      });
      await firestore.setDoc(firestore.doc(admin, `caregiver_access/${houseId}_cg`), {
        userId: "cg",
        houseId,
        linkId: `${houseId}__c1`,
      });
    });
    currentUid = "cg";
    db = env
      .authenticatedContext("cg", { email: "cg@example.com", email_verified: true })
      .firestore() as unknown as firestore.Firestore;
    const key = await getNoteKey(houseId, "cg", true);
    afterCaregiverLinksRead = async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const admin = ctx.firestore() as unknown as firestore.Firestore;
        const batch = firestore.writeBatch(admin);
        batch.update(firestore.doc(admin, `caregiver_links/${houseId}__c1`), { disabled: true });
        batch.update(firestore.doc(admin, `caregiver_links/${houseId}__c2`), { disabled: false });
        await batch.commit();
      });
      await firestore.setDoc(firestore.doc(db, `caregiver_access/${houseId}_cg`), {
        userId: "cg",
        houseId,
        linkId: `${houseId}__c2`,
      });
    };
    const exported = await FirestoreService.exportUserData("cg", "cg@example.com", true);
    assert.equal(afterCaregiverLinksRead, undefined);
    assert.equal(exported.caregiverLinks.length, 2);
    assert.ok(exported.caregiverLinks.every((link) => (link.shifts as unknown[]).length === 1));
    const access = (
      await firestore.getDoc(firestore.doc(db, `caregiver_access/${houseId}_cg`))
    ).data()!;
    assert.equal(access.linkId, `${houseId}__c2`);
    assert.deepEqual(await getNoteKey(houseId, "cg", true), key);
    await assert.rejects(
      firestore.setDoc(firestore.doc(db, `caregiver_access/${houseId}_cg`), {
        userId: "cg",
        houseId,
        linkId: `${houseId}__c1`,
      }),
    );
    // With no active link, both disabled histories still export without clinical access.
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          `caregiver_links/${houseId}__c2`,
        ),
        { disabled: true },
      ),
    );
    const historical = await FirestoreService.exportUserData("cg", "cg@example.com", true);
    assert.equal(historical.caregiverLinks.length, 2);
    assert.ok(historical.caregiverLinks.every((link) => (link.shifts as unknown[]).length === 1));
    await assert.rejects(getNoteKey(houseId, "cg", true));
  });

  test("full personal export retains malformed-key message ciphertext and healthy house data", async () => {
    const id = await FirestoreService.addCaregiver(caregiver());
    await FirestoreService.updateDaySchedule("2026-10-31", id, "day", false, true);
    const key = await getNoteKey(houseId, "owner");
    await ShiftNotesService.save(
      { houseId, date: "2026-10-31", shift: "day" },
      "owner",
      key,
      { kind: "message", text: "Synthetic private instruction" },
      null,
    );
    const notes = await firestore.getDocs(
      firestore.query(
        firestore.collection(db, `houses/${houseId}/shiftNotes`),
        firestore.where("kind", "==", "message"),
      ),
    );
    const ciphertext = notes.docs[0].data().payload;
    await env.withSecurityRulesDisabled((ctx) =>
      firestore.updateDoc(
        firestore.doc(
          ctx.firestore() as unknown as firestore.Firestore,
          `shift_note_keys/${houseId}`,
        ),
        { key: "a".repeat(44) },
      ),
    );
    const exported = await FirestoreService.exportUserData("owner", "owner@example.com", true);
    assert.equal(exported.houses.length, 1);
    assert.equal(exported.houses[0].caregivers[0].name, "Ana Private");
    const houseNotes = exported.houses[0].shiftNotes as Record<string, unknown>[];
    assert.equal(houseNotes.length, 1);
    assert.equal(houseNotes[0].readable, false);
    assert.equal(houseNotes[0].encryptedPayload, ciphertext);
    assert.equal(exported.shiftNotes[0].encryptedPayload, ciphertext);
  });

  test("an orphaned legacy owner grant does not block valid houses or explicitly partial export", async () => {
    await FirestoreService.addCaregiver(caregiver());
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      await firestore.setDoc(firestore.doc(admin, "user_house_access", "orphan-owner"), {
        userId: "owner",
        houseId: "deleted-house",
        role: "owner",
        addedAt: "2026-10-01T00:00:00.000Z",
      });
    });
    const state = await FirestoreService.getUserHouseState("owner");
    assert.equal(state.houses.length, 1);
    assert.equal(state.houses[0].id, houseId);
    assert.deepEqual(state.issues, [{ houseId: "deleted-house", reason: "migration-failed" }]);
    const exported = await FirestoreService.exportUserData("owner", "owner@example.com", true);
    assert.equal(exported.houses.length, 1);
    assert.equal(exported.complete, false);
    assert.deepEqual(exported.unavailableHouses, state.issues);
    await assert.rejects(
      FirestoreService.deleteUserAccount("owner", "owner@example.com", true),
      HouseAccessRepairError,
    );
    assert.equal((await firestore.getDoc(firestore.doc(db, "users", "owner"))).exists(), true);
    assert.equal((await firestore.getDoc(firestore.doc(db, "house_keys", houseId))).exists(), true);
  });

  test("a confirmed missing manager house does not strand account deletion or erase others' data", async () => {
    await FirestoreService.addCaregiver(caregiver());
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      await firestore.setDoc(firestore.doc(admin, "users/manager"), { id: "manager" });
      await firestore.setDoc(firestore.doc(admin, "user_house_access/legacy-manager"), {
        userId: "manager",
        houseId: "deleted-house",
        role: "manager",
      });
    });
    const ownerDb = db;
    currentUid = "manager";
    db = env.authenticatedContext("manager").firestore() as unknown as firestore.Firestore;
    const state = await FirestoreService.getUserHouseState("manager");
    assert.deepEqual(state.issues, [{ houseId: "deleted-house", reason: "missing-house" }]);
    await FirestoreService.deleteUserAccount("manager", null);
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      assert.equal((await firestore.getDoc(firestore.doc(admin, "users/manager"))).exists(), false);
      assert.equal(
        (
          await firestore.getDocs(
            firestore.query(
              firestore.collection(admin, "user_house_access"),
              firestore.where("userId", "==", "manager"),
            ),
          )
        ).size,
        0,
      );
    });
    db = ownerDb;
    assert.equal((await firestore.getDoc(firestore.doc(db, "houses", houseId))).exists(), true);
    assert.equal((await documents("caregivers")).size, 1);
    assert.equal((await firestore.getDoc(firestore.doc(db, "house_keys", houseId))).exists(), true);
  });

  test("a missing owned house still refuses deletion before erasing any profile or active data", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await firestore.setDoc(
        firestore.doc(
          context.firestore() as unknown as firestore.Firestore,
          "user_house_access/deleted-house_owner",
        ),
        {
          userId: "owner",
          houseId: "deleted-house",
          role: "owner",
        },
      );
    });
    const state = await FirestoreService.getUserHouseState("owner");
    assert.deepEqual(state.issues, [{ houseId: "deleted-house", reason: "missing-house" }]);
    await assert.rejects(
      FirestoreService.deleteUserAccount("owner", "owner@example.com", true),
      HouseAccessRepairError,
    );
    assert.equal((await firestore.getDoc(firestore.doc(db, "users/owner"))).exists(), true);
    assert.equal((await firestore.getDoc(firestore.doc(db, "houses", houseId))).exists(), true);
  });

  test("personal export and account deletion cover multiple pages of only the author's reports", async () => {
    const { makeReportContent } = await import("@/feedback/report");
    const content = makeReportContent(
      {
        type: "feedback",
        title: "Calendar feedback",
        description: "Make the calendar easier to navigate.",
        steps: "",
        expected: "",
        actual: "",
      },
      "owner",
      { appVersion: null, appBuild: null, platform: "android", osVersion: "15", language: "en" },
    );
    const batch = firestore.writeBatch(db);
    for (let index = 0; index < 55; index++) {
      batch.set(firestore.doc(db, "feedback_reports", `report-${index}`), {
        ...content,
        status: "open",
        issueUrl: null,
        reviewerUid: null,
        createdAt: firestore.serverTimestamp(),
        updatedAt: firestore.serverTimestamp(),
      });
    }
    await batch.commit();
    await env.withSecurityRulesDisabled(async (context) => {
      await firestore.setDoc(
        firestore.doc(
          context.firestore() as unknown as firestore.Firestore,
          "feedback_reports",
          "other-report",
        ),
        { ...content, reporterUid: "other" },
      );
    });
    const exported = await FirestoreService.exportUserData("owner", "owner@example.com", true);
    assert.equal(exported.feedbackReports.length, 55);
    assert.ok(
      exported.feedbackReports.every(
        (report: Record<string, unknown>) =>
          !("reporterUid" in report) &&
          !("reviewerUid" in report) &&
          typeof report.createdAt === "string",
      ),
    );
    await FirestoreService.deleteUserAccount("owner", "owner@example.com", true);
    await env.withSecurityRulesDisabled(async (context) => {
      const remaining = await firestore.getDocs(
        firestore.collection(
          context.firestore() as unknown as firestore.Firestore,
          "feedback_reports",
        ),
      );
      assert.deepEqual(
        remaining.docs.map((report) => report.id),
        ["other-report"],
      );
    });
  });

  test("unreadable saved feedback aborts export instead of silently dropping user data", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await firestore.setDoc(
        firestore.doc(
          context.firestore() as unknown as firestore.Firestore,
          "feedback_reports",
          "malformed",
        ),
        { reporterUid: "owner", title: "Legacy report" },
      );
    });
    await assert.rejects(FirestoreService.exportUserData("owner", "owner@example.com", true));
    assert.equal((await firestore.getDoc(firestore.doc(db, "users", "owner"))).exists(), true);
  });

  test("large house deletion chunks child and membership records while retaining owner permission", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      for (let start = 0; start < 520; start += 200) {
        const batch = firestore.writeBatch(admin);
        for (let index = start; index < Math.min(start + 200, 520); index++) {
          batch.set(firestore.doc(admin, `houses/${houseId}/caregivers/c${index}`), {
            id: `c${index}`,
          });
          batch.set(firestore.doc(admin, "user_house_access", `${houseId}_u${index}`), {
            houseId,
            userId: `u${index}`,
            role: "manager",
          });
        }
        await batch.commit();
      }
    });
    await FirestoreService.deleteHouse(houseId, "owner");
    await env.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore() as unknown as firestore.Firestore;
      assert.equal(
        (await firestore.getDoc(firestore.doc(admin, "houses", houseId))).exists(),
        false,
      );
      assert.equal(
        (await firestore.getDoc(firestore.doc(admin, "house_keys", houseId))).exists(),
        false,
      );
      assert.equal(
        (await firestore.getDocs(firestore.collection(admin, `houses/${houseId}/caregivers`))).size,
        0,
      );
      assert.equal(
        (await firestore.getDocs(firestore.collection(admin, "user_house_access"))).size,
        0,
      );
    });
  });
});
