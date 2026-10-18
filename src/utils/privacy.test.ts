import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptPolicies,
  changedPurposes,
  needsConsent,
  restrictTelemetry,
  sameTelemetry,
  sanitizeAnalyticsParams,
  telemetryConsents,
  telemetryPreferences,
  TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  withPendingRevocation,
} from "./privacy";

test("a failed change never leaves more telemetry on than before or after it", () => {
  const before = { analytics: true, crashReports: false };
  const after = { analytics: false, crashReports: true };
  // Revoking analytics holds; granting crash reports waits until recorded
  assert.deepEqual(restrictTelemetry(before, after), { analytics: false, crashReports: false });
  assert.equal(sameTelemetry(restrictTelemetry(before, before), before), true);
  assert.equal(sameTelemetry(restrictTelemetry(before, after), before), false);
});

test("revocations not recorded yet win over the recorded grant", () => {
  const recorded = {
    ...acceptPolicies(),
    ...telemetryConsents({ analytics: true, crashReports: true }),
  };
  const now = new Date("2026-10-05T12:00:00Z");
  const effective = withPendingRevocation(recorded, { analytics: false, crashReports: true }, now);

  assert.deepEqual(telemetryPreferences(effective), { analytics: false, crashReports: true });
  assert.deepEqual(effective?.analytics, { granted: false, updatedAt: now.toISOString() });
  assert.equal(effective?.privacyPolicy, recorded.privacyPolicy);
  // Nothing pending, or no consents at all: unchanged
  assert.equal(withPendingRevocation(recorded, null), recorded);
  assert.equal(
    withPendingRevocation(undefined, { analytics: false, crashReports: false }),
    undefined,
  );
});

test("only the telemetry purposes in a change are reported as changed", () => {
  assert.deepEqual(changedPurposes(acceptPolicies()), []);
  assert.deepEqual(changedPurposes(telemetryConsents({ analytics: true, crashReports: false })), [
    "analytics",
    "crashReports",
  ]);
  assert.deepEqual(changedPurposes({ crashReports: { granted: false, updatedAt: "" } }), [
    "crashReports",
  ]);
});

test("consent is required until policies are accepted and telemetry is chosen", () => {
  const policies = acceptPolicies();
  const telemetry = telemetryConsents({ analytics: false, crashReports: true });

  assert.equal(needsConsent(undefined), true);
  assert.equal(needsConsent(policies), true);
  assert.equal(needsConsent(telemetry), true);
  assert.equal(needsConsent({ ...policies, ...telemetry }), false);
});

test("the privacy-policy update changes its version without changing the terms version", () => {
  assert.equal(PRIVACY_POLICY_VERSION, "2026-10-18");
  assert.equal(TERMS_VERSION, "2026-10-04");

  const accepted = acceptPolicies();
  assert.equal(accepted.privacyPolicy?.version, PRIVACY_POLICY_VERSION);
  assert.equal(accepted.terms?.version, TERMS_VERSION);
});

test("an outdated policy version asks for consent again", () => {
  const outdated = { version: "2020-01-01", acceptedAt: new Date().toISOString() };
  const consents = {
    privacyPolicy: outdated,
    terms: outdated,
    ...telemetryConsents({ analytics: true, crashReports: true }),
  };

  assert.equal(needsConsent(consents), true);
});

test("telemetry is off unless explicitly granted", () => {
  assert.deepEqual(telemetryPreferences(undefined), { analytics: false, crashReports: false });
  assert.deepEqual(
    telemetryPreferences(telemetryConsents({ analytics: true, crashReports: false })),
    { analytics: true, crashReports: false },
  );
});

test("analytics parameters never carry personal data", () => {
  const params = sanitizeAnalyticsParams({
    method: "email",
    email: "ana@example.com",
    caregiver_name: "Ana",
    amount: 200,
    error_message: "user ana@example.com not found",
    error_code: "auth/user-not-found",
    note: "contato: ana@example.com",
  });

  assert.deepEqual(params, { method: "email", error_code: "auth/user-not-found" });
});
