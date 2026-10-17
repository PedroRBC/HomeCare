/* eslint-disable import/no-named-as-default-member -- i18n is the shared i18next instance */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import i18n from "i18next";
import pt from "@/i18n/locales/pt";
import {
  buildCaregiverShifts,
  caregiverEmailError,
  hasUncheckedAvailability,
  dayShiftKeys,
  linkStatus,
  scheduleShiftKeys,
  groupShiftsByDate,
  isValidEmail,
  normalizeEmail,
  parseOptionalMoneyInput,
  type CaregiverLink,
} from "./caregiverShifts";

const link = (houseId: string, caregiverId: string, houseName = houseId): CaregiverLink => ({
  id: `${houseId}__${caregiverId}`,
  houseId,
  houseName,
  caregiverId,
  caregiverName: "Maria",
  email: "maria@example.com",
});

before(async () => {
  await i18n.init({
    lng: "pt",
    resources: { pt: { translation: pt } },
    interpolation: { escapeValue: false },
  });
});

test("collects day, night and extra shifts of the linked caregiver only", () => {
  const shifts = buildCaregiverShifts([link("h1", "maria")], {
    h1: {
      "2026-10-05": { day: ["maria"], night: ["ana"] },
      "2026-10-06": { day: [], night: ["maria", "ana"], dayExtra: ["maria"] },
      "2026-10-07": { day: ["ana"], night: [] },
    },
  });

  assert.deepEqual(
    shifts.map((s) => [s.date, s.shift, s.extra]),
    [
      ["2026-10-05", "day", false],
      ["2026-10-06", "day", true],
      ["2026-10-06", "night", false],
    ],
  );
});

test("merges shifts from several houses in date order", () => {
  const shifts = buildCaregiverShifts([link("h2", "c2", "Casa B"), link("h1", "c1", "Casa A")], {
    h1: { "2026-10-06": { day: ["c1"], night: [] } },
    h2: {
      "2026-10-06": { day: ["c2"], night: [] },
      "2026-10-01": { day: [], night: ["c2"] },
    },
  });

  assert.deepEqual(
    shifts.map((s) => [s.date, s.houseName]),
    [
      ["2026-10-01", "Casa B"],
      ["2026-10-06", "Casa A"],
      ["2026-10-06", "Casa B"],
    ],
  );
  assert.equal(groupShiftsByDate(shifts)["2026-10-06"].length, 2);
});

test("a caregiver in both regular and extra lists counts once as regular", () => {
  const shifts = buildCaregiverShifts([link("h1", "c1")], {
    h1: { "2026-10-05": { day: ["c1", "c1"], night: [], dayExtra: ["c1"] } },
  });

  assert.deepEqual(shifts, [
    { date: "2026-10-05", houseId: "h1", houseName: "h1", shift: "day", extra: false },
  ]);
});

test("tolerates missing schedules and partial day documents", () => {
  assert.deepEqual(buildCaregiverShifts([link("gone", "c1")], {}), []);
  assert.deepEqual(
    buildCaregiverShifts([link("h1", "c1")], { h1: { "2026-10-05": { nightExtra: ["c1"] } } }),
    [{ date: "2026-10-05", houseId: "h1", houseName: "h1", shift: "night", extra: true }],
  );
});

test("emails are compared trimmed and case-insensitively", () => {
  assert.equal(normalizeEmail("  Maria@Example.COM "), "maria@example.com");
  assert.equal(normalizeEmail(null), "");
  assert.ok(isValidEmail(" Maria@Example.com "));
  assert.ok(!isValidEmail("maria@"));
  assert.ok(!isValidEmail("maria example@x.com"));
});

test("a caregiver email must be valid and unique within the house", () => {
  const caregivers = [
    { id: "a", name: "Ana", frequency: "Semanal" as const, amount: 0, email: "ana@x.com" },
    { id: "b", name: "Bia", frequency: "Mensal" as const, amount: 0 },
  ];

  assert.equal(caregiverEmailError("", caregivers), null);
  assert.equal(caregiverEmailError("ana@", caregivers), "Email inválido");
  assert.equal(caregiverEmailError(" ANA@x.com", caregivers), "Este email já está vinculado a Ana");
  assert.equal(caregiverEmailError("ana@x.com", caregivers, "a"), null);
  assert.equal(caregiverEmailError("bia@x.com", caregivers, "b"), null);
});

test("shift keys cover regular and extra shifts of a caregiver", () => {
  assert.deepEqual(dayShiftKeys("c1", "2026-10-05", { day: ["c1"], nightExtra: ["c1"] }), [
    "2026-10-05:day",
    "2026-10-05:night",
  ]);
  assert.deepEqual(dayShiftKeys("c1", "2026-10-05", { day: ["c2"] }), []);
  assert.deepEqual(
    scheduleShiftKeys("c1", {
      "2026-10-07": { night: ["c1"] },
      "2026-10-05": { dayExtra: ["c1"], day: ["c1"] },
      "2026-10-06": { day: ["c2"] },
    }),
    ["2026-10-05:day", "2026-10-07:night"],
  );
});

test("availability is unchecked for every active caregiver with a login email", () => {
  // Other houses' shifts are private: a linked caregiver is never assumed to be free
  assert.equal(hasUncheckedAvailability({ email: "maria@example.com" }), true);
  assert.equal(hasUncheckedAvailability({ email: " MARIA@example.com " }), true);
  assert.equal(hasUncheckedAvailability({ email: "maria@example.com", disabled: true }), false);
  assert.equal(hasUncheckedAvailability({ email: "  " }), false);
  assert.equal(hasUncheckedAvailability({}), false);
});

test("parses optional additional rates as non-negative money with at most two decimals", () => {
  assert.deepEqual(parseOptionalMoneyInput(""), { valid: true, value: 0 });
  assert.deepEqual(parseOptionalMoneyInput("  "), { valid: true, value: 0 });
  assert.deepEqual(parseOptionalMoneyInput("0"), { valid: true, value: 0 });
  assert.deepEqual(parseOptionalMoneyInput("25,5"), { valid: true, value: 25.5 });
  assert.deepEqual(parseOptionalMoneyInput("25.50"), { valid: true, value: 25.5 });
  assert.deepEqual(parseOptionalMoneyInput("-1"), { valid: false });
  assert.deepEqual(parseOptionalMoneyInput("1.234"), { valid: false });
  assert.deepEqual(parseOptionalMoneyInput("Infinity"), { valid: false });
  assert.deepEqual(parseOptionalMoneyInput("1,2.3"), { valid: false });
});

test("links without status are pending", () => {
  assert.equal(linkStatus({}), "pending");
  assert.equal(linkStatus({ status: "accepted" }), "accepted");
});
