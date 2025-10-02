import React from "react";
import { View, Text } from "react-native";

export const WeekdayHeader = () => (
  <View className="flex-row justify-between">
    {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => (
      <Text key={i} className="flex-1 text-center text-xs text-zinc-400">
        {w}
      </Text>
    ))}
  </View>
);
