import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useAppTheme } from "@/theme";

// House invitations and caregiver links are granted by email, so they only show up
// once the user proves owning it. Hidden for verified accounts.
export const EmailVerificationBanner = () => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user, sendVerificationEmail, refreshEmailVerification } = useAuth();
  const { showAlert } = useAlert();
  const [busy, setBusy] = useState<"resend" | "refresh" | null>(null);

  if (!user?.email || user.emailVerified) return null;

  const notify = (message: string, success: boolean) =>
    showAlert({
      title: success ? t("auth.verifyEmail.title") : t("common.error"),
      message,
      icon: success ? "mail" : "alert-circle",
      iconColor: success ? colors.success : colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });

  const run = async (action: "resend" | "refresh") => {
    try {
      setBusy(action);
      if (action === "resend") {
        await sendVerificationEmail();
        notify(t("auth.verifyEmail.sent", { email: user.email }), true);
      } else if (!(await refreshEmailVerification())) {
        notify(t("auth.verifyEmail.stillUnverified"), false);
      }
    } catch (error) {
      console.error("Email verification action failed:", error);
      notify(t("auth.verifyEmail.error"), false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      testID="verify-email-banner"
      className="border-warning bg-warning-soft mb-6 rounded-lg border p-4">
      <View className="flex-row items-start">
        <Ionicons name="mail-unread-outline" size={22} color={colors.warning} />
        <View className="ml-3 flex-1">
          <Text className="text-content font-semibold">{t("auth.verifyEmail.title")}</Text>
          <Text className="text-muted mt-1 text-sm">
            {t("auth.verifyEmail.message", { email: user.email })}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-3">
        <TouchableOpacity
          testID="verify-email-resend"
          onPress={() => run("resend")}
          disabled={busy !== null}
          className="bg-surface-raised flex-1 items-center rounded-lg py-2">
          {busy === "resend" ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text className="text-content text-sm font-medium">{t("auth.verifyEmail.resend")}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="verify-email-refresh"
          onPress={() => run("refresh")}
          disabled={busy !== null}
          className="flex-1 items-center rounded-lg bg-amber-600 py-2">
          {busy === "refresh" ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text className="text-sm font-medium text-white">{t("auth.verifyEmail.refresh")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
