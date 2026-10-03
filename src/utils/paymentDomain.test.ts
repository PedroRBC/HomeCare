import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentKey, paidShiftKey, parsePaymentKey, toPaidShifts } from "./paymentDomain";

const oct3 = new Date(2026, 9, 3, 12);

test("a shift paid weekly stays paid after switching to monthly", () => {
  const paid = toPaidShifts([buildPaymentKey({ date: oct3, shift: "day", frequency: "Semanal" })]);

  assert.ok(paid.has(paidShiftKey("2026-10-03", "day")));
  assert.ok(!paid.has(paidShiftKey("2026-10-03", "night")));
  assert.ok(!paid.has(paidShiftKey("2026-10-03", "day", "daily-extra")));
});

test("extra shifts are tracked apart from regular ones", () => {
  const key = buildPaymentKey({
    date: oct3,
    shift: "night",
    frequency: "Diário",
    mode: "daily-extra",
  });

  assert.deepEqual(parsePaymentKey(key), {
    shift: "night",
    dayKey: "2026-10-03",
    mode: "daily-extra",
  });
  assert.ok(toPaidShifts([key]).has(paidShiftKey("2026-10-03", "night", "daily-extra")));
  assert.ok(!toPaidShifts([key]).has(paidShiftKey("2026-10-03", "night")));
});

test("every frequency's key maps to the same paid shift", () => {
  const keys = (["Semanal", "Quinzenal", "Mensal"] as const).map((frequency) =>
    buildPaymentKey({ date: oct3, shift: "day", frequency }),
  );

  assert.equal(toPaidShifts(keys).size, 1);
});
