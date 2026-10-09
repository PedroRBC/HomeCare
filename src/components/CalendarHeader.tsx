import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

type Props = {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
};

export const CalendarHeader = ({ monthLabel, onPrev, onNext, onToday }: Props) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <View className="mb-3 gap-1">
      {/* Month/Year Display */}
      <View className="items-center">
        <Text className="font-heading text-content mb-1 text-2xl">
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </Text>
        <View className="bg-primary h-1 w-16 rounded-full" />
      </View>

      {/* Navigation Controls */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPrev}
          className="border-divider bg-surface/50 flex-row items-center gap-2 rounded-xl border px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text className="text-content text-sm font-medium">{t("common.previous")}</Text>
        </Pressable>

        {onToday && (
          <Pressable
            onPress={onToday}
            className="bg-surface-raised/30 rounded-lg px-4 py-2"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <Text className="text-muted text-xs font-medium">{t("common.today")}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onNext}
          className="border-divider bg-surface/50 flex-row items-center gap-2 rounded-xl border px-4 py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Text className="text-content text-sm font-medium">{t("common.next")}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
};
