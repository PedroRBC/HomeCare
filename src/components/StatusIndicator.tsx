import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StatusIndicatorProps {
  status: "success" | "warning" | "error" | "info";
  message: string;
  icon?: string;
}

export const StatusIndicator = ({ status, message, icon }: StatusIndicatorProps) => {
  const getStatusStyles = () => {
    switch (status) {
      case "success":
        return {
          container: "bg-emerald-900/20 border-emerald-800",
          icon: "text-emerald-400",
          text: "text-emerald-200",
          iconName: icon || "checkmark-circle-outline",
        };
      case "warning":
        return {
          container: "bg-amber-900/20 border-amber-800",
          icon: "text-amber-400",
          text: "text-amber-200",
          iconName: icon || "warning-outline",
        };
      case "error":
        return {
          container: "bg-red-900/20 border-red-800",
          icon: "text-red-400",
          text: "text-red-200",
          iconName: icon || "alert-circle-outline",
        };
      case "info":
        return {
          container: "bg-blue-900/20 border-blue-800",
          icon: "text-blue-400",
          text: "text-blue-200",
          iconName: icon || "information-circle-outline",
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <View className={`rounded-xl border p-4 ${styles.container}`}>
      <View className="flex-row items-center gap-3">
        <Ionicons
          name={styles.iconName as any}
          size={20}
          color={styles.icon.replace("text-", "").replace("-400", "")}
        />
        <Text className={`font-subtitle ${styles.text}`}>{message}</Text>
      </View>
    </View>
  );
};
