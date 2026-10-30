import assert from "node:assert/strict";
import { test } from "node:test";
import type { Caregiver, DaySchedule } from "@/context/ScheduleContext";
import {
  buildCaregiverPay,
  caregiverUpcomingPayments,
  parseCaregiverPay,
  weekOfMonth,
} from "./caregiverPay";
import { paidShiftKey } from "./paymentDomain";

const today = new Date(2026, 9, 30, 12);
const caregiver: Caregiver = {
  id: "c1",
  name: "Maria",
  frequency: "Semanal",
  amount: 200,
  dayAmount: 100,
  nightAmount: 150,
  additionalAmount: 30,
};
// Weeks of Sat 24/10 to Fri 30/10 and of Sat 31/10 to Fri 06/11
const schedule: Record<string, DaySchedule> = {
  "2026-10-24": { day: ["c1"], night: [], dayAdditional: ["c1"] },
  "2026-10-31": { day: ["c1"], night: ["c1"] },
  "2026-11-02": { day: ["other"], night: ["c1"] },
};

test("only recent paid shifts go in the shared pay, without the caregiver's name", () => {
  const pay = buildCaregiverPay(
    caregiver,
    [paidShiftKey("2026-10-24", "day"), paidShiftKey("2026-01-10", "day")],
    today,
  );
  assert.deepEqual(pay.paid, [paidShiftKey("2026-10-24", "day")]);
  assert.equal("name" in pay, false);
  assert.deepEqual(parseCaregiverPay(JSON.stringify(pay)), JSON.parse(JSON.stringify(pay)));
});

test("decrypted pay is checked before use", () => {
  assert.equal(parseCaregiverPay("not json"), null);
  assert.equal(
    parseCaregiverPay(JSON.stringify({ frequency: "Anual", amount: 1, paid: [] })),
    null,
  );
  assert.equal(
    parseCaregiverPay(JSON.stringify({ frequency: "Semanal", amount: -1, paid: [] })),
    null,
  );
  assert.equal(parseCaregiverPay(JSON.stringify({ frequency: "Semanal", amount: 1 })), null);
});

test("estimates only unpaid shifts already scheduled, one entry per week", () => {
  const pay = buildCaregiverPay(caregiver, [paidShiftKey("2026-10-24", "day")], today);
  const payments = caregiverUpcomingPayments("c1", pay, schedule, today);

  // The paid base of 24/10 is gone; its additional is still owed
  assert.deepEqual(
    payments.map((p) => [p.periodKey, p.amount, p.dayShifts, p.nightShifts]),
    [
      ["2026-10-24", 30, 1, 0],
      ["2026-10-31", 400, 1, 2],
    ],
  );
});

test("weeks count in the month of the Friday that closes them", () => {
  // Sat 26/09 to Fri 02/10 is the first week of October
  const first = weekOfMonth(new Date(2026, 8, 26, 12));
  assert.deepEqual([first.week, first.month.getMonth()], [1, 9]);
  // Sat 24/10 to Fri 30/10 is the fifth
  const fifth = weekOfMonth(new Date(2026, 9, 24, 12));
  assert.deepEqual([fifth.week, fifth.month.getMonth()], [5, 9]);
  // Sat 31/10 to Fri 06/11 is the first week of November
  assert.equal(weekOfMonth(new Date(2026, 9, 31, 12)).month.getMonth(), 10);
});
