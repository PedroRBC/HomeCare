import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LoadingSpinnerProps {
  message?: string;
  size?: "small" | "medium" | "large";
}

export const LoadingSpinner = ({
  message = "Carregando...",
  size = "medium",
}: LoadingSpinnerProps) => {
  const getSize = () => {
    switch (size) {
      case "small":
        return 20;
      case "large":
        return 40;
      default:
        return 30;
    }
  };

  return (
    <View className="flex-1 items-center justify-center py-16">
      <View className="items-center gap-4">
        <Ionicons
          name="refresh"
          size={getSize()}
          color="#059669"
        />
        <Text className="font-subtitle text-zinc-400">{message}</Text>
      </View>
    </View>
  );
};
