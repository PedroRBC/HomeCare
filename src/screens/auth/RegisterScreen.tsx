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
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useFormValidation } from "@/hooks/useFormValidation";
import { registerSchema, RegisterFormData } from "@/schemas/auth.schemas";
import { acceptPolicies } from "@/utils/privacy";
import { useTranslation } from "react-i18next";

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const { signUp } = useAuth();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  // Form validation
  const { values, errors, setValue, validate, clearErrors } = useFormValidation<RegisterFormData>({
    schema: registerSchema,
    initialValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Track screen view
  useScreenTracking("Register", "RegisterScreen");

  const openPrivacyPolicy = () => {
    navigation.navigate("PrivacyPolicy");
  };

  const openTermsOfService = () => {
    navigation.navigate("TermsOfService");
  };

  const handleRegister = async () => {
    // Clear previous errors
    clearErrors();

    // Check if terms are accepted
    if (!acceptTerms) {
      showAlert({
        title: t("auth.register.termsTitle"),
        message: t("auth.register.termsRequired"),
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

    // Validate form
    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      // Acceptance is recorded with the account, as proof of consent (LGPD art. 8)
      await signUp(values.email, values.password, values.name, acceptPolicies());

      showAlert({
        title: t("auth.register.successTitle"),
        message: t("auth.register.successMessage"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
            onPress: () => navigation.navigate("Login"),
          },
        ],
      });
    } catch (error: any) {
      let errorMessage = t("auth.errors.registerFailed");

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = t("auth.errors.emailInUse");
          break;
        case "auth/invalid-email":
          errorMessage = t("auth.errors.invalidEmail");
          break;
        case "auth/weak-password":
          errorMessage = t("auth.errors.weakPassword");
          break;
        case "auth/network-request-failed":
          errorMessage = t("auth.errors.network");
          break;
        case "auth/too-many-requests":
          errorMessage = t("auth.errors.tooManyRequests");
          break;
      }

      showAlert({
        title: t("common.error"),
        message: errorMessage,
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
  };

  return (
    <View
      className="bg-app flex-1"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <View className="bg-primary mb-4 h-20 w-20 items-center justify-center rounded-full">
              <Ionicons name="person-add" size={40} color={colors.onPrimary} />
            </View>
            <Text testID="auth-register-title" className="text-content mb-2 text-2xl font-bold">
              {t("auth.register.title")}
            </Text>
            <Text className="text-muted text-center">{t("auth.register.subtitle")}</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Name Input */}
            <View>
              <Text className="text-content mb-2 text-sm font-medium">
                {t("auth.register.name")}
              </Text>
              <View
                className={`bg-surface flex-row items-center rounded-lg border px-4 ${
                  errors.find((e) => e.field === "name") ? "border-danger" : "border-divider"
                }`}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  className="text-content flex-1 px-3 py-4"
                  placeholder={t("auth.register.namePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={values.name}
                  onChangeText={(text) => setValue("name", text)}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.find((e) => e.field === "name") && (
                <Text className="text-danger mt-1 text-xs">
                  {errors.find((e) => e.field === "name")?.message}
                </Text>
              )}
            </View>

            {/* Email Input */}
            <View>
              <Text className="text-content mb-2 text-sm font-medium">
                {t("auth.register.email")}
              </Text>
              <View
                className={`bg-surface flex-row items-center rounded-lg border px-4 ${
                  errors.find((e) => e.field === "email") ? "border-danger" : "border-divider"
                }`}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  className="text-content flex-1 px-3 py-4"
                  placeholder={t("auth.register.emailPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={values.email}
                  onChangeText={(text) => setValue("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.find((e) => e.field === "email") && (
                <Text className="text-danger mt-1 text-xs">
                  {errors.find((e) => e.field === "email")?.message}
                </Text>
              )}
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-content mb-2 text-sm font-medium">
                {t("auth.register.password")}
              </Text>
              <View
                className={`bg-surface flex-row items-center rounded-lg border px-4 ${
                  errors.find((e) => e.field === "password") ? "border-danger" : "border-divider"
                }`}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  className="text-content flex-1 px-3 py-4"
                  placeholder={t("auth.register.passwordPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={values.password}
                  onChangeText={(text) => setValue("password", text)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.find((e) => e.field === "password") && (
                <Text className="text-danger mt-1 text-xs">
                  {errors.find((e) => e.field === "password")?.message}
                </Text>
              )}
            </View>

            {/* Confirm Password Input */}
            <View>
              <Text className="text-content mb-2 text-sm font-medium">
                {t("auth.register.confirm")}
              </Text>
              <View
                className={`bg-surface flex-row items-center rounded-lg border px-4 ${
                  errors.find((e) => e.field === "confirmPassword")
                    ? "border-danger"
                    : "border-divider"
                }`}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  className="text-content flex-1 px-3 py-4"
                  placeholder={t("auth.register.confirmPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={values.confirmPassword}
                  onChangeText={(text) => setValue("confirmPassword", text)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}>
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.find((e) => e.field === "confirmPassword") && (
                <Text className="text-danger mt-1 text-xs">
                  {errors.find((e) => e.field === "confirmPassword")?.message}
                </Text>
              )}
            </View>

            {/* Terms and Privacy Policy */}
            <View className="mt-4">
              <TouchableOpacity
                onPress={() => setAcceptTerms(!acceptTerms)}
                disabled={isLoading}
                className="flex-row items-start">
                <View
                  className={`mt-0.5 mr-3 h-5 w-5 items-center justify-center rounded border-2 ${
                    acceptTerms ? "border-primary bg-primary" : "border-divider"
                  }`}>
                  {acceptTerms && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                </View>
                <View className="flex-1">
                  <Text className="text-muted text-sm leading-5">
                    {t("auth.register.agreeBefore")}
                    <TouchableOpacity onPress={openTermsOfService} disabled={isLoading}>
                      <Text className="text-accent font-medium underline">
                        {t("auth.register.terms")}
                      </Text>
                    </TouchableOpacity>
                    {t("auth.register.agreeAnd")}
                    <TouchableOpacity onPress={openPrivacyPolicy} disabled={isLoading}>
                      <Text className="text-accent font-medium underline">
                        {t("auth.register.privacy")}
                      </Text>
                    </TouchableOpacity>
                    {t("auth.register.agreeAfter")}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading || !acceptTerms}
              className={`mt-6 items-center rounded-lg py-4 ${
                acceptTerms ? "bg-primary" : "bg-disabled"
              }`}
              style={{ opacity: isLoading || !acceptTerms ? 0.7 : 1 }}>
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text
                  className={`text-lg font-semibold ${acceptTerms ? "text-on-primary" : "text-muted"}`}>
                  {t("auth.register.title")}
                </Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View className="mt-6 flex-row items-center justify-center">
              <Text className="text-muted">{t("auth.register.haveAccount")}</Text>
              <TouchableOpacity
                testID="auth-register-login"
                onPress={() => navigation.navigate("Login")}
                disabled={isLoading}>
                <Text className="text-accent font-medium">{t("auth.register.login")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
