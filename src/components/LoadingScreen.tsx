import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const LoadingScreen = () => {
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <View className="items-center">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="font-heading mt-4 text-lg text-white">Carregando...</Text>
        <Text className="mt-2 px-8 text-center text-sm text-zinc-400">
          Conectando com o banco de dados
        </Text>
      </View>
    </View>
  );
};
