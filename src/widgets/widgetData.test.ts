import { test } from "node:test";
import assert from "node:assert/strict";
import type { Caregiver } from "@/context/ScheduleContext";
import type { UpcomingPayment } from "@/utils/upcomingPayments";
import { buildWidgetHouse, parseWidgetLink, paymentSummary, shiftsFor } from "./widgetData";

const caregivers = [
  { id: "a", name: "Maria Silva", frequency: "Semanal", amount: 100 },
  { id: "b", name: "Ana Souza", frequency: "Diário", amount: 150 },
] as Caregiver[];

const payment = (caregiver: string, date: Date, frequency: UpcomingPayment["frequency"]) =>
  ({ caregiver, date, frequency, amount: 120.1 }) as UpcomingPayment;

const today = new Date(2026, 9, 27, 9); // Tuesday
const build = (showAmounts: boolean) =>
  buildWidgetHouse({
    name: "Casa",
    caregivers,
    scheduleByDay: {
      "2026-10-27": { day: ["a"], night: ["b"], dayExtra: ["a", "b"] },
      "2026-10-28": { day: ["missing"], night: [] },
    },
    payments: [
      payment("Ana Souza", new Date(2026, 9, 26), "Diário"),
      payment("Maria Silva", new Date(2026, 9, 27), "Semanal"),
      payment("Ana Souza", new Date(2026, 10, 20), "Diário"),
    ],
    showAmounts,
    today,
  });

test("shifts keep first names only, merge extras and skip unknown caregivers", () => {
  const { today: now, tomorrow } = shiftsFor(build(false), today);
  assert.deepEqual(now, { day: ["Maria", "Ana"], night: ["Ana"] });
  assert.deepEqual(tomorrow, { day: [], night: [] });
});

test("amounts are left out of the stored snapshot unless the user opts in", () => {
  assert.ok(build(false).payments.every((p) => !("amount" in p)));
  assert.equal(paymentSummary(build(false), today).pendingAmount, undefined);
  assert.equal(paymentSummary(build(true), today).pendingAmount, 120.1);
});

test("payments split into pending, due within a week and the next one", () => {
  // Weekly period of Oct 27 ends Friday Oct 30; the daily Nov 20 payment is beyond a week.
  const summary = paymentSummary(build(false), today);
  assert.equal(summary.pending, 1);
  assert.equal(summary.upcoming, 1);
  assert.deepEqual(summary.next, { caregiver: "Maria", due: "2026-10-30" });
});

test("the today link resolves when opened, not when the widget was rendered", () => {
  assert.deepEqual(parseWidgetLink("homecare://day/today", new Date(2026, 9, 29, 23, 59)), {
    screen: "day",
    date: "2026-10-29",
  });
  assert.deepEqual(parseWidgetLink("homecare://day/today", new Date(2026, 9, 30, 0, 1)), {
    screen: "day",
    date: "2026-10-30",
  });
  assert.deepEqual(parseWidgetLink("homecare://day/2026-10-29", new Date(2026, 9, 30)), {
    screen: "day",
    date: "2026-10-29",
  });
});

test("only the widget deep links are accepted", () => {
  assert.deepEqual(parseWidgetLink("homecare://payments"), { screen: "payments" });
  assert.deepEqual(parseWidgetLink("homecare://day/2026-10-27"), {
    screen: "day",
    date: "2026-10-27",
  });
  assert.equal(parseWidgetLink("homecare://day/../settings"), null);
  assert.equal(parseWidgetLink("https://example.com/payments"), null);
});
