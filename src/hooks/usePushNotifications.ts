import { useEffect, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { PushNotificationService } from "@/services/pushNotificationService";

export const usePushNotifications = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Inicializar o serviço de notificações
  const initialize = useCallback(async () => {
    try {
      const result = await PushNotificationService.initialize();
      setIsInitialized(result.success);
      setHasPermission(result.hasPermission || false);
      setToken(result.token || null);
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  }, []);

  // Solicitar permissão
  const requestPermission = useCallback(async () => {
    try {
      const granted = await PushNotificationService.requestPermission();
      setHasPermission(granted);

      if (granted) {
        const fcmToken = await PushNotificationService.getToken();
        setToken(fcmToken);
      }

      return granted;
    } catch (error) {
      console.error("Error requesting permission:", error);
      return false;
    }
  }, []);

  // Verificar permissão
  const checkPermission = useCallback(async () => {
    try {
      const hasPerm = await PushNotificationService.checkPermission();
      setHasPermission(hasPerm);
      return hasPerm;
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }, []);

  // Obter token
  const getToken = useCallback(async () => {
    try {
      const fcmToken = await PushNotificationService.getToken();
      setToken(fcmToken);
      return fcmToken;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }, []);

  // Enviar notificação local
  const sendNotification = useCallback(
    async (
      title: string,
      body: string,
      data: Record<string, any> = {},
      type:
        | "overdue_payment"
        | "payment_reminder"
        | "schedule_reminder"
        | "app_update"
        | "news"
        | "general" = "general",
    ) => {
      await PushNotificationService.sendLocalNotification(title, body, data, type);
    },
    [],
  );

  // Agendar notificação local
  const scheduleNotification = useCallback(
    async (
      title: string,
      body: string,
      date: Date,
      data: Record<string, any> = {},
      type:
        | "overdue_payment"
        | "payment_reminder"
        | "schedule_reminder"
        | "app_update"
        | "news"
        | "general" = "general",
    ) => {
      try {
        return await PushNotificationService.scheduleLocalNotification(
          title,
          body,
          date,
          data,
          type,
        );
      } catch (error) {
        console.error("Error scheduling notification:", error);
        throw error;
      }
    },
    [],
  );

  // Cancelar todas as notificações
  const cancelAllNotifications = useCallback(async () => {
    await PushNotificationService.cancelAllScheduledNotifications();
  }, []);

  // Limpar todas as notificações
  const clearAll = useCallback(async () => {
    await PushNotificationService.clearAll();
  }, []);

  // Obter notificações agendadas
  const getScheduledNotifications = useCallback(async () => {
    return await PushNotificationService.getScheduledNotifications();
  }, []);

  // Inicializar ao montar
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Verificar permissão quando o app voltar para foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        checkPermission();
      }
    });

    return () => subscription?.remove();
  }, [checkPermission]);

  return {
    isInitialized,
    hasPermission,
    token,
    initialize,
    requestPermission,
    checkPermission,
    getToken,
    sendNotification,
    scheduleNotification,
    cancelAllNotifications,
    clearAll,
    getScheduledNotifications,
  };
};
