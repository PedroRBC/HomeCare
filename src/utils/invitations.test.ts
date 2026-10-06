import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveInvitationStatus } from "./invitations";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

test("a pending invitation with server expiry is usable until it expires", () => {
  const invitation = { status: "pending" as const, expiresAt: inDays(3), expiresAtTs: {} };
  assert.equal(effectiveInvitationStatus(invitation, NOW), "pending");
  assert.equal(effectiveInvitationStatus({ ...invitation, expiresAt: inDays(-1) }, NOW), "expired");
});

test("invitations from before server expiry must be sent again", () => {
  // Rules can't check their expiry, so they are never accepted
  assert.equal(
    effectiveInvitationStatus({ status: "pending", expiresAt: inDays(3) }, NOW),
    "expired",
  );
});

test("answered invitations keep their status", () => {
  assert.equal(
    effectiveInvitationStatus({ status: "accepted", expiresAt: inDays(-9) }),
    "accepted",
  );
  assert.equal(effectiveInvitationStatus({ status: "declined", expiresAt: inDays(3) }), "declined");
});
