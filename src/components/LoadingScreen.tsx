import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { useTranslation } from "react-i18next";

export const LoadingScreen = () => {
  const { t } = useTranslation();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <View className="items-center">
        <LottieView
          source={require("../../assets/animations/home-shaking.json")}
          autoPlay
          loop
          style={{ width: 120, height: 120 }}
        />
        <Text className="font-heading mt-4 text-lg text-white">Carregando...</Text>
        <Text className="mt-2 px-8 text-center text-sm text-zinc-400">
          {t("common.loadingDatabase")}
        </Text>
      </View>
    </View>
  );
};
