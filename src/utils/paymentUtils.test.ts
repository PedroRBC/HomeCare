import { test } from "node:test";
import assert from "node:assert/strict";
import { isPaymentPending } from "./paymentUtils";

test("a payment is pending from the last day of its period", () => {
  const weekOf = { date: new Date(2026, 9, 3), frequency: "Semanal" as const }; // Sat 3 - Fri 9

  assert.equal(isPaymentPending(weekOf, new Date(2026, 9, 8, 22)), false);
  assert.equal(isPaymentPending(weekOf, new Date(2026, 9, 9, 8)), true);
  assert.equal(isPaymentPending(weekOf, new Date(2026, 9, 20)), true);
});
