import React from "react";
import { View, Text, Pressable } from "react-native";

type Props = {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
};

export const CalendarHeader = ({ monthLabel, onPrev, onNext }: Props) => {
  return (
    <View className="mt-2 flex-row items-center justify-between">
      <Pressable onPress={onPrev} className="rounded-lg border border-zinc-700 px-3 py-2">
        <Text className="text-sm text-zinc-200">Anterior</Text>
      </Pressable>
      <View>
        <Text className="font-heading text-center text-2xl text-zinc-50">{monthLabel}</Text>
      </View>
      <Pressable onPress={onNext} className="rounded-lg border border-zinc-700 px-3 py-2">
        <Text className="text-sm text-zinc-200">Próximo</Text>
      </Pressable>
    </View>
  );
};
