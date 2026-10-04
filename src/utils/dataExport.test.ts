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
