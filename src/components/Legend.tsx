import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export const Legend = () => {
  const { t } = useTranslation();
  return (
    <View className="mt-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
      <Text className="mb-3 text-center text-sm font-medium text-zinc-300">
        {t("common.legend.title")}
      </Text>
      <View className="flex-row flex-wrap items-center justify-center gap-6">
        <View className="flex-row items-center gap-2">
          <View className="h-4 w-4 rounded-lg bg-emerald-500 shadow-sm shadow-emerald-500/30" />
          <Text className="text-sm font-medium text-zinc-300">{t("common.paid")}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="h-4 w-4 rounded-lg bg-amber-500 shadow-sm shadow-amber-500/30" />
          <Text className="text-sm font-medium text-zinc-300">{t("common.partial")}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="h-4 w-4 rounded-lg bg-rose-500 shadow-sm shadow-rose-500/30" />
          <Text className="text-sm font-medium text-zinc-300">{t("common.pending")}</Text>
        </View>
      </View>
    </View>
  );
};
