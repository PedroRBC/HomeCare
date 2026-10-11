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
    <View className="mb-3.5 gap-3.5">
      {/* Month/Year Display */}
      <Text className="font-subtitle text-content text-xl">
        {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
      </Text>

      {/* Navigation Controls */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPrev}
          className="flex-row items-center gap-1"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
          <Text className="text-muted text-xs">{t("common.previous")}</Text>
        </Pressable>

        {onToday && (
          <Pressable
            onPress={onToday}
            className="bg-primary-soft h-8 justify-center rounded-xl px-4"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <Text className="text-accent font-subtitle text-xs">{t("common.today")}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onNext}
          className="flex-row items-center gap-1"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Text className="text-muted text-xs">{t("common.next")}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
};
