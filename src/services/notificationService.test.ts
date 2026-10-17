import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock, setSystemTime } from "bun:test";
import type { Caregiver, DaySchedule } from "@/context/ScheduleContext";
import { dateKey } from "@/utils/date";
import { paidShiftKey } from "@/utils/paymentDomain";
import type { IsShiftPaid } from "@/utils/paymentObligations";

const sent: { body: string; data: Record<string, unknown> }[] = [];
mock.module("expo-notifications", () => ({
  setNotificationHandler: () => {},
  getAllScheduledNotificationsAsync: async () => [],
}));
mock.module("react-native", () => ({ Platform: { OS: "android" } }));
mock.module("@/services/pushNotificationService", () => ({
  PushNotificationService: {
    currentSession: () => 1,
    isSessionCurrent: () => true,
    sendLocalNotification: async (_title: string, body: string, data: Record<string, unknown>) => {
      sent.push({ body, data });
    },
  },
}));
mock.module("i18next", () => ({
  t: (key: string, options?: { count: number }) => (options ? `${options.count} shifts` : key),
}));
mock.module("@/i18n/format", () => ({
  formatMoney: (amount: number) => amount.toFixed(2),
  localizedDescription: (description: string) => description,
}));
const { NotificationService } = await import("./notificationService");
const caregiver: Caregiver = {
  id: "person",
  name: "Test",
  frequency: "Quinzenal",
  amount: 250,
  dayAmount: 100,
  nightAmount: 150,
  additionalAmount: 25,
};
const schedule: Record<string, DaySchedule> = {
  "2026-10-15": {
    day: [caregiver.id],
    night: [caregiver.id],
    dayAdditional: [caregiver.id],
    nightAdditional: [caregiver.id],
  },
};

beforeEach(() => {
  sent.length = 0;
  setSystemTime(new Date(2026, 9, 15, 12));
});
afterEach(() => setSystemTime());

test("period reminders include both additional components without doubling physical shifts", async () => {
  await NotificationService.checkAndScheduleOverdueNotifications(
    [caregiver],
    schedule,
    () => false,
  );
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /2 shifts/);
  assert.match(sent[0].body, /300\.00/);
});

test("a reminder after base settlement includes only the pending additional", async () => {
  const paid = new Set([
    paidShiftKey("2026-10-15", "day"),
    paidShiftKey("2026-10-15", "night"),
    paidShiftKey("2026-10-15", "night", "additional"),
  ]);
  const isPaid: IsShiftPaid = (_, date, shift, mode = "regular") =>
    paid.has(paidShiftKey(dateKey(date), shift, mode));
  await NotificationService.checkAndScheduleOverdueNotifications([caregiver], schedule, isPaid);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /1 shifts/);
  assert.match(sent[0].body, /25\.00/);
});

test("locked caregivers and legacy daily extras do not enter period reminders", async () => {
  await NotificationService.checkAndScheduleOverdueNotifications(
    [{ ...caregiver, locked: true }],
    schedule,
    () => false,
  );
  await NotificationService.checkAndScheduleOverdueNotifications(
    [caregiver],
    { "2026-10-15": { day: [], night: [], dayExtra: [caregiver.id] } },
    () => false,
  );
  assert.deepEqual(sent, []);
});
