/**
 * LGPD helpers: consent records and personal data minimization for telemetry.
 */

// Bump when the Privacy Policy or Terms change in a way users must accept again
export const PRIVACY_POLICY_VERSION = "2026-10-31";
export const TERMS_VERSION = "2026-10-04";

export type PolicyAcceptance = {
  version: string;
  acceptedAt: string;
};

export type ConsentChoice = {
  granted: boolean;
  updatedAt: string;
};

export type UserConsents = {
  privacyPolicy?: PolicyAcceptance;
  terms?: PolicyAcceptance;
  // Optional purposes, only collected with the user's consent (LGPD art. 7, I)
  analytics?: ConsentChoice;
  crashReports?: ConsentChoice;
};

export type TelemetryPreferences = {
  analytics: boolean;
  crashReports: boolean;
};

export function hasAcceptedCurrentPolicies(consents?: UserConsents | null): boolean {
  return (
    consents?.privacyPolicy?.version === PRIVACY_POLICY_VERSION &&
    consents?.terms?.version === TERMS_VERSION
  );
}

/** Whether the user must go through the consent screen before using the app. */
export function needsConsent(consents?: UserConsents | null): boolean {
  return !hasAcceptedCurrentPolicies(consents) || !consents?.analytics || !consents?.crashReports;
}

export function telemetryPreferences(consents?: UserConsents | null): TelemetryPreferences {
  return {
    analytics: consents?.analytics?.granted === true,
    crashReports: consents?.crashReports?.granted === true,
  };
}

export const TELEMETRY_PURPOSES = ["analytics", "crashReports"] as const;

/** Allows only what both allow: what a device may collect while a choice isn't recorded. */
export function restrictTelemetry(
  a: TelemetryPreferences,
  b: TelemetryPreferences,
): TelemetryPreferences {
  return {
    analytics: a.analytics && b.analytics,
    crashReports: a.crashReports && b.crashReports,
  };
}

export function sameTelemetry(a: TelemetryPreferences, b: TelemetryPreferences): boolean {
  return TELEMETRY_PURPOSES.every((purpose) => a[purpose] === b[purpose]);
}

/** Telemetry purposes a consent change touches. */
export function changedPurposes(changes: UserConsents) {
  return TELEMETRY_PURPOSES.filter((purpose) => changes[purpose] !== undefined);
}

/**
 * Applies revocations made on this device that couldn't be recorded yet (`pending`
 * is false for each revoked purpose): they win over an older recorded grant.
 */
export function withPendingRevocation(
  consents: UserConsents | undefined,
  pending: TelemetryPreferences | null,
  now = new Date(),
): UserConsents | undefined {
  if (!consents || !pending) return consents;
  const result = { ...consents };
  for (const purpose of TELEMETRY_PURPOSES) {
    if (!pending[purpose] && result[purpose]?.granted) {
      result[purpose] = { granted: false, updatedAt: now.toISOString() };
    }
  }
  return result;
}

export function acceptPolicies(now = new Date()): Pick<UserConsents, "privacyPolicy" | "terms"> {
  const acceptedAt = now.toISOString();
  return {
    privacyPolicy: { version: PRIVACY_POLICY_VERSION, acceptedAt },
    terms: { version: TERMS_VERSION, acceptedAt },
  };
}

export function telemetryConsents(
  preferences: TelemetryPreferences,
  now = new Date(),
): Pick<UserConsents, "analytics" | "crashReports"> {
  const updatedAt = now.toISOString();
  return {
    analytics: { granted: preferences.analytics, updatedAt },
    crashReports: { granted: preferences.crashReports, updatedAt },
  };
}

const PERSONAL_KEY = /e-?mail|name|nome|phone|telefone|cpf|address|endereco|amount|valor|message/i;
const EMAIL_VALUE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Drops telemetry parameters that may carry personal data (names, emails,
 * amounts, free-text messages), so analytics only receives what it needs.
 */
export function sanitizeAnalyticsParams(
  params?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) return params;
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        !PERSONAL_KEY.test(key) && !(typeof value === "string" && EMAIL_VALUE.test(value)),
    ),
  );
}
