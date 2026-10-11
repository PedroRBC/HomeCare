import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme";

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
  const { colors } = useAppTheme();
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="bg-surface mb-6 h-20 w-20 items-center justify-center rounded-full">
        <Ionicons name={icon as any} size={32} color={colors.textMuted} />
      </View>

      <Text className="font-heading text-content mb-2 text-center text-xl">{title}</Text>

      <Text className="text-muted mb-8 text-center leading-6">{description}</Text>

      {actionText && onActionPress && (
        <Pressable
          onPress={onActionPress}
          className="bg-primary rounded-xl px-6 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}>
          <Text className="font-subtitle text-on-primary">{actionText}</Text>
        </Pressable>
      )}
    </View>
  );
};
