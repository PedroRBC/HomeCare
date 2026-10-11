import { useAppTheme } from "@/theme";
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { UserFacingAuthError, useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { FacebookSignInButton } from "@/components/FacebookSignInButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Card } from "@/components/Card";
import type { FacebookSignInToken } from "@/utils/facebookSignIn";
import { isFacebookSignInAvailable } from "@/utils/facebookSignInNative";
import { useTranslation } from "react-i18next";

export const AccountManagementScreen = () => {
  const { colors } = useAppTheme();
  const {
    user,
    linkWithGoogle,
    linkWithFacebook,
    unlinkProvider,
    setPasswordForSocialAccount,
    updatePassword,
    providerSyncError,
  } = useAuth();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProviderBusy, setIsProviderBusy] = useState(false);

  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPasswordUpdate, setNewPasswordUpdate] = useState("");
  const [confirmPasswordUpdate, setConfirmPasswordUpdate] = useState("");

  if (!user) {
    return (
      <View className="bg-app flex-1 items-center justify-center">
        <Text className="text-muted">{t("account.manage.noUser")}</Text>
      </View>
    );
  }

  const hasGoogle = user.providers.includes("google.com");
  const hasFacebook = user.providers.includes("facebook.com");
  const facebookAvailable = isFacebookSignInAvailable();
  const hasPassword = user.hasPassword;
  const actionsDisabled = isLoading || isProviderBusy;

  // ✅ Vincular Google
  const handleLinkGoogle = async (idToken: string) => {
    try {
      setIsLoading(true);
      await linkWithGoogle(idToken);
      showAlert({
        title: t("account.manage.success"),
        message: t("account.manage.googleLinked"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message:
          error instanceof UserFacingAuthError
            ? error.message
            : t("account.manage.googleLinkError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkFacebook = async (token: FacebookSignInToken) => {
    try {
      setIsLoading(true);
      await linkWithFacebook(token);
      showAlert({
        title: t("account.manage.success"),
        message: t("account.manage.facebookLinked"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } catch (error) {
      showAlert({
        title: t("common.error"),
        message:
          error instanceof UserFacingAuthError
            ? error.message
            : t("account.manage.facebookLinkError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Unlinking is guarded both by the button and by this final provider count check.
  const handleUnlinkGoogle = () => {
    if (user.providers.length <= 1) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.needOneMethod"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    showAlert({
      title: t("account.manage.unlinkTitle"),
      message: t("account.manage.unlinkMessage"),
      icon: "unlink",
      iconColor: colors.warning,
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.manage.unlinkConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await unlinkProvider("google.com");
              showAlert({
                title: t("account.manage.success"),
                message: t("account.manage.unlinked"),
                icon: "checkmark-circle",
                iconColor: colors.success,
                buttons: [{ text: t("common.ok"), style: "default" }],
              });
            } catch (error) {
              showAlert({
                title: t("common.error"),
                message:
                  error instanceof UserFacingAuthError
                    ? error.message
                    : t("account.manage.unlinkError"),
                icon: "alert-circle",
                iconColor: colors.danger,
                buttons: [{ text: t("common.ok"), style: "default" }],
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    });
  };

  const handleUnlinkFacebook = () => {
    if (user.providers.length <= 1) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.needOneMethod"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    showAlert({
      title: t("account.manage.unlinkFacebookTitle"),
      message: t("account.manage.unlinkFacebookMessage"),
      icon: "unlink",
      iconColor: colors.warning,
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("account.manage.unlinkConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await unlinkProvider("facebook.com");
              showAlert({
                title: t("account.manage.success"),
                message: t("account.manage.facebookUnlinked"),
                icon: "checkmark-circle",
                iconColor: colors.success,
                buttons: [{ text: t("common.ok"), style: "default" }],
              });
            } catch (error) {
              showAlert({
                title: t("common.error"),
                message:
                  error instanceof UserFacingAuthError
                    ? error.message
                    : t("account.manage.unlinkError"),
                icon: "alert-circle",
                iconColor: colors.danger,
                buttons: [{ text: t("common.ok"), style: "default" }],
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    });
  };

  // Configure a neutral email/password fallback for any social account.
  const handleSetPassword = async () => {
    if (!user.email) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.setPasswordNoEmail"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }
    if (newPassword.length < 6) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.passwordMin"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.passwordsMismatch"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    try {
      setIsLoading(true);
      await setPasswordForSocialAccount(newPassword);
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
      showAlert({
        title: t("account.manage.success"),
        message: t("account.manage.passwordSet"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } catch (error: any) {
      showAlert({
        title: t("common.error"),
        message: error.message || t("account.manage.passwordSetError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Atualizar Senha (para quem já tem senha)
  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.enterCurrent"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    if (newPasswordUpdate.length < 6) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.newPasswordMin"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    if (newPasswordUpdate !== confirmPasswordUpdate) {
      showAlert({
        title: t("common.error"),
        message: t("account.manage.newPasswordsMismatch"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
      return;
    }

    try {
      setIsLoading(true);
      await updatePassword(currentPassword, newPasswordUpdate);
      setShowChangePasswordForm(false);
      setCurrentPassword("");
      setNewPasswordUpdate("");
      setConfirmPasswordUpdate("");
      showAlert({
        title: t("account.manage.success"),
        message: t("account.manage.passwordChanged"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } catch (error: any) {
      showAlert({
        title: t("common.error"),
        message: error.message || t("account.manage.passwordChangeError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    showAlert({
      title: t("common.error"),
      message: t("account.manage.googleLinkFailed"),
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };

  const handleFacebookError = () => {
    showAlert({
      title: t("common.error"),
      message: t("account.manage.facebookLinkFailed"),
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
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
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-8">
          <Text className="text-content mb-2 text-2xl font-bold">{t("account.manage.title")}</Text>
          <Text className="text-muted">{t("account.manage.subtitle")}</Text>
        </View>

        {providerSyncError && (
          <Card variant="outlined" className="border-warning bg-warning-soft mb-6">
            <View className="flex-row gap-3">
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text className="text-warning flex-1 text-sm leading-5">
                {t("errors.providerSyncFailed")}
              </Text>
            </View>
          </Card>
        )}

        {/* Sign-in methods */}
        <Card variant="elevated" className="mb-6">
          <Text className="text-content mb-6 font-semibold">{t("account.manage.methods")}</Text>

          {/* Email/Senha */}
          <View className="border-divider mb-6 border-b pb-6">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <View className="bg-primary-soft mr-4 h-12 w-12 items-center justify-center rounded-full">
                  <Ionicons name="mail" size={24} color={colors.accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-content font-medium">
                    {t("account.manage.emailPassword")}
                  </Text>
                  <Text className="text-muted mt-1 text-xs">
                    {user.email || t("account.manage.emailUnavailable")}
                  </Text>
                  <Text className="text-subtle mt-2 text-xs leading-4">
                    {t("account.manage.emailVerificationHint")}
                  </Text>
                </View>
              </View>
              <View className="items-center">
                {hasPassword ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                ) : (
                  <Text className="text-muted text-xs">{t("account.manage.notConfigured")}</Text>
                )}
              </View>
            </View>

            {/* Botões para Senha */}
            <View className="mt-4 flex-row gap-2">
              {hasPassword ? (
                <TouchableOpacity
                  onPress={() => setShowChangePasswordForm(true)}
                  disabled={actionsDisabled}
                  className="border-divider bg-surface flex-1 items-center rounded-lg border py-3">
                  <Text className="text-content text-sm font-medium">
                    {t("account.manage.changePassword")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowPasswordForm(true)}
                  disabled={actionsDisabled || !user.email}
                  className="bg-primary flex-1 items-center rounded-lg py-3"
                  style={{ opacity: actionsDisabled || !user.email ? 0.5 : 1 }}>
                  <Text className="text-on-primary text-sm font-medium">
                    {t("account.manage.setPassword")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {!hasPassword && !user.email && (
              <Text className="text-warning mt-2 text-xs leading-4">
                {t("account.manage.setPasswordNoEmail")}
              </Text>
            )}
          </View>

          {/* Google */}
          <View>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <View className="bg-info-soft mr-4 h-12 w-12 items-center justify-center rounded-full">
                  <Ionicons name="logo-google" size={24} color={colors.info} />
                </View>
                <View className="flex-1">
                  <Text className="text-content font-medium">Google</Text>
                  <Text className="text-muted mt-1 text-xs">
                    {hasGoogle ? t("account.manage.linked") : t("account.manage.notLinked")}
                  </Text>
                </View>
              </View>
              <View className="items-center">
                {hasGoogle ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                ) : (
                  <Text className="text-muted text-xs">{t("account.manage.notLinked")}</Text>
                )}
              </View>
            </View>

            {!hasGoogle && !user.email && (
              <Text className="text-subtle mt-2 text-xs leading-4">
                {t("account.manage.googleLinkMayHelp")}
              </Text>
            )}

            {/* Botões Google */}
            <View className="mt-4">
              {hasGoogle ? (
                <TouchableOpacity
                  onPress={handleUnlinkGoogle}
                  disabled={actionsDisabled || user.providers.length <= 1}
                  className={`items-center rounded-lg py-3 ${user.providers.length <= 1 ? "bg-danger-soft" : "bg-red-600"}`}>
                  {isLoading ? (
                    <ActivityIndicator
                      color={user.providers.length <= 1 ? colors.danger : colors.onPrimary}
                    />
                  ) : (
                    <Text
                      className={`text-sm font-medium ${user.providers.length <= 1 ? "text-danger" : "text-on-primary"}`}>
                      {t("account.manage.unlink")}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <GoogleSignInButton
                  mode="link"
                  onSuccess={handleLinkGoogle}
                  onError={handleGoogleError}
                  disabled={actionsDisabled}
                  onBusyChange={setIsProviderBusy}
                />
              )}
            </View>
          </View>

          {/* Facebook */}
          {(hasFacebook || facebookAvailable) && (
            <View className="border-divider mt-6 border-t pt-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center">
                  <View className="bg-info-soft mr-4 h-12 w-12 items-center justify-center rounded-full">
                    <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-content font-medium">{t("account.manage.facebook")}</Text>
                    <Text className="text-muted mt-1 text-xs">
                      {hasFacebook ? t("account.manage.linked") : t("account.manage.notLinked")}
                    </Text>
                  </View>
                </View>
                <View className="items-center">
                  {hasFacebook ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  ) : (
                    <Text className="text-muted text-xs">{t("account.manage.notLinked")}</Text>
                  )}
                </View>
              </View>
              <View className="mt-4">
                {hasFacebook ? (
                  <TouchableOpacity
                    onPress={handleUnlinkFacebook}
                    disabled={actionsDisabled || user.providers.length <= 1}
                    className={`items-center rounded-lg py-3 ${user.providers.length <= 1 ? "bg-danger-soft" : "bg-red-600"}`}>
                    <Text
                      className={`text-sm font-medium ${user.providers.length <= 1 ? "text-danger" : "text-on-primary"}`}>
                      {t("account.manage.unlink")}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <FacebookSignInButton
                    mode="link"
                    onSuccess={handleLinkFacebook}
                    onError={handleFacebookError}
                    disabled={actionsDisabled}
                    onBusyChange={setIsProviderBusy}
                  />
                )}
              </View>
            </View>
          )}
        </Card>

        {/* Social account → password fallback */}
        {showPasswordForm && !hasPassword && (
          <Card variant="elevated" className="mb-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-content flex-1 font-semibold">
                {t("account.manage.setPassword")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordForm(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={actionsDisabled}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text className="text-muted mb-6 text-sm">{t("account.manage.setPasswordHint")}</Text>

            <View className="mb-6 gap-4">
              <View>
                <Text className="text-muted mb-2 text-sm font-medium">
                  {t("account.manage.newPassword")}
                </Text>
                <TextInput
                  className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
                  placeholder={t("account.manage.minPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!isLoading}
                />
              </View>

              <View>
                <Text className="text-muted mb-2 text-sm font-medium">
                  {t("account.manage.confirmPassword")}
                </Text>
                <TextInput
                  className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
                  placeholder={t("account.manage.repeatPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isLoading}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordForm(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={actionsDisabled}
                className="border-divider bg-surface flex-1 items-center rounded-lg border py-3">
                <Text className="text-content font-medium">{t("account.manage.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSetPassword}
                disabled={actionsDisabled}
                className="bg-primary flex-1 items-center rounded-lg py-3">
                {isLoading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text className="text-on-primary font-semibold">
                    {t("account.manage.confirm")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Form Alterar Senha (existente) */}
        {showChangePasswordForm && hasPassword && (
          <Card variant="elevated" className="mb-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-content flex-1 font-semibold">
                {t("account.manage.changePassword")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowChangePasswordForm(false);
                  setCurrentPassword("");
                  setNewPasswordUpdate("");
                  setConfirmPasswordUpdate("");
                }}
                disabled={actionsDisabled}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="mb-6 gap-4">
              <View>
                <Text className="text-muted mb-2 text-sm font-medium">
                  {t("account.manage.currentPassword")}
                </Text>
                <TextInput
                  className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
                  placeholder={t("account.manage.currentPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  editable={!isLoading}
                />
              </View>

              <View>
                <Text className="text-muted mb-2 text-sm font-medium">
                  {t("account.manage.newPassword")}
                </Text>
                <TextInput
                  className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
                  placeholder={t("account.manage.minPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={newPasswordUpdate}
                  onChangeText={setNewPasswordUpdate}
                  editable={!isLoading}
                />
              </View>

              <View>
                <Text className="text-muted mb-2 text-sm font-medium">
                  {t("account.manage.confirmNewPassword")}
                </Text>
                <TextInput
                  className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
                  placeholder={t("account.manage.repeatPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={confirmPasswordUpdate}
                  onChangeText={setConfirmPasswordUpdate}
                  editable={!isLoading}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowChangePasswordForm(false);
                  setCurrentPassword("");
                  setNewPasswordUpdate("");
                  setConfirmPasswordUpdate("");
                }}
                disabled={actionsDisabled}
                className="border-divider bg-surface flex-1 items-center rounded-lg border py-3">
                <Text className="text-content font-medium">{t("account.manage.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdatePassword}
                disabled={actionsDisabled}
                className="bg-primary flex-1 items-center rounded-lg py-3">
                {isLoading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text className="text-on-primary font-semibold">
                    {t("account.manage.update")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Info Card */}
        <Card variant="outlined" className="border-info bg-info-soft">
          <View className="flex-row gap-3">
            <View className="pt-1">
              <Ionicons name="information-circle" size={20} color={colors.info} />
            </View>
            <View className="flex-1">
              <Text className="text-info text-sm leading-5">
                {t("account.manage.recommendation")}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};
