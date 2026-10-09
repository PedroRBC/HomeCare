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
import { useAuth, type DeleteAccountCredentials } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { FacebookSignInButton } from "@/components/FacebookSignInButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import type { FacebookSignInToken } from "@/utils/facebookSignIn";
import { isFacebookSignInAvailable } from "@/utils/facebookSignInNative";
import { useTranslation } from "react-i18next";

interface DeleteAccountScreenProps {
  navigation: any;
}

export const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({ navigation }) => {
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
        iconColor: "#f59e0b",
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
      iconColor: "#ef4444",
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };

  const handleFacebookError = (error: Error) => {
    showAlert({
      title: t("common.error"),
      message: t("account.delete.facebookError"),
      icon: "alert-circle",
      iconColor: "#ef4444",
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };

  const confirmDeletion = (credentials: DeleteAccountCredentials) => {
    // Final confirmation
    showAlert({
      title: t("account.delete.finalTitle"),
      message: t("account.delete.finalMessage"),
      icon: "warning",
      iconColor: "#f59e0b",
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
                iconColor: "#10b981",
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
                message: t("account.delete.deleteError"),
                icon: "alert-circle",
                iconColor: "#ef4444",
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
      className="flex-1 bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
        {/* Header */}
        <View className="mb-8 items-center">
          <Ionicons name="person-remove-outline" size={60} color="#EF4444" className="mb-4" />
          <Text className="mb-2 text-3xl font-bold text-white">{t("account.delete.title")}</Text>
          <Text className="text-center text-zinc-400">
            {selectedMethod === "password"
              ? t("account.delete.subtitle")
              : selectedMethod === "facebook"
                ? t("account.delete.subtitleFacebook")
                : t("account.delete.subtitleGoogle")}
          </Text>
        </View>

        {/* Warning Card */}
        <View className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <View className="flex-row items-start">
            <Ionicons name="warning-outline" size={24} color="#EF4444" className="mt-1 mr-3" />
            <View className="flex-1">
              <Text className="mb-2 text-lg font-semibold text-red-400">
                {t("account.delete.warningTitle")}
              </Text>
              <Text className="text-sm leading-5 text-red-300">
                {t("account.delete.warningLead")}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-red-300">
                {t("account.delete.warningList")}
              </Text>
            </View>
          </View>
        </View>

        {/* User Info */}
        <View className="mb-6 rounded-lg bg-zinc-800 p-4">
          <Text className="mb-3 text-lg font-semibold text-white">
            {t("account.delete.accountInfo")}
          </Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={20} color="#9CA3AF" className="mr-3" />
              <Text className="text-zinc-300">
                {t("account.delete.name", { value: user?.displayName || t("common.notDefined") })}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" className="mr-3" />
              <Text className="text-zinc-300">
                {t("account.delete.email", { value: user?.email || t("common.notDefined") })}
              </Text>
            </View>
          </View>
        </View>

        {linkedMethods.length > 1 && (
          <View className="mb-6">
            <Text className="mb-3 text-sm font-medium text-white">
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
                        ? "border-emerald-500 bg-emerald-900/30"
                        : "border-zinc-700 bg-zinc-800"
                    }`}
                    style={{ opacity: unavailable ? 0.55 : 1 }}>
                    <Text className="font-medium text-white">{label}</Text>
                    {unavailable && (
                      <Text className="mt-1 text-xs leading-4 text-amber-300">
                        {t("account.delete.methodUnavailable")}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {selectedMethod === "password" ? (
          <>
            {/* Password Input */}
            <View className="mb-6">
              <Text className="mb-2 text-sm font-medium text-white">
                {t("account.delete.confirmPassword")}
              </Text>
              <View className="relative">
                <TextInput
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4 pr-12 text-white"
                  placeholder={t("account.delete.passwordPlaceholder")}
                  placeholderTextColor="#71717a"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!actionsDisabled}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2"
                  disabled={actionsDisabled}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              <Text className="mt-1 text-xs text-zinc-500">{t("account.delete.passwordHint")}</Text>
            </View>

            {/* Action Buttons */}
            <View className="space-y-3">
              <TouchableOpacity
                onPress={handleDeleteWithPassword}
                disabled={actionsDisabled || !password.trim()}
                className={`items-center rounded-lg py-4 ${
                  actionsDisabled || !password.trim() ? "bg-zinc-700" : "bg-red-600"
                }`}
                style={{ opacity: actionsDisabled || !password.trim() ? 0.7 : 1 }}>
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-lg font-semibold text-white">
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
            <Text className="mt-2 text-center text-xs text-zinc-500">
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
              <Text className="text-center text-sm leading-5 text-amber-300">
                {t("account.delete.methodUnavailable")}
              </Text>
            )}
            <Text className="mt-2 text-center text-xs text-zinc-500">
              {t("account.delete.facebookHint")}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isLoading}
          className="items-center py-3">
          <Text className="text-base text-zinc-400">{t("account.delete.cancel")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
