import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const WeekdayHeader = () => {
  const { t } = useTranslation();
  return (
    <View className="h-6 flex-row items-center gap-1">
      {weekdayKeys.map((day) => (
        <Text key={day} className="text-muted font-subtitle flex-1 text-center text-[11px]">
          {t(`common.weekdaysShort.${day}`)}
        </Text>
      ))}
    </View>
  );
};
