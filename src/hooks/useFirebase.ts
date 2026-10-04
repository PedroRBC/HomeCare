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
