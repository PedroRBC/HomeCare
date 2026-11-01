import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { previousScheduledShift, notePayloadSchema, shiftContextSchema } from "./shiftNotes";

describe("shift notes", () => {
  test("finds the last occupied shift, across gaps, months and extra assignments", () => {
    const schedule = {
      "2026-09-30": { nightExtra: ["c1"] },
      "2026-10-01": { day: [], night: [] },
      "2026-10-03": { day: ["c2"], night: ["c3"] },
    };
    assert.equal(previousScheduledShift(schedule, "2026-10-03:day"), "2026-09-30:night");
    assert.equal(previousScheduledShift(schedule, "2026-10-03:night"), "2026-10-03:day");
    assert.equal(previousScheduledShift(schedule, "2026-09-30:night"), null);
  });
  test("validates and trims short messages, and rejects blank and oversized input", () => {
    assert.deepEqual(notePayloadSchema.parse({ kind: "message", text: " consulta às 9h " }), {
      kind: "message",
      text: "consulta às 9h",
    });
    for (const text of ["  ", "x".repeat(1001)]) {
      assert.equal(notePayloadSchema.safeParse({ kind: "message", text }).success, false);
    }
  });
  test("accepts a structured handover but rejects empty or malformed checklists", () => {
    const handover = {
      kind: "handover",
      medication: true,
      meals: false,
      activities: false,
      pending: [],
      observations: "",
    };
    assert.equal(notePayloadSchema.safeParse(handover).success, true);
    assert.equal(notePayloadSchema.safeParse({ ...handover, medication: false }).success, false);
    assert.equal(notePayloadSchema.safeParse({ ...handover, medication: "yes" }).success, false);
    assert.equal(
      notePayloadSchema.safeParse({
        ...handover,
        pending: [{ id: "p1", text: "Verificar pressão" }],
      }).success,
      true,
    );
    assert.equal(
      notePayloadSchema.safeParse({ ...handover, pending: [{ id: "p1", text: "" }] }).success,
      false,
    );
    assert.equal(
      notePayloadSchema.safeParse({
        ...handover,
        pending: [
          { id: "p1", text: "A" },
          { id: "p1", text: "B" },
        ],
      }).success,
      false,
    );
    assert.equal(
      notePayloadSchema.safeParse({ ...handover, pending: "x".repeat(2001) }).success,
      false,
    );
  });
  test("rejects invalid dates and path injection at the route boundary", () => {
    for (const date of ["2026-02-30", "2026-13-01", "../houses", "2026-1-01"]) {
      assert.equal(
        shiftContextSchema.safeParse({ houseId: "h1", date, shift: "day" }).success,
        false,
      );
    }
    assert.equal(
      shiftContextSchema.safeParse({ houseId: "../h1", date: "2026-10-31", shift: "day" }).success,
      false,
    );
    assert.equal(
      shiftContextSchema.safeParse({ houseId: "h1", date: "2026-10-31", shift: "night" }).success,
      true,
    );
  });
});
