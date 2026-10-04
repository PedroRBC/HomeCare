import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptPolicies,
  needsConsent,
  sanitizeAnalyticsParams,
  telemetryConsents,
  telemetryPreferences,
} from "./privacy";

test("consent is required until policies are accepted and telemetry is chosen", () => {
  const policies = acceptPolicies();
  const telemetry = telemetryConsents({ analytics: false, crashReports: true });

  assert.equal(needsConsent(undefined), true);
  assert.equal(needsConsent(policies), true);
  assert.equal(needsConsent(telemetry), true);
  assert.equal(needsConsent({ ...policies, ...telemetry }), false);
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
