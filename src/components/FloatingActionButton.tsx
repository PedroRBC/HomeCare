import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon: string;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "secondary" | "success" | "warning";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
}

export const FloatingActionButton = ({
  onPress,
  icon,
  size = "medium",
  variant = "primary",
  position = "bottom-right",
}: FloatingActionButtonProps) => {
  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return "w-12 h-12";
      case "large":
        return "w-16 h-16";
      default:
        return "w-14 h-14";
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "small":
        return 20;
      case "large":
        return 28;
      default:
        return 24;
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return "bg-zinc-700 border-zinc-600";
      case "success":
        return "bg-emerald-600 border-emerald-500";
      case "warning":
        return "bg-amber-600 border-amber-500";
      default:
        return "bg-emerald-600 border-emerald-500";
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case "bottom-left":
        return "bottom-6 left-6";
      case "bottom-center":
        return "bottom-6 left-1/2 transform -translate-x-1/2";
      default:
        return "bottom-6 right-6";
    }
  };

  return (
    <View className={`absolute ${getPositionStyles()} z-50`}>
      <Pressable
        onPress={onPress}
        className={`${getSizeStyles()} ${getVariantStyles()} items-center justify-center rounded-full border-2 shadow-lg shadow-black/25`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}>
        <Ionicons name={icon as any} size={getIconSize()} color="white" />
      </Pressable>
    </View>
  );
};
