import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationService } from "@/services/notificationService";
import { useTranslation } from "react-i18next";

export const NotificationStatus = () => {
  const { t } = useTranslation();
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      // Check permission status
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === "granted");

      // Get scheduled notifications count
      const scheduledNotifications = await NotificationService.getScheduledNotifications();
      const overdueCount = scheduledNotifications.filter((notification) =>
        notification.identifier.startsWith("overdue-"),
      ).length;

      setNotificationCount(overdueCount);
    } catch (error) {
      console.error("Error checking notification status:", error);
    }
  };

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setHasPermission(status === "granted");

      if (status === "granted") {
        await NotificationService.initialize();
        checkNotificationStatus();
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  if (!hasPermission) {
    return (
      <View className="border-warning bg-warning-soft mb-4 rounded-lg border p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-subtitle text-warning text-sm">
              {t("common.notificationStatus.disabledTitle")}
            </Text>
            <Text className="text-muted mt-1 text-xs">
              {t("common.notificationStatus.disabledHint")}
            </Text>
          </View>
          <Pressable onPress={requestPermission} className="rounded bg-amber-600 px-3 py-1">
            <Text className="font-subtitle text-xs text-white">
              {t("common.notificationStatus.enable")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (notificationCount > 0) {
    return (
      <View className="border-danger bg-danger-soft mb-4 rounded-lg border p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-subtitle text-danger text-sm">
              {t("common.notificationStatus.overdue", { count: notificationCount })}
            </Text>
            <Text className="text-muted mt-1 text-xs">
              {t("common.notificationStatus.checkPending")}
            </Text>
          </View>
          <View className="rounded bg-rose-600 px-2 py-1">
            <Text className="font-subtitle text-xs text-white">{notificationCount}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
};
