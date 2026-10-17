import { test } from "node:test";
import assert from "node:assert/strict";
import { getAdditionalPaymentError } from "./additionalPaymentErrors";

test("maps additional-payment service errors to localized error keys", () => {
  const cases = [
    ["Additional amount must be a finite, non-negative currency value", "additionalInvalidAmount"],
    [
      "This additional payment was already paid. Reverse it from payment history first.",
      "additionalAlreadyPaid",
    ],
    [
      "This legacy extra payment was already paid. Reverse it from payment history first.",
      "legacyExtraAlreadyPaid",
    ],
    [
      "Some shifts were already paid. Refresh before recording this payment.",
      "additionalScheduleChanged",
    ],
    [
      "A regular shift is required before adding an additional payment",
      "additionalRegularRequired",
    ],
    [
      "Caregiver is disabled or has no additional amount configured",
      "additionalCaregiverUnavailable",
    ],
    [
      "Remove or pay pending additional shifts before clearing the additional amount",
      "additionalPending",
    ],
    [
      "Configure a positive additional amount before reversing this payment",
      "additionalReversalRequiresAmount",
    ],
    [
      "Schedule or rates changed. Refresh before recording this payment.",
      "additionalScheduleChanged",
    ],
    [
      "Schedule changed while clearing the additional amount. Refresh and try again.",
      "additionalScheduleChanged",
    ],
  ] as const;

  for (const [message, key] of cases) {
    assert.equal(getAdditionalPaymentError(new Error(message)), key);
  }
  assert.equal(getAdditionalPaymentError(new Error("unrelated")), undefined);
});
