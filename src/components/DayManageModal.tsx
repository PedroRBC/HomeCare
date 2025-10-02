import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { dateKey } from "@/utils/date";

type Caregiver = { id: string; name: string; frequency: "Diário" | "Semanal" | "Mensal" };

type Props = {
  visible: boolean;
  date: Date | null;
  caregivers: Caregiver[];
  scheduleByDay: Record<string, Set<string>>;
  toggleCaregiverOnSelectedDay: (cgId: string) => void;
  onClose: () => void;
};

export const DayManageModal = ({
  visible,
  date,
  caregivers,
  scheduleByDay,
  toggleCaregiverOnSelectedDay,
  onClose,
}: Props) => {
  if (!date) return null;
  const key = dateKey(date);
  if (!scheduleByDay[key]) scheduleByDay[key] = new Set<string>();
  const set = scheduleByDay[key];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-end bg-black/40">
        <View className="w-full gap-4 rounded-t-2xl bg-zinc-900 p-6">
          <Text className="font-heading text-lg text-zinc-50">{`Quem trabalha em ${date.toLocaleDateString("pt-BR")}`}</Text>
          {caregivers.map((cg) => {
            const active = set.has(cg.id);
            return (
              <Pressable
                key={cg.id}
                onPress={() => toggleCaregiverOnSelectedDay(cg.id)}
                className={`rounded-xl border px-4 py-3 ${active ? "border-zinc-900 bg-zinc-900" : "border-zinc-700 bg-transparent"}`}>
                <View className="flex-row items-center justify-between">
                  <Text className={`text-base ${active ? "text-white" : "text-zinc-200"}`}>
                    {cg.name}
                  </Text>
                  <Text className={`text-xs ${active ? "text-white/80" : "text-zinc-400"}`}>
                    {cg.frequency}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={onClose} className="mt-2 rounded-xl bg-emerald-600 px-4 py-4">
            <Text className="font-subtitle text-center text-white">Salvar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
