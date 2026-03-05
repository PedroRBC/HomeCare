import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useSchedule } from "@/context/ScheduleContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";

export const CreateScreen = () => {
  // Track screen view
  useScreenTracking("Create", "CreateScreen");

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"Semanal" | "Quinzenal" | "Mensal" | "">("");
  const [dayAmount, setDayAmount] = useState("");
  const [nightAmount, setNightAmount] = useState("");
  const { addCaregiver } = useSchedule();
  const { showAlert } = useAlert();
  const { top: topInset } = useSafeAreaInsets();

  // Form validation function
  const isFormValid = () => {
    return name.trim() && frequency && dayAmount && nightAmount;
  };

  // Clear form function
  const clearForm = () => {
    setName("");
    setFrequency("");
    setDayAmount("");
    setNightAmount("");
  };

  return (
    <View className="flex-1 bg-zinc-900 px-6">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="font-heading text-2xl text-zinc-50">Nova Cuidadora</Text>
          <Text className="text-sm text-zinc-400">Adicione uma nova cuidadora ao sistema</Text>
        </View>

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-sm text-zinc-200">Nome</Text>
            <TextInput
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
              placeholder="Ex: Maria Souza"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
          </View>
        </Card>

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-sm text-zinc-200">Frequência</Text>
            <View className="flex-row gap-2">
              {(["Semanal", "Quinzenal", "Mensal"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFrequency(opt)}
                  className={`rounded-full border px-4 py-2 ${
                    frequency === opt
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-zinc-700 bg-transparent"
                  }`}>
                  <Text className={`text-sm ${frequency === opt ? "text-white" : "text-zinc-300"}`}>
                    {opt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        {/* Amount input - always show day and night values */}
        <Card>
          <View className="gap-4">
            <View className="gap-2">
              <Text className="font-subtitle text-sm text-zinc-200">Valor Dia (R$)</Text>
              <TextInput
                keyboardType="numeric"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
                placeholder="Ex: 50,00"
                placeholderTextColor="#9CA3AF"
                value={dayAmount}
                onChangeText={setDayAmount}
              />
            </View>
            <View className="gap-2">
              <Text className="font-subtitle text-sm text-zinc-200">Valor Noite (R$)</Text>
              <TextInput
                keyboardType="numeric"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
                placeholder="Ex: 60,00"
                placeholderTextColor="#9CA3AF"
                value={nightAmount}
                onChangeText={setNightAmount}
              />
            </View>
          </View>
        </Card>

        <Pressable
          disabled={!isFormValid()}
          onPress={async () => {
            try {
              const newCaregiver = {
                name: name.trim(),
                frequency: frequency as "Semanal" | "Quinzenal" | "Mensal",
                amount:
                  (parseFloat(dayAmount.replace(",", ".")) || 0) +
                  (parseFloat(nightAmount.replace(",", ".")) || 0),
                dayAmount: parseFloat(dayAmount.replace(",", ".")) || 0,
                nightAmount: parseFloat(nightAmount.replace(",", ".")) || 0,
              };
              await addCaregiver(newCaregiver);
              clearForm();
              showAlert({
                title: "Sucesso",
                message: `Cuidadora ${newCaregiver.name} adicionada com sucesso!`,
                icon: "checkmark-circle",
                iconColor: "#059669",
                buttons: [{ text: "OK", style: "default" }],
              });
            } catch (error) {
              console.error("Error adding caregiver:", error);
              showAlert({
                title: "Erro",
                message: "Não foi possível adicionar a cuidadora. Tente novamente.",
                icon: "alert-circle",
                iconColor: "#ef4444",
                buttons: [{ text: "OK", style: "default" }],
              });
            }
          }}
          className={`flex-row items-center justify-center gap-2 rounded-xl px-6 py-4 ${!isFormValid() ? "bg-zinc-700" : "bg-emerald-600"}`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={!isFormValid() ? "#9CA3AF" : "white"}
          />
          <Text className={`font-subtitle ${!isFormValid() ? "text-zinc-300" : "text-white"}`}>
            Salvar Cuidadora
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};
