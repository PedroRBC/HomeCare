import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export const Legend = () => {
  const { t } = useTranslation();
  return (
    <View>
      <View className="bg-divider mt-3.5 h-px" />
      <View className="mt-3.5 h-6 flex-row items-center justify-between">
        <View className="flex-row items-center gap-[5px]">
          <View className="bg-success h-1.5 w-1.5 rounded-full" />
          <Text className="text-muted text-[11px]">{t("common.paid")}</Text>
        </View>
        <View className="flex-row items-center gap-[5px]">
          <View className="bg-warning h-1.5 w-1.5 rounded-full" />
          <Text className="text-muted text-[11px]">{t("common.partial")}</Text>
        </View>
        <View className="flex-row items-center gap-[5px]">
          <View className="bg-danger h-1.5 w-1.5 rounded-full" />
          <Text className="text-muted text-[11px]">{t("common.pending")}</Text>
        </View>
      </View>
    </View>
  );
};
