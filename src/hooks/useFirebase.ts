import { useEffect } from "react";
import { AnalyticsService, CrashlyticsService, initializeFirebase } from "@/services/firebase";

export const useFirebase = () => {
  useEffect(() => {
    initializeFirebase();
  }, []);

  return {
    analytics: AnalyticsService,
    crashlytics: CrashlyticsService,
  };
};

// Hook for tracking screen views
export const useScreenTracking = (screenName: string, screenClass?: string) => {
  useEffect(() => {
    AnalyticsService.trackScreenView(screenName, screenClass);
  }, [screenName, screenClass]);
};

// Hook for error boundary integration
export const useErrorTracking = () => {
  const logError = (error: Error, context?: string) => {
    CrashlyticsService.logError(error, context);
  };

  const logMessage = (message: string) => {
    CrashlyticsService.log(message);
  };

  return {
    logError,
    logMessage,
  };
};
