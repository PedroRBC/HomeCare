import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";

type RouteParams = { caregiverId: string };

export const EditCaregiverScreen = () => {
  // Track screen view
  useScreenTracking("EditCaregiver", "EditCaregiverScreen");

  const route = useRoute();
  const navigation = useNavigation();
  const { caregiverId } = route.params as RouteParams;
  const { caregivers, updateCaregiver, deleteCaregiver } = useSchedule();
  const { top: topInset } = useSafeAreaInsets();

  const caregiver = caregivers.find((c) => c.id === caregiverId);

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"Semanal" | "Quinzenal" | "Mensal">("Semanal");
  const [dayAmount, setDayAmount] = useState("");
  const [nightAmount, setNightAmount] = useState("");

  useEffect(() => {
    if (caregiver) {
      setName(caregiver.name);
      setFrequency(caregiver.frequency);
      setDayAmount((caregiver.dayAmount || 0).toString().replace(".", ","));
      setNightAmount((caregiver.nightAmount || 0).toString().replace(".", ","));
    }
  }, [caregiver]);

  // Form validation function
  const isFormValid = () => {
    return name.trim() && dayAmount && nightAmount;
  };

  const handleSave = async () => {
    if (!isFormValid() || !caregiver) return;

    try {
      const updatedCaregiver = {
        ...caregiver,
        name: name.trim(),
        frequency,
        amount:
          (parseFloat(dayAmount.replace(",", ".")) || 0) +
          (parseFloat(nightAmount.replace(",", ".")) || 0),
        dayAmount: parseFloat(dayAmount.replace(",", ".")) || 0,
        nightAmount: parseFloat(nightAmount.replace(",", ".")) || 0,
      };

      await updateCaregiver(updatedCaregiver);
      navigation.goBack();
    } catch (error) {
      console.error("Error updating caregiver:", error);
      Alert.alert("Erro", "Não foi possível atualizar a cuidadora. Tente novamente.");
    }
  };

  const handleDelete = () => {
    if (!caregiver) return;

    Alert.alert(
      "Confirmar Desabilitação",
      `Tem certeza que deseja desabilitar ${caregiver.name}?\n\nA cuidadora não poderá ser atribuída a novos dias, mas o histórico de pagamentos e dias trabalhados será preservado.`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Desabilitar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCaregiver(caregiverId);
              navigation.goBack();
            } catch (error) {
              console.error("Error disabling caregiver:", error);
              Alert.alert("Erro", "Não foi possível desabilitar a cuidadora. Tente novamente.");
            }
          },
        },
      ],
    );
  };

  const handleReEnable = async () => {
    if (!caregiver) return;

    try {
      console.log("Re-enabling caregiver:", caregiver.id, "from disabled:", caregiver.disabled);
      const updatedCaregiver = { ...caregiver, disabled: false };
      console.log("Updated caregiver object:", updatedCaregiver);
      await updateCaregiver(updatedCaregiver);
      console.log("Caregiver re-enabled successfully");
      navigation.goBack();
    } catch (error) {
      console.error("Error re-enabling caregiver:", error);
      Alert.alert("Erro", "Não foi possível reabilitar a cuidadora. Tente novamente.");
    }
  };

  if (!caregiver) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <Text className="text-zinc-400">Cuidadora não encontrada</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          className="mt-4 rounded-xl bg-zinc-700 px-6 py-3">
          <Text className="text-white">Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          paddingHorizontal: 16,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="font-heading text-2xl text-zinc-50">Editar Cuidadora</Text>
          <Text className="text-sm text-zinc-400">Modifique as informações da cuidadora</Text>
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

        <View className="gap-3">
          <Pressable
            disabled={!isFormValid()}
            onPress={handleSave}
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
              Salvar Alterações
            </Text>
          </Pressable>

          {caregiver?.disabled ? (
            <Pressable
              onPress={handleReEnable}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Ionicons name="checkmark-circle-outline" size={20} color="white" />
              <Text className="font-subtitle text-white">Reabilitar Cuidadora</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Ionicons name="trash-outline" size={20} color="white" />
              <Text className="font-subtitle text-white">Desabilitar Cuidadora</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
