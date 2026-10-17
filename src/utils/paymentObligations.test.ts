import assert from "node:assert/strict";
import { test } from "node:test";
import type { Caregiver, DaySchedule } from "@/context/ScheduleContext";
import { dateKey } from "@/utils/date";
import { buildPaymentKey, paidShiftKey, toPaidShifts } from "./paymentDomain";
import {
  collectPaymentObligations,
  shiftAmount,
  sumAmounts,
  type IsShiftPaid,
} from "./paymentObligations";
import { buildUpcomingPayments } from "./upcomingPayments";

const date = new Date(2026, 9, 3, 12);
const caregiver: Caregiver = {
  id: "person",
  name: "Test",
  frequency: "Semanal",
  amount: 250,
  dayAmount: 100,
  nightAmount: 150,
  additionalAmount: 50,
};
const schedule: Record<string, DaySchedule> = {
  "2026-10-03": {
    day: [caregiver.id],
    night: [caregiver.id],
    dayAdditional: [caregiver.id],
    nightAdditional: [caregiver.id],
  },
};
const paidBy = (keys: string[]): IsShiftPaid => {
  const paid = toPaidShifts(keys);
  return (_, currentDate, shift, mode = "regular") =>
    paid.has(paidShiftKey(dateKey(currentDate), shift, mode));
};

test("each marked shift earns its own additional without replacing the base", () => {
  const items = collectPaymentObligations(caregiver, schedule);
  assert.equal(items.length, 4);
  assert.equal(sumAmounts(items.map((item) => item.amount)), 350);
  assert.deepEqual(
    items.map((item) => item.mode),
    ["regular", "additional", "regular", "additional"],
  );
});

test("absence, zero, invalid configuration and orphan flags never use the base as additional", () => {
  for (const additionalAmount of [undefined, 0, -5, NaN, Infinity]) {
    const items = collectPaymentObligations({ ...caregiver, additionalAmount }, schedule);
    assert.equal(items.length, 2);
    assert.equal(sumAmounts(items.map((item) => item.amount)), 250);
  }
  assert.deepEqual(
    collectPaymentObligations(caregiver, {
      "2026-10-03": { day: [], night: [], dayAdditional: [caregiver.id] },
    }),
    [],
  );
  assert.deepEqual(collectPaymentObligations({ ...caregiver, locked: true }, schedule), []);
});

test("invalid calendar dates never create base or additional obligations", () => {
  const marked = { day: [caregiver.id], night: [], dayAdditional: [caregiver.id] };
  const items = collectPaymentObligations(caregiver, {
    "2026-02-30": marked,
    "2026-13-01": marked,
    "not-a-date": marked,
  });
  assert.deepEqual(items, []);
});

test("zero day or night rates are not replaced with the legacy aggregate rate", () => {
  assert.equal(shiftAmount({ ...caregiver, dayAmount: 0 }, "day"), 0);
  assert.equal(shiftAmount({ ...caregiver, dayAmount: undefined }, "day"), 250);
  assert.equal(shiftAmount({ ...caregiver, nightAmount: 0 }, "night"), 0);
});

test("additional after a paid base remains payable at every frequency", () => {
  const paid = paidBy([buildPaymentKey({ date, shift: "day", frequency: "Semanal" })]);
  for (const frequency of ["Diário", "Semanal", "Quinzenal", "Mensal"] as const) {
    const cg = { ...caregiver, frequency };
    const onlyDay = { "2026-10-03": { ...schedule["2026-10-03"], night: [], nightAdditional: [] } };
    const items = collectPaymentObligations(cg, onlyDay, paid);
    assert.equal(items.length, 1);
    assert.equal(items[0].mode, "additional");
    assert.equal(items[0].amount, 50);
    assert.equal(items[0].frequency, frequency);
    const preview = buildUpcomingPayments([cg], onlyDay, paid, date);
    assert.equal(preview.length, 1);
    assert.equal(preview[0].amount, 50);
    assert.equal(preview[0].regularAmount, 0);
    assert.equal(preview[0].additionalCount, 1);
    assert.equal(preview[0].dayShifts, 1);
  }
});

test("payment components stay paid independently across frequency changes and reversal", () => {
  const base = buildPaymentKey({ date, shift: "day", frequency: "Semanal" });
  const additional = buildPaymentKey({
    date,
    shift: "day",
    frequency: "Semanal",
    mode: "additional",
  });
  const onlyDay = { "2026-10-03": { ...schedule["2026-10-03"], night: [] } };
  const monthly = { ...caregiver, frequency: "Mensal" as const };
  assert.deepEqual(collectPaymentObligations(monthly, onlyDay, paidBy([base, additional])), []);
  const reversed = collectPaymentObligations(monthly, onlyDay, paidBy([base]));
  assert.deepEqual(
    reversed.map((item) => item.mode),
    ["additional"],
  );
});

test("legacy extras keep full rate and separate daily settlement", () => {
  const legacy = { "2026-10-03": { day: [], night: [], dayExtra: [caregiver.id] } };
  const items = collectPaymentObligations(caregiver, legacy);
  assert.equal(items.length, 1);
  assert.equal(items[0].mode, "daily-extra");
  assert.equal(items[0].amount, 100);
  assert.equal(items[0].frequency, "Diário");
  assert.equal(items[0].periodKey, "extra-day-2026-10-03");
  const preview = buildUpcomingPayments([caregiver], legacy, () => false, date);
  assert.equal(preview[0].amount, 100);
  assert.equal(preview[0].additionalCount, 0);
});

test("preview sums base and additional without double counting physical shifts", () => {
  const preview = buildUpcomingPayments([caregiver], schedule, () => false, date);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].amount, 350);
  assert.equal(preview[0].regularAmount, 250);
  assert.equal(preview[0].additionalAmount, 100);
  assert.equal(preview[0].additionalCount, 2);
  assert.equal(preview[0].dayShifts, 1);
  assert.equal(preview[0].nightShifts, 1);
});

test("each person uses their own configured additional and sums use cent precision", () => {
  const other = { ...caregiver, id: "other", additionalAmount: 25.15, dayAmount: 0.1 };
  const first = { ...caregiver, dayAmount: 0.1, additionalAmount: 0.2 };
  const sharedDay = {
    "2026-10-03": { day: [first.id, other.id], night: [], dayAdditional: [first.id, other.id] },
  };
  const preview = buildUpcomingPayments([first, other], sharedDay, () => false, date);
  assert.equal(preview.find((item) => item.caregiverId === first.id)!.amount, 0.3);
  assert.equal(preview.find((item) => item.caregiverId === other.id)!.amount, 25.25);
});

test("legacy fractional base rates are rounded per component before summing", () => {
  const cg = { ...caregiver, dayAmount: 1.005, additionalAmount: 0 };
  const items = collectPaymentObligations(cg, {
    "2026-10-03": { day: [cg.id], night: [] },
    "2026-10-04": { day: [cg.id], night: [] },
  });
  assert.deepEqual(
    items.map((item) => item.amount),
    [1.01, 1.01],
  );
  assert.equal(sumAmounts(items.map((item) => item.amount)), 2.02);
});

test("preview keeps legacy extras separate from regular daily payments", () => {
  const cg = { ...caregiver, frequency: "Diário" as const };
  const mixed = {
    "2026-10-03": { day: [cg.id], night: [], nightExtra: [cg.id], dayAdditional: [cg.id] },
  };
  const preview = buildUpcomingPayments([cg], mixed, () => false, date);
  assert.equal(preview.length, 2);
  assert.equal(preview.find((item) => item.periodKey === "2026-10-03")!.amount, 150);
  assert.equal(preview.find((item) => item.periodKey === "extra-night-2026-10-03")!.amount, 150);
});

test("monthly previews include full boundary periods without including unrelated months", () => {
  const cg = { ...caregiver, frequency: "Mensal" as const };
  const day = { day: [cg.id], night: [], dayAdditional: [cg.id] };
  const preview = buildUpcomingPayments(
    [cg],
    {
      "2026-08-31": day,
      "2026-09-01": day,
      "2026-09-30": day,
      "2026-10-03": day,
      "2026-11-30": day,
      "2026-12-01": day,
    },
    () => false,
    date,
  );
  assert.deepEqual(
    preview.map((item) => [item.periodKey, item.amount]),
    [
      ["2026-09", 300],
      ["2026-10", 150],
      ["2026-11", 150],
    ],
  );
});
