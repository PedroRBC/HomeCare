import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { NotificationService } from "@/services/notificationService";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

export const NotificationStatus = () => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
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
      <View className="bg-warning-soft gap-2.5 rounded-xl p-3.5">
        <View className="flex-row items-center gap-[7px]">
          <Ionicons name="notifications-off-outline" size={17} color={colors.warning} />
          <Text className="font-subtitle text-warning text-[13px]">
            {t("common.notificationStatus.disabledTitle")}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Text className="text-warning flex-1 text-xs leading-[17px]">
            {t("common.notificationStatus.disabledHint")}
          </Text>
          <Pressable
            onPress={requestPermission}
            className="bg-surface h-9 justify-center rounded-xl px-[13px]">
            <Text className="font-subtitle text-warning text-xs">
              {t("common.notificationStatus.enable")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (notificationCount > 0) {
    return (
      <View className="bg-danger-soft gap-2.5 rounded-xl p-3.5">
        <View className="flex-row items-center gap-[7px]">
          <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
          <Text className="font-subtitle text-danger text-[13px]">
            {t("common.notificationStatus.overdue", { count: notificationCount })}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Text className="text-danger flex-1 text-xs leading-[17px]">
            {t("common.notificationStatus.checkPending")}
          </Text>
          <View className="bg-danger rounded-full px-2 py-0.5">
            <Text className="font-subtitle text-on-primary text-xs">{notificationCount}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
};
