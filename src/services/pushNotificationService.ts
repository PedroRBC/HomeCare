import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Tipos de notificações
export type NotificationType =
  | "overdue_payment"
  | "payment_reminder"
  | "schedule_reminder"
  | "app_update"
  | "news"
  | "general";

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

// Configuração de canais de notificação Android
const NOTIFICATION_CHANNELS: Record<string, NotificationConfig> = {
  overdue_payments: {
    channelId: "overdue_payments",
    channelName: "Pagamentos em Atraso",
    channelDescription: "Notificações sobre pagamentos em atraso de cuidadores",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF6B6B",
  },
  payment_reminders: {
    channelId: "payment_reminders",
    channelName: "Lembretes de Pagamento",
    channelDescription: "Lembretes para realizar pagamentos de cuidadores",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 200],
    lightColor: "#4ECDC4",
  },
  schedule_reminders: {
    channelId: "schedule_reminders",
    channelName: "Lembretes de Agenda",
    channelDescription: "Lembretes sobre horários de trabalho dos cuidadores",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  },
  app_updates: {
    channelId: "app_updates",
    channelName: "Atualizações do App",
    channelDescription: "Notificações sobre atualizações do HomeCare",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 300, 150, 300],
    lightColor: "#45B7D1",
  },
  news: {
    channelId: "news",
    channelName: "Novidades",
    channelDescription: "Novidades e atualizações do HomeCare",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  general: {
    channelId: "general",
    channelName: "Geral",
    channelDescription: "Notificações gerais do HomeCare",
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
    try {
      if (this.isInitialized) {
        return { success: true, token: this.token ?? undefined, hasPermission: this.hasPermission };
      }

      // Configurar canais de notificação no Android
      if (Platform.OS === "android") {
        await this.setupNotificationChannels();
      }

      // Solicitar permissões do FCM
      const fcmPermission = await messaging().requestPermission();
      const hasFcmPermission =
        fcmPermission === messaging.AuthorizationStatus.AUTHORIZED ||
        fcmPermission === messaging.AuthorizationStatus.PROVISIONAL;

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
      this.token = await messaging().getToken();

      // Salvar o token no AsyncStorage
      if (this.token) {
        await AsyncStorage.setItem("fcmToken", this.token);
        console.log("FCM Token saved:", this.token);
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

  // Configurar canais de notificação (Android)
  private static async setupNotificationChannels(): Promise<void> {
    try {
      const channels = Object.values(NOTIFICATION_CHANNELS);

      for (const channel of channels) {
        await Notifications.setNotificationChannelAsync(channel.channelId, {
          name: channel.channelName,
          description: channel.channelDescription,
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
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
      console.log("Notification received in foreground:", remoteMessage);

      // Mostrar notificação local quando o app está em foreground
      await this.showLocalNotification(remoteMessage);
    });

    // Listener para notificações em background/quit
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log("Notification received in background:", remoteMessage);
    });

    // Listener para quando a notificação é aberta pelo usuário
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log("Notification opened by user:", remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Verificar se o app foi aberto clicando em uma notificação
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log("App opened from notification:", remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });

    // Listener para mudanças de token
    messaging().onTokenRefresh(async (newToken) => {
      console.log("FCM Token refreshed:", newToken);
      this.token = newToken;
      await AsyncStorage.setItem("fcmToken", newToken);
    });

    // Salvar unsubscribe function (pode ser útil mais tarde)
    (this as any).unsubscribeOnMessage = unsubscribeOnMessage;
  }

  // Mostrar notificação local
  private static async showLocalNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): Promise<void> {
    try {
      const { notification, data } = remoteMessage;
      const type = (data?.type as NotificationType) || "general";
      const channelId = this.getChannelIdForType(type);

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

  // Obter o canal de notificação para um tipo
  private static getChannelIdForType(type: NotificationType): string {
    const channelMap: Record<NotificationType, string> = {
      overdue_payment: "overdue_payments",
      payment_reminder: "payment_reminders",
      schedule_reminder: "schedule_reminders",
      app_update: "app_updates",
      news: "news",
      general: "general",
    };

    return channelMap[type] || "general";
  }

  // Manipular abertura de notificação
  private static handleNotificationOpen(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    const { data } = remoteMessage;
    const type = data?.type as NotificationType;

    // Aqui você pode adicionar lógica específica para cada tipo de notificação
    // Por exemplo, navegar para uma tela específica
    console.log("Handling notification open for type:", type, "data:", data);
  }

  // Obter o token do FCM
  static async getToken(): Promise<string | null> {
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
      this.token = await messaging().getToken();
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
    try {
      const authStatus = await messaging().hasPermission();
      const { status: expoStatus } = await Notifications.getPermissionsAsync();

      const fcmEnabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      return fcmEnabled && expoStatus === "granted";
    } catch (error) {
      console.error("Error checking notification permission:", error);
      return false;
    }
  }

  // Solicitar permissão de notificação
  static async requestPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const { status: expoStatus } = await Notifications.requestPermissionsAsync();

      const fcmEnabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

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
      const channelId = this.getChannelIdForType(type);

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
      const channelId = this.getChannelIdForType(type);

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

  // Obter número de badges
  static async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error("Error getting badge count:", error);
      return 0;
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

  // Limpar tudo
  static async clearAll(): Promise<void> {
    try {
      await this.cancelAllScheduledNotifications();
      await this.dismissAllNotifications();
      await this.setBadgeCount(0);
      console.log("All notifications cleared");
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  }

  // Obter configurações de canais (para debugging)
  static getNotificationChannels(): Record<string, NotificationConfig> {
    return NOTIFICATION_CHANNELS;
  }
}
