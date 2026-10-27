import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth, UserFacingAuthError, type FacebookLinkCredentials } from "@/context/AuthContext";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { AppLogo } from "@/components/AppLogo";
import { useAppTheme } from "@/theme";

export function FacebookLinkScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { completeFacebookLink, cancelFacebookLink, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const disabled = busy || providerBusy;

  const finish = async (credentials: FacebookLinkCredentials) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await completeFacebookLink(credentials);
    } catch (failure: unknown) {
      const code = (failure as { code?: string })?.code;
      const message =
        failure instanceof UserFacingAuthError
          ? failure.message
          : code === "auth/invalid-credential" ||
              code === "auth/wrong-password" ||
              code === "auth/user-not-found"
            ? t("auth.facebook.confirmFailed")
            : code === "auth/credential-already-in-use" || code === "auth/provider-already-linked"
              ? t("auth.facebook.linkConflict")
              : t("auth.facebook.linkFailed");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const withPassword = () => {
    if (disabled) return;
    if (!email.trim() || !password) {
      setError(t("auth.facebook.credentialsRequired"));
      return;
    }
    void finish({ email, password });
  };

  const recoverPassword = async () => {
    if (disabled) return;
    if (!email.trim()) {
      setError(t("auth.errors.emailFirst"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(email.trim());
      setNotice(t("auth.login.resetSent"));
    } catch {
      setError(t("auth.errors.resetFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="bg-app flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-8">
          <View className="mb-6 items-center">
            <AppLogo size={48} className="mb-4" />
            <Text className="text-content mb-3 text-center text-xl font-semibold">
              {t("auth.facebook.confirmTitle")}
            </Text>
            <Text className="text-muted text-center">{t("auth.facebook.confirmMessage")}</Text>
          </View>
          <GoogleSignInButton
            mode="signin"
            disabled={disabled}
            onBusyChange={setProviderBusy}
            onSuccess={(googleIdToken) => finish({ googleIdToken })}
            onError={() => setError(t("auth.errors.googleConnect"))}
          />
          <Text className="text-muted my-5 text-center">{t("auth.login.or")}</Text>
          <Text className="text-content mb-2">{t("auth.login.email")}</Text>
          <TextInput
            accessibilityLabel={t("auth.login.email")}
            className="bg-surface border-divider text-content mb-4 rounded-lg border px-4 py-4"
            placeholder={t("auth.login.emailPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!disabled}
          />
          <Text className="text-content mb-2">{t("auth.login.password")}</Text>
          <TextInput
            accessibilityLabel={t("auth.login.password")}
            className="bg-surface border-divider text-content mb-4 rounded-lg border px-4 py-4"
            placeholder={t("auth.login.passwordPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!disabled}
            onSubmitEditing={withPassword}
          />
          <TouchableOpacity onPress={recoverPassword} disabled={disabled} className="mb-5 self-end">
            <Text className="text-accent">{t("auth.login.forgot")}</Text>
          </TouchableOpacity>
          {!!error && (
            <Text accessibilityRole="alert" className="text-danger mb-4">
              {error}
            </Text>
          )}
          {!!notice && <Text className="text-content mb-4">{notice}</Text>}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={withPassword}
            disabled={disabled}
            className="bg-primary items-center rounded-lg py-4"
            style={{ opacity: disabled ? 0.6 : 1 }}>
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text className="text-on-primary text-base font-semibold">
                {t("auth.facebook.confirmSubmit")}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={cancelFacebookLink}
            disabled={disabled}
            className="mt-4 items-center py-3">
            <Text className="text-muted">{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
