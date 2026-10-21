import { PasswordToggle } from "@/components/PasswordToggle";
import { useAppTheme } from "@/theme";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { UserFacingAuthError, useAuth, type DeleteAccountCredentials } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { HouseAccessRepairError } from "@/services/firestore";
import { FacebookSignInButton } from "@/components/FacebookSignInButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import type { FacebookSignInToken } from "@/utils/facebookSignIn";
import { isFacebookSignInAvailable } from "@/utils/facebookSignInNative";
import { useTranslation } from "react-i18next";

interface DeleteAccountScreenProps {
  navigation: any;
}

export const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProviderBusy, setIsProviderBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { user, deleteAccount } = useAuth();
  const { showAlert } = useAlert();

  useScreenTracking("DeleteAccount", "DeleteAccountScreen");

  const facebookAvailable = isFacebookSignInAvailable();
  const linkedMethods = [
    ...(user?.hasPassword ? (["password"] as const) : []),
    ...(user?.providers.includes("google.com") ? (["google"] as const) : []),
    ...(user?.providers.includes("facebook.com") ? (["facebook"] as const) : []),
  ];
  const preferredMethod =
    linkedMethods.find((method) => method !== "facebook" || facebookAvailable) ??
    linkedMethods[0] ??
    "password";
  const [selectedMethod, setSelectedMethod] = useState<"password" | "google" | "facebook">(
    preferredMethod,
  );
  const actionsDisabled = isLoading || isProviderBusy;

  const handleDeleteWithPassword = () => {
    if (!password || password.trim() === "") {
      showAlert({
        title: t("common.error"),
        message: t("account.delete.passwordRequired"),
        icon: "warning",
        iconColor: colors.warning,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
      return;
    }

    // Only the emptiness check trims: spaces can be part of a valid password
    confirmDeletion({ password });
  };

  const handleGoogleError = (error: Error) => {
    showAlert({
      title: t("common.error"),
      message: t("account.delete.googleError"),
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };

  const handleFacebookError = (error: Error) => {
    showAlert({
      title: t("common.error"),
      message: t("account.delete.facebookError"),
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };

  const confirmDeletion = (credentials: DeleteAccountCredentials) => {
    // Final confirmation
    showAlert({
      title: t("account.delete.finalTitle"),
      message: t("account.delete.finalMessage"),
      icon: "warning",
      iconColor: colors.warning,
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.delete.finalConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);

              await deleteAccount(credentials);

              showAlert({
                title: t("account.delete.deletedTitle"),
                message: t("account.delete.deletedMessage"),
                icon: "checkmark-circle",
                iconColor: colors.success,
                buttons: [
                  {
                    text: t("common.ok"),
                    style: "default",
                  },
                ],
              });
            } catch (error: any) {
              console.error("Account deletion failed", {
                code: typeof error?.code === "string" ? error.code : "unknown",
              });
              showAlert({
                title: t("common.error"),
                // Only translated failures are shown; raw SDK messages stay in the logs
                message:
                  error instanceof UserFacingAuthError || error instanceof HouseAccessRepairError
                    ? error.message
                    : t("account.delete.deleteError"),
                icon: "alert-circle",
                iconColor: colors.danger,
                buttons: [
                  {
                    text: t("common.ok"),
                    style: "default",
                  },
                ],
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    });
  };

  return (
    <View
      className="bg-app flex-1"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
        {/* Header */}
        <View className="mb-8 items-center">
          <Ionicons name="person-remove-outline" size={60} color={colors.danger} className="mb-4" />
          <Text className="text-content mb-2 text-3xl font-bold">{t("account.delete.title")}</Text>
          <Text className="text-muted text-center">
            {selectedMethod === "password"
              ? t("account.delete.subtitle")
              : selectedMethod === "facebook"
                ? t("account.delete.subtitleFacebook")
                : t("account.delete.subtitleGoogle")}
          </Text>
        </View>

        {/* Warning Card */}
        <View className="border-danger bg-danger-soft mb-6 rounded-lg border p-4">
          <View className="flex-row items-start">
            <Ionicons
              name="warning-outline"
              size={24}
              color={colors.danger}
              className="mt-1 mr-3"
            />
            <View className="flex-1">
              <Text className="text-danger mb-2 text-lg font-semibold">
                {t("account.delete.warningTitle")}
              </Text>
              <Text className="text-danger text-sm leading-5">
                {t("account.delete.warningLead")}
              </Text>
              <Text className="text-danger mt-2 text-sm leading-5">
                {t("account.delete.warningList")}
              </Text>
            </View>
          </View>
        </View>

        {/* User Info */}
        <View className="bg-surface mb-6 rounded-lg p-4">
          <Text className="text-content mb-3 text-lg font-semibold">
            {t("account.delete.accountInfo")}
          </Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.textSecondary}
                className="mr-3"
              />
              <Text className="text-muted">
                {t("account.delete.name", { value: user?.displayName || t("common.notDefined") })}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.textSecondary}
                className="mr-3"
              />
              <Text className="text-muted">
                {t("account.delete.email", { value: user?.email || t("common.notDefined") })}
              </Text>
            </View>
          </View>
        </View>

        {linkedMethods.length > 1 && (
          <View className="mb-6">
            <Text className="text-content mb-3 text-sm font-medium">
              {t("account.delete.chooseMethod")}
            </Text>
            <View className="gap-2">
              {linkedMethods.map((method) => {
                const unavailable = method === "facebook" && !facebookAvailable;
                const label =
                  method === "password"
                    ? t("account.manage.emailPassword")
                    : method === "facebook"
                      ? t("account.manage.facebook")
                      : t("account.manage.google");
                return (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setSelectedMethod(method)}
                    disabled={actionsDisabled || unavailable}
                    className={`rounded-lg border px-4 py-3 ${
                      selectedMethod === method
                        ? "border-primary bg-primary-soft"
                        : "border-divider bg-surface"
                    }`}
                    style={{ opacity: unavailable ? 0.55 : 1 }}>
                    <Text className="text-content font-medium">{label}</Text>
                    {unavailable && (
                      <Text className="text-warning mt-1 text-xs leading-4">
                        {t("account.delete.methodUnavailable")}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {linkedMethods.length === 0 ? (
          <Text className="text-warning mb-6 text-center text-sm leading-5">
            {t("account.delete.noLinkedMethod")}
          </Text>
        ) : selectedMethod === "password" ? (
          <>
            {/* Password Input */}
            <View className="mb-6">
              <Text className="text-content mb-2 text-sm font-medium">
                {t("account.delete.confirmPassword")}
              </Text>
              <View className="relative">
                <TextInput
                  className="border-divider bg-surface text-content rounded-lg border px-4 py-4 pr-12"
                  placeholder={t("account.delete.passwordPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!actionsDisabled}
                />
                <View className="absolute top-1/2 right-1 -translate-y-1/2">
                  <PasswordToggle
                    visible={showPassword}
                    disabled={actionsDisabled}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                </View>
              </View>
              <Text className="text-subtle mt-1 text-xs">{t("account.delete.passwordHint")}</Text>
            </View>

            {/* Action Buttons */}
            <View className="space-y-3">
              <TouchableOpacity
                onPress={handleDeleteWithPassword}
                disabled={actionsDisabled || !password.trim()}
                className={`items-center rounded-lg py-4 ${
                  actionsDisabled || !password.trim() ? "bg-disabled" : "bg-red-600"
                }`}
                style={{ opacity: actionsDisabled || !password.trim() ? 0.7 : 1 }}>
                {isLoading ? (
                  <ActivityIndicator color={colors.textSecondary} />
                ) : (
                  <Text
                    className={`text-lg font-semibold ${!password.trim() ? "text-muted" : "text-on-primary"}`}>
                    {t("account.delete.submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : selectedMethod === "google" ? (
          <View className="mb-6">
            <GoogleSignInButton
              mode="reauth"
              onSuccess={async (googleIdToken) => confirmDeletion({ googleIdToken })}
              onError={handleGoogleError}
              disabled={actionsDisabled}
              onBusyChange={setIsProviderBusy}
            />
            <Text className="text-subtle mt-2 text-center text-xs">
              {t("account.delete.googleHint")}
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            {facebookAvailable ? (
              <FacebookSignInButton
                mode="reauth"
                onSuccess={async (facebookToken: FacebookSignInToken) =>
                  confirmDeletion({ facebookToken })
                }
                onError={handleFacebookError}
                disabled={actionsDisabled}
                onBusyChange={setIsProviderBusy}
              />
            ) : (
              <Text className="text-warning text-center text-sm leading-5">
                {t("account.delete.methodUnavailable")}
              </Text>
            )}
            <Text className="text-subtle mt-2 text-center text-xs">
              {t("account.delete.facebookHint")}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isLoading}
          className="items-center py-3">
          <Text className="text-muted text-base">{t("account.delete.cancel")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
