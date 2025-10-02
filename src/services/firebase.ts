import {
  getAnalytics,
  logEvent,
  setAnalyticsCollectionEnabled,
  setUserProperty,
  setUserId,
} from "@react-native-firebase/analytics";
import {
  getCrashlytics,
  log,
  recordError,
  setUserId as setCrashlyticsUserId,
  setAttribute,
  crash,
} from "@react-native-firebase/crashlytics";

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

  // Track custom events
  trackEvent: async (eventName: string, parameters?: { [key: string]: any }) => {
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, eventName as any, parameters);
    } catch (error) {
      console.warn("Analytics event tracking failed:", error);
    }
  },

  // Track caregiver actions
  trackCaregiverAction: async (action: string, caregiverId: string, caregiverName: string) => {
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, "caregiver_action" as any, {
        action,
        caregiver_id: caregiverId,
        caregiver_name: caregiverName,
      });
    } catch (error) {
      console.warn("Analytics caregiver action tracking failed:", error);
    }
  },

  // Track payment actions
  trackPaymentAction: async (
    action: string,
    amount: number,
    frequency: string,
    caregiverId: string,
  ) => {
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, "payment_action" as any, {
        action,
        amount,
        frequency,
        caregiver_id: caregiverId,
        currency: "BRL",
      });
    } catch (error) {
      console.warn("Analytics payment action tracking failed:", error);
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

  // Set multiple attributes
  setAttributes: (attributes: { [key: string]: string }) => {
    try {
      const crashlyticsInstance = getCrashlytics();
      Object.entries(attributes).forEach(([key, value]) => {
        setAttribute(crashlyticsInstance, key, value);
      });
    } catch (error) {
      console.warn("Crashlytics attributes setting failed:", error);
    }
  },

  // Test crash (for development only)
  testCrash: () => {
    try {
      const crashlyticsInstance = getCrashlytics();
      crash(crashlyticsInstance);
    } catch (error) {
      console.warn("Crashlytics test crash failed:", error);
    }
  },
};

// Initialize Firebase services
export const initializeFirebase = async () => {
  try {
    // Enable analytics collection
    const analyticsInstance = getAnalytics();
    await setAnalyticsCollectionEnabled(analyticsInstance, true);

    // Set default user properties
    await AnalyticsService.setUserProperty("app_version", "1.0.0");
    await AnalyticsService.setUserProperty("platform", "mobile");

    console.log("Firebase services initialized successfully");
  } catch (error) {
    console.warn("Firebase initialization failed:", error);
    CrashlyticsService.logError(error as Error, "Firebase initialization");
  }
};
