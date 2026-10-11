import React from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AppLogo } from "./AppLogo";
import { useAppTheme } from "@/theme";

export const LoadingScreen = () => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  return (
    <View
      className="bg-app flex-1 items-center justify-center"
      style={{ paddingTop: topInset, paddingBottom: bottomInset }}>
      <View className="items-center">
        <AppLogo size={88} showWordmark={false} />
        <ActivityIndicator className="mt-6" color={colors.accent} />
        <Text className="font-heading text-content mt-4 text-lg">{t("common.loading")}</Text>
        <Text className="text-muted mt-2 px-8 text-center text-sm">
          {t("common.loadingDatabase")}
        </Text>
      </View>
    </View>
  );
};
