import React from "react";
import { View, Text } from "react-native";

export const Legend = () => (
  <View className="flex-row flex-wrap items-center gap-4">
    <View className="flex-row items-center gap-2">
      <View className="h-4 w-4 rounded bg-emerald-500" />
      <Text className="text-xs text-zinc-300">Pago</Text>
    </View>
    <View className="flex-row items-center gap-2">
      <View className="h-4 w-4 rounded bg-amber-500" />
      <Text className="text-xs text-zinc-300">Parcial</Text>
    </View>
    <View className="flex-row items-center gap-2">
      <View className="h-4 w-4 rounded bg-rose-500" />
      <Text className="text-xs text-zinc-300">Pendente</Text>
    </View>
  </View>
);
