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
import { sanitizeAnalyticsParams, type TelemetryPreferences } from "@/utils/privacy";

// Analytics Service
export const AnalyticsService = {
  // Track screen views
  trackScreenView: async (screenName: string, screenClass?: string) => {
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
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, eventName as any, sanitizeAnalyticsParams(parameters));
    } catch (error) {
      console.warn("Analytics event tracking failed:", error);
    }
  },

  // Track caregiver actions (never the caregiver's personal data)
  trackCaregiverAction: async (action: string, caregiverId: string) => {
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
    try {
      const analyticsInstance = getAnalytics();
      await setUserProperty(analyticsInstance, name, value);
    } catch (error) {
      console.warn("Analytics user property setting failed:", error);
    }
  },

  // Set user ID
  setUserId: async (userId: string) => {
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
    try {
      const crashlyticsInstance = getCrashlytics();
      log(crashlyticsInstance, message);
    } catch (error) {
      console.warn("Crashlytics logging failed:", error);
    }
  },

  // Set user identifier
  setUserId: (userId: string) => {
    try {
      const crashlyticsInstance = getCrashlytics();
      setCrashlyticsUserId(crashlyticsInstance, userId);
    } catch (error) {
      console.warn("Crashlytics user ID setting failed:", error);
    }
  },

  // Set custom attributes
  setAttribute: (key: string, value: string) => {
    try {
      const crashlyticsInstance = getCrashlytics();
      setAttribute(crashlyticsInstance, key, value);
    } catch (error) {
      console.warn("Crashlytics attribute setting failed:", error);
    }
  },
};

const TELEMETRY_CONSENT_KEY = "homecare.telemetryConsent";
const NO_TELEMETRY: TelemetryPreferences = { analytics: false, crashReports: false };

// Analytics and crash reports only run with the user's consent (LGPD art. 7, I).
// Both start disabled (see firebase.json) until the user's choice is known.
export const TelemetryService = {
  // Throws if the device could not enforce the choice, so a revocation is never
  // reported (or remembered) without having been applied
  apply: async (preferences: TelemetryPreferences) => {
    const analyticsInstance = getAnalytics();
    await setConsent(analyticsInstance, {
      analytics_storage: preferences.analytics,
      ad_storage: false,
      ad_user_data: false,
      ad_personalization: false,
    });
    await setAnalyticsCollectionEnabled(analyticsInstance, preferences.analytics);
    await setCrashlyticsCollectionEnabled(getCrashlytics(), preferences.crashReports);
    await AsyncStorage.setItem(TELEMETRY_CONSENT_KEY, JSON.stringify(preferences));
  },

  stored: async (): Promise<TelemetryPreferences> => {
    try {
      const stored = await AsyncStorage.getItem(TELEMETRY_CONSENT_KEY);
      return stored ? { ...NO_TELEMETRY, ...JSON.parse(stored) } : NO_TELEMETRY;
    } catch {
      return NO_TELEMETRY;
    }
  },

  // Stops collection and drops what was collected on this device (logout, account deletion)
  reset: async () => {
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
    await TelemetryService.apply(await TelemetryService.stored());

    // Set default user properties
    await AnalyticsService.setUserProperty("app_version", "1.0.0");
    await AnalyticsService.setUserProperty("platform", "mobile");
  } catch (error) {
    console.warn("Firebase initialization failed:", error);
    CrashlyticsService.logError(error as Error, "Firebase initialization");
  }
};
