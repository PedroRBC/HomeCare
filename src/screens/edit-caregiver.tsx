import { ScreenHeading } from "@/components/ScreenHeading";
import { useAppTheme } from "@/theme";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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
import { getAdditionalPaymentError } from "@/utils/additionalPaymentErrors";
import {
  caregiverEmailError,
  normalizeEmail,
  parseOptionalMoneyInput,
} from "@/utils/caregiverShifts";

type RouteParams = { caregiverId: string };

export const EditCaregiverScreen = () => {
  const { colors } = useAppTheme();
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
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    }
  };

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("Semanal");
  const [dayAmount, setDayAmount] = useState("");
  const [nightAmount, setNightAmount] = useState("");
  const [additionalAmount, setAdditionalAmount] = useState("");
  const additionalRate = parseOptionalMoneyInput(additionalAmount);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (caregiver) {
      setName(caregiver.name);
      setFrequency(caregiver.frequency);
      setDayAmount(caregiver.locked ? "" : formatInputNumber(caregiver.dayAmount || 0));
      setNightAmount(caregiver.locked ? "" : formatInputNumber(caregiver.nightAmount || 0));
      setAdditionalAmount(
        caregiver.locked ? "" : formatInputNumber(caregiver.additionalAmount ?? 0),
      );
      setEmail(caregiver.email ?? "");
    }
  }, [caregiver]);

  // Form validation function
  const emailError = caregiverEmailError(email, caregivers, caregiverId);
  // A caregiver whose data can't be decrypted shows placeholders: saving would store them
  const isFormValid = () => {
    return (
      name.trim() &&
      dayAmount &&
      nightAmount &&
      additionalRate.valid &&
      !emailError &&
      !caregiver?.locked
    );
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
        additionalAmount: additionalRate.valid ? additionalRate.value : 0,
        // Empty string removes the link to her account
        email: normalizeEmail(email),
      };

      await updateCaregiver(updatedCaregiver);
      navigation.goBack();
    } catch (error) {
      console.error("Error updating caregiver:", error);
      const serviceError = getAdditionalPaymentError(error);
      showAlert({
        title: t("common.error"),
        message: serviceError ? t(`errors.${serviceError}`) : t("caregivers.edit.updateError"),
        icon: "alert-circle",
        iconColor: colors.danger,
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
      iconColor: colors.warning,
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
                iconColor: colors.danger,
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
        iconColor: colors.danger,
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
      <View className="bg-app flex-1 items-center justify-center">
        <Text className="text-muted">{t("caregivers.edit.notFound")}</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          className="bg-surface-raised mt-4 rounded-xl px-6 py-3">
          <Text className="text-content">{t("caregivers.edit.back")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="bg-app flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: topInset + 24,
          paddingBottom: 32,
          paddingHorizontal: 20,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}>
        <View>
          <ScreenHeading
            title={t("caregivers.edit.title")}
            subtitle={t("caregivers.edit.subtitle")}
          />
        </View>

        {caregiver.locked && (
          <View
            testID="caregiver-locked"
            className="border-warning bg-warning-soft flex-row items-start gap-2 rounded-xl border p-3">
            <Ionicons name="lock-closed" size={16} color={colors.warning} />
            <Text className="text-warning flex-1 text-sm">{t("errors.ratesUnavailable")}</Text>
          </View>
        )}

        <Card>
          <View className="gap-2">
            <Text className="font-subtitle text-content text-sm">{t("create.name")}</Text>
            <TextInput
              className="border-divider bg-surface text-content rounded-xl border px-4 py-3"
              placeholder={t("create.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={name}
              editable={!caregiver.locked}
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
                  disabled={caregiver.locked}
                  onPress={() => setFrequency(opt)}
                  className={`min-h-[48px] justify-center rounded-full border px-4 py-2 ${
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
                editable={!caregiver.locked}
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
                editable={!caregiver.locked}
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
                editable={!caregiver.locked}
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

        {!caregiver.locked && (
          <CaregiverEmailField
            value={email}
            onChange={setEmail}
            error={emailError}
            link={linksByCaregiver[caregiverId]}
            onResendInvitation={handleResendInvitation}
          />
        )}

        <View className="gap-3">
          <Pressable
            disabled={!isFormValid()}
            onPress={handleSave}
            className={`flex-row items-center justify-center gap-2 rounded-xl px-6 py-4 ${!isFormValid() ? "bg-disabled" : "bg-primary"}`}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
            })}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={!isFormValid() ? colors.textSecondary : colors.onPrimary}
            />
            <Text className={`font-subtitle ${!isFormValid() ? "text-muted" : "text-on-primary"}`}>
              {t("caregivers.edit.save")}
            </Text>
          </Pressable>

          {caregiver?.disabled ? (
            <Pressable
              onPress={handleReEnable}
              disabled={caregiver.locked}
              className="bg-primary flex-row items-center justify-center gap-2 rounded-xl px-6 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.onPrimary} />
              <Text className="font-subtitle text-on-primary">{t("caregivers.edit.reEnable")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleDelete}
              className="border-divider mt-6 flex-row items-center justify-center gap-2 border-t px-6 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text className="font-subtitle text-danger">{t("caregivers.edit.disable")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
