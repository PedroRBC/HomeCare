import React from "react";
import { View, Text } from "react-native";
import { useSchedule } from "@/context/ScheduleContext";
import { useTranslation } from "react-i18next";

export const ConnectionStatus = () => {
  const { isFirestoreConnected } = useSchedule();
  const { t } = useTranslation();

  if (isFirestoreConnected) {
    return null; // Don't show anything when connected
  }

  return (
    <View className="bg-amber-600 px-4 py-2">
      <Text className="font-subtitle text-center text-sm text-white">{t("common.offline")}</Text>
    </View>
  );
};
