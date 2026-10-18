import i18n, { t as translate } from "i18next";
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isFirebaseEmulatorMode } from "@/utils/firebaseEmulatorConfig";

// Tipos de notificações
export type NotificationType =
  "overdue_payment" | "payment_reminder" | "schedule_reminder" | "app_update" | "news" | "general";

export interface PushNotificationData {
  type: NotificationType;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  priority?: "high" | "normal";
}

export interface NotificationConfig {
  channelId: string;
  channelName: string;
  channelDescription: string;
  importance: Notifications.AndroidImportance;
  sound?: string;
  vibrationPattern?: number[];
  lightColor?: string;
}

// Configuração de canais de notificação Android (channelName/channelDescription are i18n keys)
const NOTIFICATION_CHANNELS: Record<string, NotificationConfig> = {
  overdue_payments: {
    channelId: "overdue_payments",
    channelName: "notifications.channels.overdue.name",
    channelDescription: "notifications.channels.overdue.description",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF6B6B",
  },
  payment_reminders: {
    channelId: "payment_reminders",
    channelName: "notifications.channels.reminders.name",
    channelDescription: "notifications.channels.reminders.description",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 200],
    lightColor: "#4ECDC4",
  },
  schedule_reminders: {
    channelId: "schedule_reminders",
    channelName: "notifications.channels.schedule.name",
    channelDescription: "notifications.channels.schedule.description",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  },
  app_updates: {
    channelId: "app_updates",
    channelName: "notifications.channels.updates.name",
    channelDescription: "notifications.channels.updates.description",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 300, 150, 300],
    lightColor: "#45B7D1",
  },
  news: {
    channelId: "news",
    channelName: "notifications.channels.news.name",
    channelDescription: "notifications.channels.news.description",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  general: {
    channelId: "general",
    channelName: "notifications.channels.general.name",
    channelDescription: "notifications.channels.general.description",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
};

// Configurar o handler de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class PushNotificationService {
  private static isInitialized = false;
  private static hasPermission = false;
  private static token: string | null = null;

  // Inicializar o serviço de notificações
  static async initialize(): Promise<{
    success: boolean;
    token?: string;
    hasPermission?: boolean;
  }> {
    if (isFirebaseEmulatorMode()) return { success: false, hasPermission: false };
    try {
      if (this.isInitialized) {
        return { success: true, token: this.token ?? undefined, hasPermission: this.hasPermission };
      }

      // Configurar canais de notificação no Android
      if (Platform.OS === "android") {
        await this.setupNotificationChannels();
        // Channel names are shown in system settings: keep them in the app language
        i18n.off("languageChanged", this.handleLanguageChanged);
        i18n.on("languageChanged", this.handleLanguageChanged);
      }

      // Solicitar permissões do FCM
      const fcmPermission = await requestPermission(getMessaging());
      const hasFcmPermission =
        fcmPermission === AuthorizationStatus.AUTHORIZED ||
        fcmPermission === AuthorizationStatus.PROVISIONAL;

      if (!hasFcmPermission) {
        console.log("FCM permission not granted");
        return { success: false, hasPermission: false };
      }

      // Solicitar permissões do Expo Notifications
      const { status: expoStatus } = await Notifications.getPermissionsAsync();
      let finalExpoStatus = expoStatus;

      if (expoStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalExpoStatus = status;
      }

      this.hasPermission = finalExpoStatus === "granted";

      // Obter o token do FCM
      this.token = await getToken(getMessaging());

      // Salvar o token no AsyncStorage
      if (this.token) {
        await AsyncStorage.setItem("fcmToken", this.token);
        console.log("FCM token saved");
      }

      // Configurar listeners de notificações
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log("Push notification service initialized successfully");

      return { success: true, token: this.token, hasPermission: this.hasPermission };
    } catch (error) {
      console.error("Error initializing push notification service:", error);
      return { success: false };
    }
  }

  private static handleLanguageChanged = () => {
    PushNotificationService.setupNotificationChannels();
  };

  // Configurar canais de notificação (Android)
  static async setupNotificationChannels(): Promise<void> {
    try {
      const channels = Object.values(NOTIFICATION_CHANNELS);

      for (const channel of channels) {
        await Notifications.setNotificationChannelAsync(channel.channelId, {
          name: translate(channel.channelName),
          description: translate(channel.channelDescription),
          importance: channel.importance,
          sound: channel.sound || "default",
          vibrationPattern: channel.vibrationPattern,
          lightColor: channel.lightColor,
        });
      }

      console.log("Notification channels configured successfully");
    } catch (error) {
      console.error("Error setting up notification channels:", error);
    }
  }

  // Configurar listeners de notificações
  private static setupNotificationListeners(): void {
    // Listener para notificações recebidas em foreground
    const unsubscribeOnMessage = onMessage(getMessaging(), async (remoteMessage) => {
      console.log("Notification received in foreground");

      // Mostrar notificação local quando o app está em foreground
      await this.showLocalNotification(remoteMessage);
    });

    // Listener para notificações em background/quit
    setBackgroundMessageHandler(getMessaging(), async () => {
      console.log("Notification received in background");
    });

    // Listener para quando a notificação é aberta pelo usuário
    onNotificationOpenedApp(getMessaging(), (remoteMessage) => {
      console.log("Notification opened by user");
      this.handleNotificationOpen(remoteMessage);
    });

    // Verificar se o app foi aberto clicando em uma notificação
    getInitialNotification(getMessaging()).then((remoteMessage) => {
      if (remoteMessage) {
        console.log("App opened from notification");
        this.handleNotificationOpen(remoteMessage);
      }
    });

    // Listener para mudanças de token
    onTokenRefresh(getMessaging(), async (newToken) => {
      console.log("FCM token refreshed");
      this.token = newToken;
      await AsyncStorage.setItem("fcmToken", newToken);
    });

    // Salvar unsubscribe function (pode ser útil mais tarde)
    (this as any).unsubscribeOnMessage = unsubscribeOnMessage;
  }

  // Mostrar notificação local
  private static async showLocalNotification(remoteMessage: RemoteMessage): Promise<void> {
    try {
      const { notification, data } = remoteMessage;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification?.title || "HomeCare",
          body: notification?.body || "",
          data: data || {},
          sound: true,
          badge: 0,
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Error showing local notification:", error);
    }
  }

  // Manipular abertura de notificação
  private static handleNotificationOpen(remoteMessage: RemoteMessage): void {
    const { data } = remoteMessage;
    const type = data?.type as NotificationType;

    // Aqui você pode adicionar lógica específica para cada tipo de notificação
    // Por exemplo, navegar para uma tela específica
    console.log("Handling notification open for type:", type);
  }

  // Obter o token do FCM
  static async getToken(): Promise<string | null> {
    if (isFirebaseEmulatorMode()) return null;
    try {
      if (this.token) {
        return this.token;
      }

      // Tentar obter do AsyncStorage primeiro
      const savedToken = await AsyncStorage.getItem("fcmToken");
      if (savedToken) {
        this.token = savedToken;
        return savedToken;
      }

      // Se não tiver token, obter do FCM
      this.token = await getToken(getMessaging());
      if (this.token) {
        await AsyncStorage.setItem("fcmToken", this.token);
      }

      return this.token;
    } catch (error) {
      console.error("Error getting FCM token:", error);
      return null;
    }
  }

  // Verificar se tem permissão de notificação
  static async checkPermission(): Promise<boolean> {
    if (isFirebaseEmulatorMode()) return false;
    try {
      const authStatus = await hasPermission(getMessaging());
      const { status: expoStatus } = await Notifications.getPermissionsAsync();

      const fcmEnabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      return fcmEnabled && expoStatus === "granted";
    } catch (error) {
      console.error("Error checking notification permission:", error);
      return false;
    }
  }

  // Solicitar permissão de notificação
  static async requestPermission(): Promise<boolean> {
    if (isFirebaseEmulatorMode()) return false;
    try {
      const authStatus = await requestPermission(getMessaging());
      const { status: expoStatus } = await Notifications.requestPermissionsAsync();

      const fcmEnabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      return fcmEnabled && expoStatus === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  // Enviar notificação local (para testes)
  static async sendLocalNotification(
    title: string,
    body: string,
    data: Record<string, any> = {},
    type: NotificationType = "general",
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { ...data, type },
          sound: true,
          badge: 0,
        },
        trigger: null,
      });

      console.log("Local notification sent:", title, body);
    } catch (error) {
      console.error("Error sending local notification:", error);
    }
  }

  // Agendar notificação local
  static async scheduleLocalNotification(
    title: string,
    body: string,
    date: Date,
    data: Record<string, any> = {},
    type: NotificationType = "general",
  ): Promise<string> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { ...data, type },
          sound: true,
          badge: 0,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });

      console.log("Local notification scheduled:", identifier);
      return identifier;
    } catch (error) {
      console.error("Error scheduling local notification:", error);
      throw error;
    }
  }

  // Cancelar todas as notificações agendadas
  static async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("All scheduled notifications cancelled");
    } catch (error) {
      console.error("Error cancelling scheduled notifications:", error);
    }
  }

  // Obter todas as notificações agendadas
  static async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Error getting scheduled notifications:", error);
      return [];
    }
  }

  // Descartar todas as notificações apresentadas
  static async dismissAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log("All notifications dismissed");
    } catch (error) {
      console.error("Error dismissing notifications:", error);
    }
  }

  // Definir número de badges
  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error("Error setting badge count:", error);
    }
  }

  // Ends the notification session: work started before this call must not
  // show notifications afterwards (see isSessionCurrent)
  private static session = 0;

  static currentSession(): number {
    return this.session;
  }

  static isSessionCurrent(session: number): boolean {
    return session === this.session;
  }

  // Limpar tudo
  static async clearAll(): Promise<void> {
    this.session++;
    try {
      await this.cancelAllScheduledNotifications();
      await this.dismissAllNotifications();
      await this.setBadgeCount(0);
      console.log("All notifications cleared");
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  }
}
