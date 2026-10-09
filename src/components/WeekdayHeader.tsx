import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const WeekdayHeader = () => {
  const { t } = useTranslation();
  return (
    <View>
      <View className="flex-row justify-between">
        {weekdayKeys.map((day, i) => (
          <View key={i} className="flex-1 items-center py-2">
            <Text className="text-muted text-sm font-medium">
              {t(`common.weekdaysShort.${day}`)}
            </Text>
          </View>
        ))}
      </View>
      {/* Subtle divider line */}
      <View className="bg-divider mt-2 h-px" />
    </View>
  );
};
