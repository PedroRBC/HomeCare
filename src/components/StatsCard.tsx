import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: "emerald" | "blue" | "purple" | "amber" | "red";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export const StatsCard = ({
  title,
  value,
  icon,
  color = "emerald",
  trend,
  trendValue,
}: StatsCardProps) => {
  const getColorStyles = () => {
    switch (color) {
      case "blue":
        return {
          bg: "bg-blue-600/20",
          icon: "text-blue-400",
          value: "text-blue-300",
          title: "text-blue-200",
        };
      case "purple":
        return {
          bg: "bg-purple-600/20",
          icon: "text-purple-400",
          value: "text-purple-300",
          title: "text-purple-200",
        };
      case "amber":
        return {
          bg: "bg-amber-600/20",
          icon: "text-amber-400",
          value: "text-amber-300",
          title: "text-amber-200",
        };
      case "red":
        return {
          bg: "bg-red-600/20",
          icon: "text-red-400",
          value: "text-red-300",
          title: "text-red-200",
        };
      default:
        return {
          bg: "bg-emerald-600/20",
          icon: "text-emerald-400",
          value: "text-emerald-300",
          title: "text-emerald-200",
        };
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return "trending-up";
      case "down":
        return "trending-down";
      default:
        return "remove";
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-emerald-400";
      case "down":
        return "text-red-400";
      default:
        return "text-zinc-400";
    }
  };

  const styles = getColorStyles();

  return (
    <View className={`${styles.bg} rounded-xl border border-zinc-700/50 p-4`}>
      <View className="mb-3 flex-row items-center justify-between">
        <View className={`h-10 w-10 rounded-full ${styles.bg} items-center justify-center`}>
          <Ionicons
            name={icon as any}
            size={20}
            color={styles.icon.replace("text-", "").replace("-400", "")}
          />
        </View>
        {trend && trendValue && (
          <View className="flex-row items-center gap-1">
            <Ionicons
              name={getTrendIcon() as any}
              size={16}
              color={getTrendColor().replace("text-", "").replace("-400", "")}
            />
            <Text className={`text-xs ${getTrendColor()}`}>{trendValue}</Text>
          </View>
        )}
      </View>

      <Text className={`font-heading text-2xl ${styles.value} mb-1`}>{value}</Text>

      <Text className={`font-subtitle text-sm ${styles.title}`}>{title}</Text>
    </View>
  );
};
