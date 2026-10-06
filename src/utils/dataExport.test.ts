import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataExport, summarizeDataExport } from "./dataExport";

test("the export holds the user's data and never key material or internal fields", () => {
  const data = buildDataExport({
    profile: { id: "u1", email: "ana@example.com", consents: { analytics: { granted: false } } },
    houses: [
      {
        house: { id: "h1", name: "Casa", key: "c2VjcmV0" },
        role: "owner",
        caregivers: [{ id: "c1", name: "Maria", amount: 200 }],
        schedule: { "2026-10-04": { day: ["c1"], night: [] } },
        payments: [{ caregiverId: "c1", paymentKey: "k" }],
        paymentHistory: [{ id: "p1", caregiverName: "Maria", amount: 200, paymentKeys: ["k"] }],
      },
    ],
    invitationsSent: [],
    invitationsReceived: [{ id: "i1", houseName: "Outra", status: "pending" }],
    exportedAt: new Date("2026-10-04T12:00:00Z"),
  });

  const json = JSON.stringify(data);
  assert.equal(data.exportedAt, "2026-10-04T12:00:00.000Z");
  assert.equal(data.houses[0].yourRole, "owner");
  assert.equal(data.houses[0].caregivers[0].name, "Maria");
  assert.ok(!json.includes("c2VjcmV0"));
  assert.ok(!json.includes("paymentKeys"));
  assert.deepEqual(summarizeDataExport(data), { houses: 1, caregivers: 1, payments: 1 });
});

test("a caregiver's export lists her own shifts per house, readable", () => {
  const data = buildDataExport({
    profile: { id: "cg" },
    houses: [],
    invitationsSent: [],
    invitationsReceived: [],
    caregiverLinks: [
      {
        houseId: "h1",
        houseName: "Casa",
        caregiverName: "Maria",
        email: "maria@example.com",
        status: "accepted",
        shifts: ["2026-10-05:day", "2026-10-06:night", "garbage"],
      },
      { houseId: "h2", houseName: "Outra", email: "maria@example.com" },
    ],
  });

  assert.deepEqual(data.caregiverLinks[0].shifts, [
    { date: "2026-10-05", shift: "day", extra: null },
    { date: "2026-10-06", shift: "night", extra: null },
  ]);
  assert.equal(data.caregiverLinks[1].status, "pending");
  assert.deepEqual(data.caregiverLinks[1].shifts, []);
});

test("live own-shift export preserves regular versus extra and omits the cached list", () => {
  const data = buildDataExport({
    profile: { id: "cg" },
    houses: [],
    invitationsSent: [],
    invitationsReceived: [],
    caregiverLinks: [
      {
        houseId: "h1",
        status: "accepted",
        shifts: ["2026-10-01:day"],
        ownShifts: [{ date: "2026-10-05", shift: "night", extra: true }],
      },
    ],
  });
  assert.deepEqual(data.caregiverLinks[0].shifts, [
    { date: "2026-10-05", shift: "night", extra: true },
  ]);
  assert.equal("ownShifts" in data.caregiverLinks[0], false);
});
