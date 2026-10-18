import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAnalytics,
  logEvent,
  resetAnalyticsData,
  setAnalyticsCollectionEnabled,
  setConsent,
  setUserProperty,
  setUserId,
} from "@react-native-firebase/analytics";
import {
  deleteUnsentReports,
  getCrashlytics,
  log,
  recordError,
  setCrashlyticsCollectionEnabled,
  setUserId as setCrashlyticsUserId,
  setAttribute,
} from "@react-native-firebase/crashlytics";
import {
  restrictTelemetry,
  sanitizeAnalyticsParams,
  type TelemetryPreferences,
} from "@/utils/privacy";
import { createSerialQueue } from "@/utils/serialQueue";
import { isFirebaseEmulatorMode } from "@/utils/firebaseEmulatorConfig";

// Analytics Service
export const AnalyticsService = {
  // Track screen views
  trackScreenView: async (screenName: string, screenClass?: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.analytics) return;
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, "screen_view" as any, {
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.warn("Analytics screen view tracking failed:", error);
    }
  },

  // Track custom events. Parameters that may hold personal data are dropped.
  trackEvent: async (eventName: string, parameters?: { [key: string]: any }) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.analytics) return;
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, eventName as any, sanitizeAnalyticsParams(parameters));
    } catch (error) {
      console.warn("Analytics event tracking failed:", error);
    }
  },

  // Track caregiver actions (never the caregiver's personal data)
  trackCaregiverAction: async (action: string, caregiverId: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.analytics) return;
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, "caregiver_action" as any, {
        action,
        caregiver_id: caregiverId,
      });
    } catch (error) {
      console.warn("Analytics caregiver action tracking failed:", error);
    }
  },

  // Track calendar interactions
  trackCalendarInteraction: async (action: string, date: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.analytics) return;
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, "calendar_interaction" as any, {
        action,
        date,
      });
    } catch (error) {
      console.warn("Analytics calendar interaction tracking failed:", error);
    }
  },

  // Set user properties
  setUserProperty: async (name: string, value: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.analytics) return;
    try {
      const analyticsInstance = getAnalytics();
      await setUserProperty(analyticsInstance, name, value);
    } catch (error) {
      console.warn("Analytics user property setting failed:", error);
    }
  },

  // Set user ID
  setUserId: async (userId: string) => {
    if (isFirebaseEmulatorMode() || (userId && !enforcedPreferences.analytics)) return;
    try {
      const analyticsInstance = getAnalytics();
      await setUserId(analyticsInstance, userId);
    } catch (error) {
      console.warn("Analytics user ID setting failed:", error);
    }
  },
};

// Crashlytics Service
export const CrashlyticsService = {
  // Log custom errors
  logError: (error: Error, context?: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.crashReports) return;
    try {
      const crashlyticsInstance = getCrashlytics();
      if (context) {
        log(crashlyticsInstance, context);
      }
      recordError(crashlyticsInstance, error);
    } catch (crashlyticsError) {
      console.warn("Crashlytics error logging failed:", crashlyticsError);
    }
  },

  // Log custom messages
  log: (message: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.crashReports) return;
    try {
      const crashlyticsInstance = getCrashlytics();
      log(crashlyticsInstance, message);
    } catch (error) {
      console.warn("Crashlytics logging failed:", error);
    }
  },

  // Set user identifier
  setUserId: (userId: string) => {
    if (isFirebaseEmulatorMode() || (userId && !enforcedPreferences.crashReports)) return;
    try {
      const crashlyticsInstance = getCrashlytics();
      setCrashlyticsUserId(crashlyticsInstance, userId);
    } catch (error) {
      console.warn("Crashlytics user ID setting failed:", error);
    }
  },

  // Set custom attributes
  setAttribute: (key: string, value: string) => {
    if (isFirebaseEmulatorMode() || !enforcedPreferences.crashReports) return;
    try {
      const crashlyticsInstance = getCrashlytics();
      setAttribute(crashlyticsInstance, key, value);
    } catch (error) {
      console.warn("Crashlytics attribute setting failed:", error);
    }
  },
};

const PENDING_REVOCATION_KEY = "homecare.telemetryRevocation";
const NO_TELEMETRY: TelemetryPreferences = { analytics: false, crashReports: false };
let enforcedPreferences = { ...NO_TELEMETRY };
let applicationRevision = 0;

// Choices are applied one at a time, in the order they were made: a slow "on"
// can't land after a later "off"
const enqueue = createSerialQueue();

async function enforce(preferences: TelemetryPreferences) {
  const operations = [
    {
      enabled: preferences.analytics,
      apply: () =>
        setConsent(getAnalytics(), {
          analytics_storage: preferences.analytics,
          ad_storage: false,
          ad_user_data: false,
          ad_personalization: false,
        }),
    },
    {
      enabled: preferences.analytics,
      apply: () => setAnalyticsCollectionEnabled(getAnalytics(), preferences.analytics),
    },
    {
      enabled: preferences.crashReports,
      apply: () => setCrashlyticsCollectionEnabled(getCrashlytics(), preferences.crashReports),
    },
  ];
  // Every requested disable is attempted even if another SDK call fails. No
  // opt-in is attempted until all requested revocations have succeeded.
  const disables = await Promise.allSettled(
    operations
      .filter((operation) => !operation.enabled)
      .map((operation) => Promise.resolve().then(() => operation.apply())),
  );
  const failures = disables.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Could not enforce every telemetry revocation",
    );
  }
  for (const operation of operations.filter((operation) => operation.enabled)) {
    await operation.apply();
  }
}

/** Persist SDK-level opt-outs in local-emulator mode, including prior device state. */
export async function disableTelemetryForLocalEmulators(): Promise<void> {
  enforcedPreferences = { ...NO_TELEMETRY };
  applicationRevision++;
  await enforce(NO_TELEMETRY);
}

const revocationKey = (uid: string) => `${PENDING_REVOCATION_KEY}.${uid}`;
type RevocationTicket = Partial<Record<keyof TelemetryPreferences, number>>;
type RevocationState = { sequence: number; revoked: RevocationTicket };

async function readRevocation(uid: string): Promise<RevocationState> {
  const stored = await AsyncStorage.getItem(revocationKey(uid));
  if (!stored) return { sequence: 0, revoked: {} };
  const parsed = JSON.parse(stored);
  if (parsed?.revoked && typeof parsed.revoked === "object" && !Array.isArray(parsed.revoked)) {
    if (
      !Number.isSafeInteger(parsed.sequence) ||
      parsed.sequence < 0 ||
      Object.entries(parsed.revoked).some(
        ([purpose, revision]) =>
          !["analytics", "crashReports"].includes(purpose) ||
          !Number.isSafeInteger(revision) ||
          Number(revision) < 0 ||
          Number(revision) > parsed.sequence,
      )
    ) {
      throw new Error("Invalid pending telemetry revocation");
    }
    return parsed as RevocationState;
  }
  if (typeof parsed?.analytics !== "boolean" || typeof parsed?.crashReports !== "boolean") {
    throw new Error("Invalid pending telemetry revocation");
  }
  // Preserve revocations written by the previous format.
  return {
    sequence: 0,
    revoked: {
      ...(parsed.analytics === false && { analytics: 0 }),
      ...(parsed.crashReports === false && { crashReports: 0 }),
    },
  };
}

// Analytics and crash reports only run with the user's consent (LGPD art. 7, I).
// Both start disabled (see firebase.json) until the user's choice is known.
export const TelemetryService = {
  // Throws if the device could not enforce the choice, so a revocation is never
  // reported (or remembered) without having been applied. Skipped, returning false,
  // when `isCurrent` says the session it was meant for has ended meanwhile.
  apply: (preferences: TelemetryPreferences, isCurrent: () => boolean = () => true) => {
    if (!isCurrent()) return Promise.resolve(false);
    if (isFirebaseEmulatorMode()) {
      enforcedPreferences = { ...NO_TELEMETRY };
      return Promise.resolve(true);
    }
    const revision = ++applicationRevision;
    // Stop client-emitted events immediately; enables only become effective once
    // the latest current-session SDK operation succeeds.
    enforcedPreferences = restrictTelemetry(enforcedPreferences, preferences);
    return enqueue(async () => {
      if (!isCurrent()) return false;
      await enforce(preferences);
      if (!isCurrent()) return false;
      if (revision === applicationRevision) enforcedPreferences = { ...preferences };
      return true;
    });
  },

  // Revocations made on this device that couldn't be recorded in the account yet
  // (false for each revoked purpose). They hold until recorded, also across restarts.
  pendingRevocation: (uid: string) =>
    enqueue(async () => {
      const { revoked } = await readRevocation(uid);
      return Object.keys(revoked).length
        ? {
            analytics: revoked.analytics === undefined,
            crashReports: revoked.crashReports === undefined,
          }
        : null;
    }),
  pendingRevocationTicket: (uid: string) =>
    enqueue(async () => ({ ...(await readRevocation(uid)).revoked })),

  addPendingRevocation: (uid: string, allowed: TelemetryPreferences) =>
    enqueue(async () => {
      const current = await readRevocation(uid);
      const sequence = current.sequence + 1;
      const revoked = {
        ...current.revoked,
        ...(!allowed.analytics && { analytics: sequence }),
        ...(!allowed.crashReports && { crashReports: sequence }),
      };
      await AsyncStorage.setItem(revocationKey(uid), JSON.stringify({ sequence, revoked }));
      return revoked;
    }),

  // The given purposes are now recorded in the account
  clearPendingRevocation: async (
    uid: string,
    purposes: readonly (keyof TelemetryPreferences)[],
    expected: RevocationTicket,
  ) => {
    await enqueue(async () => {
      const current = await readRevocation(uid);
      const revoked = { ...current.revoked };
      purposes.forEach((purpose) => {
        if (revoked[purpose] === expected[purpose]) delete revoked[purpose];
      });
      // Keep the sequence after clearing; an old acknowledgement can never match
      // a later revocation merely because all earlier ones were recorded.
      await AsyncStorage.setItem(revocationKey(uid), JSON.stringify({ ...current, revoked }));
    });
  },

  // Stops collection and drops what was collected on this device (logout, account deletion)
  reset: async () => {
    if (isFirebaseEmulatorMode()) {
      enforcedPreferences = { ...NO_TELEMETRY };
      return;
    }
    try {
      await TelemetryService.apply(NO_TELEMETRY);
      await resetAnalyticsData(getAnalytics());
      await deleteUnsentReports(getCrashlytics());
    } catch (error) {
      console.warn("Resetting telemetry data failed:", error);
    }
  },
};

// Initialize Firebase services
export const initializeFirebase = async () => {
  try {
    // A device-global preference is not evidence of the current account's consent.
    // AuthContext applies only that account's choices after loading its profile.
    await TelemetryService.apply(NO_TELEMETRY);

    // Set default user properties
    await AnalyticsService.setUserProperty("app_version", "1.0.0");
    await AnalyticsService.setUserProperty("platform", "mobile");
  } catch (error) {
    console.warn("Firebase initialization failed:", error);
  }
};
