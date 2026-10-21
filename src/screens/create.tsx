import { useAppTheme } from "@/theme";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSchedule } from "@/context/ScheduleContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { frequencyLabel } from "@/i18n/format";
import { CaregiverEmailField } from "@/components/CaregiverEmailField";
import {
  caregiverEmailError,
  normalizeEmail,
  parseOptionalMoneyInput,
} from "@/utils/caregiverShifts";

export const CreateScreen = () => {
  const { colors } = useAppTheme();
  // Track screen view
  useScreenTracking("Create", "CreateScreen");

  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"Semanal" | "Quinzenal" | "Mensal" | "">("");
  const [dayAmount, setDayAmount] = useState("");
  const [nightAmount, setNightAmount] = useState("");
  const [additionalAmount, setAdditionalAmount] = useState("");
  const additionalRate = parseOptionalMoneyInput(additionalAmount);
  const [email, setEmail] = useState("");
  const { addCaregiver, caregivers } = useSchedule();
  const { showAlert } = useAlert();
  const { top: topInset } = useSafeAreaInsets();

  // Form validation function
  const emailError = caregiverEmailError(email, caregivers);
  const isFormValid = () => {
    return (
      name.trim() && frequency && dayAmount && nightAmount && additionalRate.valid && !emailError
    );
  };

  // Clear form function
  const clearForm = () => {
    setName("");
    setFrequency("");
    setDayAmount("");
    setNightAmount("");
    setAdditionalAmount("");
    setEmail("");
  };

  return (
    <KeyboardAvoidingView
      className="bg-app flex-1 px-6"
      behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="font-heading text-content text-2xl">{t("create.title")}</Text>
          <Text className="text-muted text-sm">{t("create.subtitle")}</Text>
        </View>

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-content text-sm">{t("create.name")}</Text>
            <TextInput
              className="border-divider bg-surface text-content rounded-xl border px-4 py-3"
              placeholder={t("create.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>
        </Card>

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-content text-sm">{t("create.frequency")}</Text>
            <View className="flex-row gap-2">
              {(["Semanal", "Quinzenal", "Mensal"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFrequency(opt)}
                  className={`rounded-full border px-4 py-2 ${
                    frequency === opt
                      ? "border-primary bg-primary"
                      : "border-divider bg-transparent"
                  }`}>
                  <Text
                    className={`text-sm ${frequency === opt ? "text-on-primary" : "text-muted"}`}>
                    {frequencyLabel(opt)}
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
              <Text className="font-subtitle text-content text-sm">{t("create.dayAmount")}</Text>
              <TextInput
                keyboardType="numeric"
                className="border-divider bg-surface text-content rounded-xl border px-4 py-3"
                placeholder={t("create.dayPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={dayAmount}
                onChangeText={setDayAmount}
              />
            </View>
            <View className="gap-2">
              <Text className="font-subtitle text-content text-sm">{t("create.nightAmount")}</Text>
              <TextInput
                keyboardType="numeric"
                className="border-divider bg-surface text-content rounded-xl border px-4 py-3"
                placeholder={t("create.nightPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={nightAmount}
                onChangeText={setNightAmount}
              />
            </View>
            <View className="gap-2">
              <Text className="font-subtitle text-content text-sm">
                {t("create.additionalAmount")}
              </Text>
              <Text className="text-muted text-xs">{t("create.additionalHint")}</Text>
              <TextInput
                keyboardType="numeric"
                className="border-divider bg-surface text-content rounded-xl border px-4 py-3"
                placeholder={t("create.additionalPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={additionalAmount}
                onChangeText={setAdditionalAmount}
                accessibilityLabel={t("create.additionalAmount")}
                accessibilityHint={t("create.additionalHint")}
              />
              {!additionalRate.valid && (
                <Text accessibilityRole="alert" className="text-danger text-xs">
                  {t("create.additionalInvalid")}
                </Text>
              )}
            </View>
          </View>
        </Card>

        <CaregiverEmailField value={email} onChange={setEmail} error={emailError} />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || !isFormValid(), busy: isSubmitting }}
          disabled={isSubmitting || !isFormValid()}
          onPress={async () => {
            if (submitting.current || !isFormValid()) return;
            submitting.current = true;
            setIsSubmitting(true);
            try {
              const newCaregiver = {
                name: name.trim(),
                frequency: frequency as "Semanal" | "Quinzenal" | "Mensal",
                amount:
                  (parseFloat(dayAmount.replace(",", ".")) || 0) +
                  (parseFloat(nightAmount.replace(",", ".")) || 0),
                dayAmount: parseFloat(dayAmount.replace(",", ".")) || 0,
                nightAmount: parseFloat(nightAmount.replace(",", ".")) || 0,
                additionalAmount: additionalRate.valid ? additionalRate.value : 0,
                ...(normalizeEmail(email) && { email: normalizeEmail(email) }),
              };
              await addCaregiver(newCaregiver);
              clearForm();
              showAlert({
                title: t("create.success"),
                message: t("create.added", { name: newCaregiver.name }),
                icon: "checkmark-circle",
                iconColor: colors.success,
                buttons: [{ text: t("common.ok"), style: "default" }],
              });
            } catch (error) {
              console.error("Error adding caregiver:", error);
              showAlert({
                title: t("common.error"),
                message: t("create.addError"),
                icon: "alert-circle",
                iconColor: colors.danger,
                buttons: [{ text: t("common.ok"), style: "default" }],
              });
            } finally {
              submitting.current = false;
              setIsSubmitting(false);
            }
          }}
          className={`flex-row items-center justify-center gap-2 rounded-xl px-6 py-4 ${isSubmitting || !isFormValid() ? "bg-disabled" : "bg-primary"}`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={!isFormValid() ? colors.textSecondary : colors.onPrimary}
          />
          <Text className={`font-subtitle ${!isFormValid() ? "text-muted" : "text-on-primary"}`}>
            {t(isSubmitting ? "common.processing" : "create.save")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
