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

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator && process.env.REQUIRE_FIRESTORE_EMULATOR)
  throw new Error("Firestore emulator required");
let env: RulesTestEnvironment;
let db: firestore.Firestore;
let currentUid = "owner";
mock.module("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: currentUid } }),
}));
mock.module("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
mock.module("@react-native-firebase/firestore", () => ({ ...firestore, getFirestore: () => db }));
mock.module("@/services/firebase", () => ({
  CrashlyticsService: { log: () => {}, logError: () => {} },
}));
const { FirestoreService, HouseAccessRepairError } = await import("@/services/firestore");
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
    await fetch(`http://${emulator}/emulator/v1/projects/demo-homecare-services:securityRules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: { files: [{ name: "firestore.rules", content: rules }] } }),
    }).then((response) => {
      if (!response.ok) throw new Error("Could not inject failure rules");
    });
    try {
      await assert.rejects(
        FirestoreService.recordPayment(id, "Semanal", ["k1"], history(id, ["k1"])),
        /permission/i,
      );
      assert.equal((await documents("payments")).size, 0);
      assert.equal((await documents("paymentHistory")).size, 0);
    } finally {
      await fetch(`http://${emulator}/emulator/v1/projects/demo-homecare-services:securityRules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: {
            files: [{ name: "firestore.rules", content: readFileSync("firestore.rules", "utf8") }],
          },
        }),
      });
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
    const setRules = async (rules: string) => {
      const response = await fetch(
        `http://${emulator}/emulator/v1/projects/demo-homecare-services:securityRules`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules: { files: [{ name: "firestore.rules", content: rules }] } }),
        },
      );
      if (!response.ok) throw new Error("Could not inject failure rules");
    };

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
