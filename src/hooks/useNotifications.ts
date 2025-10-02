import { useEffect, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { NotificationService } from "@/services/notificationService";
import { useSchedule } from "@/context/ScheduleContext";

export const useNotifications = () => {
  const { caregivers, scheduleByDay, payments, isFirestoreConnected } = useSchedule();

  // Initialize notifications and check for overdue payments
  const initializeNotifications = useCallback(async () => {
    try {
      const hasPermission = await NotificationService.initialize();
      if (hasPermission && isFirestoreConnected) {
        await NotificationService.checkAndScheduleOverdueNotifications(
          caregivers,
          scheduleByDay,
          payments,
        );
      }
    } catch (error) {
      console.error("Error initializing notifications:", error);
    }
  }, [caregivers, scheduleByDay, payments, isFirestoreConnected]);

  // Check for overdue payments when app becomes active
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        initializeNotifications();
      }
    },
    [initializeNotifications],
  );

  // Set up app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Initialize notifications on mount and when data changes
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  return {
    initializeNotifications,
  };
};
