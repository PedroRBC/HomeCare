import { test } from "node:test";
import assert from "node:assert/strict";
import { isPaymentPending } from "./paymentUtils";

test("a daily payment is pending on the shift date, but not before it", () => {
  const daily = { date: new Date(2026, 9, 21, 20), frequency: "Diário" as const };

  assert.equal(isPaymentPending(daily, new Date(2026, 9, 20, 23, 59)), false);
  assert.equal(isPaymentPending(daily, new Date(2026, 9, 21, 0)), true);
  assert.equal(isPaymentPending(daily, new Date(2026, 9, 22)), true);
});

test("a payment is pending from the last day of its period", () => {
  const weekOf = { date: new Date(2026, 9, 3), frequency: "Semanal" as const }; // Sat 3 - Fri 9

  assert.equal(isPaymentPending(weekOf, new Date(2026, 9, 8, 22)), false);
  assert.equal(isPaymentPending(weekOf, new Date(2026, 9, 9, 8)), true);
  assert.equal(isPaymentPending(weekOf, new Date(2026, 9, 20)), true);
});
