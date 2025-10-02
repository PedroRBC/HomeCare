import React from "react";
import { View, Text, Pressable } from "react-native";
import { NotificationService } from "@/services/notificationService";

export const NotificationDebug = () => {
  const testNotification = async () => {
    try {
      await NotificationService.initialize();

      // Schedule a test notification
      await NotificationService.scheduleOverdueNotification({
        id: "test-notification",
        caregiverName: "Maria Souza",
        caregiverId: "test-id",
        frequency: "Semanal",
        dueDate: new Date(),
        amount: 50,
        description: "Teste - Dia de hoje",
        shift: "day",
      });

      console.log("Test notification scheduled");
    } catch (error) {
      console.error("Error scheduling test notification:", error);
    }
  };

  const clearNotifications = async () => {
    try {
      await NotificationService.clearAllNotifications();
      console.log("All notifications cleared");
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  return (
    <View className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800 p-3">
      <Text className="font-subtitle mb-2 text-sm text-zinc-200">🧪 Debug Notifications</Text>
      <View className="flex-row gap-2">
        <Pressable onPress={testNotification} className="flex-1 rounded bg-blue-600 px-3 py-1">
          <Text className="font-subtitle text-center text-xs text-white">Test Notification</Text>
        </Pressable>
        <Pressable onPress={clearNotifications} className="flex-1 rounded bg-red-600 px-3 py-1">
          <Text className="font-subtitle text-center text-xs text-white">Clear All</Text>
        </Pressable>
      </View>
    </View>
  );
};
