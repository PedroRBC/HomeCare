import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionText?: string;
  onActionPress?: () => void;
}

export const EmptyState = ({
  icon,
  title,
  description,
  actionText,
  onActionPress,
}: EmptyStateProps) => {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-zinc-800">
        <Ionicons name={icon as any} size={32} color="#9CA3AF" />
      </View>

      <Text className="font-heading mb-2 text-center text-xl text-zinc-200">{title}</Text>

      <Text className="mb-8 text-center leading-6 text-zinc-400">{description}</Text>

      {actionText && onActionPress && (
        <Pressable
          onPress={onActionPress}
          className="rounded-xl bg-emerald-600 px-6 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}>
          <Text className="font-subtitle text-white">{actionText}</Text>
        </Pressable>
      )}
    </View>
  );
};
