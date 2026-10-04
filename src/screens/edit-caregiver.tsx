import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSchedule, type Frequency } from "@/context/ScheduleContext";
import { useAlert } from "@/context/AlertContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatInputNumber, frequencyLabel } from "@/i18n/format";
import { CaregiverEmailField } from "@/components/CaregiverEmailField";
import { useHouseCaregiverLinks } from "@/hooks/useCaregiverLinks";
import { FirestoreService } from "@/services/firestore";
import { caregiverEmailError, normalizeEmail } from "@/utils/caregiverShifts";

type RouteParams = { caregiverId: string };

export const EditCaregiverScreen = () => {
  // Track screen view
  useScreenTracking("EditCaregiver", "EditCaregiverScreen");

  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { caregiverId } = route.params as RouteParams;
  const { caregivers, updateCaregiver, deleteCaregiver } = useSchedule();
  const { showAlert } = useAlert();
  const { top: topInset } = useSafeAreaInsets();

  const caregiver = caregivers.find((c) => c.id === caregiverId);
  const linksByCaregiver = useHouseCaregiverLinks();

  const handleResendInvitation = async () => {
    try {
      await FirestoreService.resendCaregiverInvitation(caregiverId);
    } catch (error) {
      console.error("Error resending caregiver invitation:", error);
      showAlert({
        title: t("common.error"),
        message: t("caregiverView.resendError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    }
  };

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("Semanal");
  const [dayAmount, setDayAmount] = useState("");
  const [nightAmount, setNightAmount] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (caregiver) {
      setName(caregiver.name);
      setFrequency(caregiver.frequency);
      setDayAmount(formatInputNumber(caregiver.dayAmount || 0));
      setNightAmount(formatInputNumber(caregiver.nightAmount || 0));
      setEmail(caregiver.email ?? "");
    }
  }, [caregiver]);

  // Form validation function
  const emailError = caregiverEmailError(email, caregivers, caregiverId);
  const isFormValid = () => {
    return name.trim() && dayAmount && nightAmount && !emailError;
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
        // Empty string removes the link to her account
        email: normalizeEmail(email),
      };

      await updateCaregiver(updatedCaregiver);
      navigation.goBack();
    } catch (error) {
      console.error("Error updating caregiver:", error);
      showAlert({
        title: t("common.error"),
        message: t("caregivers.edit.updateError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    }
  };

  const handleDelete = () => {
    if (!caregiver) return;

    showAlert({
      title: t("caregivers.edit.confirmDisable"),
      message: t("caregivers.edit.confirmDisableMessage", { name: caregiver.name }),
      icon: "warning",
      iconColor: "#f59e0b",
      buttons: [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("caregivers.edit.disableConfirmButton"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCaregiver(caregiverId);
              navigation.goBack();
            } catch (error) {
              console.error("Error disabling caregiver:", error);
              showAlert({
                title: t("common.error"),
                message: t("caregivers.edit.disableError"),
                icon: "alert-circle",
                iconColor: "#ef4444",
                buttons: [
                  {
                    text: t("common.ok"),
                    style: "default",
                  },
                ],
              });
            }
          },
        },
      ],
    });
  };

  const handleReEnable = async () => {
    if (!caregiver) return;

    try {
      const updatedCaregiver = { ...caregiver, disabled: false };
      await updateCaregiver(updatedCaregiver);
      navigation.goBack();
    } catch (error) {
      console.error("Error re-enabling caregiver:", error);
      showAlert({
        title: t("common.error"),
        message: t("caregivers.edit.reEnableError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    }
  };

  if (!caregiver) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <Text className="text-zinc-400">{t("caregivers.edit.notFound")}</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          className="mt-4 rounded-xl bg-zinc-700 px-6 py-3">
          <Text className="text-white">{t("caregivers.edit.back")}</Text>
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
          <Text className="font-heading text-2xl text-zinc-50">{t("caregivers.edit.title")}</Text>
          <Text className="text-sm text-zinc-400">{t("caregivers.edit.subtitle")}</Text>
        </View>

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-sm text-zinc-200">{t("create.name")}</Text>
            <TextInput
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
              placeholder={t("create.namePlaceholder")}
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
          </View>
        </Card>

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-sm text-zinc-200">{t("create.frequency")}</Text>
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
                    {frequencyLabel(opt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        <Card>
          <View className="gap-4">
            <View className="gap-2">
              <Text className="font-subtitle text-sm text-zinc-200">{t("create.dayAmount")}</Text>
              <TextInput
                keyboardType="numeric"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
                placeholder={t("create.dayPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={dayAmount}
                onChangeText={setDayAmount}
              />
            </View>
            <View className="gap-2">
              <Text className="font-subtitle text-sm text-zinc-200">{t("create.nightAmount")}</Text>
              <TextInput
                keyboardType="numeric"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
                placeholder={t("create.nightPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={nightAmount}
                onChangeText={setNightAmount}
              />
            </View>
          </View>
        </Card>

        <CaregiverEmailField
          value={email}
          onChange={setEmail}
          error={emailError}
          link={linksByCaregiver[caregiverId]}
          onResendInvitation={handleResendInvitation}
        />

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
              {t("caregivers.edit.save")}
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
              <Text className="font-subtitle text-white">{t("caregivers.edit.reEnable")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Ionicons name="trash-outline" size={20} color="white" />
              <Text className="font-subtitle text-white">{t("caregivers.edit.disable")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
