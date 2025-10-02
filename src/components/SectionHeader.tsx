import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onActionPress?: () => void;
  icon?: string;
}

export const SectionHeader = ({
  title,
  subtitle,
  actionText,
  onActionPress,
  icon,
}: SectionHeaderProps) => {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-1">
        <View className="mb-1 flex-row items-center gap-2">
          {icon && <Ionicons name={icon as any} size={20} color="#9CA3AF" />}
          <Text className="font-heading text-lg text-zinc-200">{title}</Text>
        </View>
        {subtitle && <Text className="text-sm text-zinc-400">{subtitle}</Text>}
      </View>

      {actionText && onActionPress && (
        <Pressable
          onPress={onActionPress}
          className="flex-row items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text className="font-subtitle text-sm text-zinc-300">{actionText}</Text>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
};
