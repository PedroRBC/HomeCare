import { test } from "node:test";
import assert from "node:assert/strict";
import type { PaymentHistory } from "@/context/ScheduleContext";
import { legacyPaymentKeys, periodFromDescription } from "./paymentHistory";

const entry = (description: string): PaymentHistory => ({
  id: "h1",
  caregiverId: "c1",
  caregiverName: "Ana",
  date: "",
  frequency: "Mensal",
  description,
  amount: 0,
  paidAt: "",
});

test("recovers each kind of period from its description", () => {
  const week = periodFromDescription("Semana de 03/10/2026 a 09/10/2026")!;
  assert.equal(week.frequency, "Semanal");
  assert.equal(week.end.getDate(), 9);

  const half = periodFromDescription("2ª Quinzena de fevereiro de 2026 (3 Dias)")!;
  assert.equal(half.frequency, "Quinzenal");
  assert.deepEqual([half.start.getDate(), half.end.getDate()], [16, 28]);

  assert.equal(periodFromDescription("março de 2026")?.frequency, "Mensal");
  assert.equal(periodFromDescription("Dia - 03/10/2026 (Semana 2026-10-03)"), null);
});

test("legacy entries pay the caregiver's shifts within their period", () => {
  const schedule = {
    "2026-03-31": { day: ["c1"], night: ["c1"] },
    "2026-04-01": { day: ["c1"], night: [] },
  };

  assert.deepEqual(legacyPaymentKeys(entry("março de 2026 (1 Dia, 1 Noite)"), schedule), [
    "day-2026-03-31-2026-03",
    "night-2026-03-31-2026-03",
  ]);
  assert.equal(legacyPaymentKeys(entry("sem período"), schedule), null);
});
