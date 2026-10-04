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
import { loginSchema, LoginFormData } from "@/schemas/auth.schemas";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useTranslation } from "react-i18next";

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, signInWithGoogle, resetPassword } = useAuth();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  // Form validation
  const { values, errors, setValue, validate, clearErrors } = useFormValidation<LoginFormData>({
    schema: loginSchema,
    initialValues: {
      email: "",
      password: "",
    },
  });

  // Track screen view
  useScreenTracking("Login", "LoginScreen");

  const handleLogin = async () => {
    // Clear previous errors
    clearErrors();

    // Validate form
    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      await signIn(values.email, values.password);
      // Navigation will be handled by the auth state change
    } catch (error: any) {
      let errorMessage = t("auth.errors.loginFailed");

      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = t("auth.errors.userNotFound");
          break;
        case "auth/wrong-password":
          errorMessage = t("auth.errors.wrongPassword");
          break;
        case "auth/invalid-email":
          errorMessage = t("auth.errors.invalidEmail");
          break;
        case "auth/user-disabled":
          errorMessage = t("auth.errors.userDisabled");
          break;
        case "auth/too-many-requests":
          errorMessage = t("auth.errors.tooManyRequests");
          break;
        case "auth/network-request-failed":
          errorMessage = t("auth.errors.network");
          break;
      }

      showAlert({
        title: t("common.error"),
        message: errorMessage,
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
  };

  const handleForgotPassword = () => {
    if (!values.email.trim()) {
      showAlert({
        title: t("common.error"),
        message: t("auth.errors.emailFirst"),
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

    showAlert({
      title: t("auth.login.resetTitle"),
      message: t("auth.login.resetConfirm", { email: values.email }),
      icon: "mail",
      iconColor: "#3b82f6",
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("auth.login.send"),
          style: "default",
          onPress: async () => {
            try {
              await resetPassword(values.email);
              showAlert({
                title: t("auth.login.success"),
                message: t("auth.login.resetSent"),
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
              console.error("Password reset error:", error);
              showAlert({
                title: t("common.error"),
                message: t("auth.errors.resetFailed"),
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

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      setIsLoading(true);
      await signInWithGoogle(idToken);
      // Navegação automática via AuthContext
    } catch (error: any) {
      let errorMessage = t("auth.errors.googleFailed");

      if (error.message === "ACCOUNT_EXISTS_LINK_REQUIRED") {
        errorMessage = t("auth.errors.googleAccountExists");
      } else if (error.code === "auth/account-exists-with-different-credential") {
        errorMessage = t("auth.errors.googleOtherMethod");
      }

      showAlert({
        title: t("common.error"),
        message: errorMessage,
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (error: Error) => {
    console.error("Google Sign-In error:", error);
    showAlert({
      title: t("common.error"),
      message: t("auth.errors.googleConnect"),
      icon: "alert-circle",
      iconColor: "#ef4444",
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };

  return (
    <View
      className="flex-1 bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-600">
              <Ionicons name="home" size={40} color="white" />
            </View>
            <Text className="mb-2 text-2xl font-bold text-white">HomeCare</Text>
            <Text className="text-center text-zinc-400">{t("auth.login.subtitle")}</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Email Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">{t("auth.login.email")}</Text>
              <View
                className={`flex-row items-center rounded-lg border bg-zinc-800 px-4 ${
                  errors.find((e) => e.field === "email") ? "border-red-500" : "border-zinc-700"
                }`}>
                <Ionicons name="mail-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder={t("auth.login.emailPlaceholder")}
                  placeholderTextColor="#71717a"
                  value={values.email}
                  onChangeText={(text) => setValue("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.find((e) => e.field === "email") && (
                <Text className="mt-1 text-xs text-red-500">
                  {errors.find((e) => e.field === "email")?.message}
                </Text>
              )}
            </View>

            {/* Password Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">
                {t("auth.login.password")}
              </Text>
              <View
                className={`flex-row items-center rounded-lg border bg-zinc-800 px-4 ${
                  errors.find((e) => e.field === "password") ? "border-red-500" : "border-zinc-700"
                }`}>
                <Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder={t("auth.login.passwordPlaceholder")}
                  placeholderTextColor="#71717a"
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
                    color="#a1a1aa"
                  />
                </TouchableOpacity>
              </View>
              {errors.find((e) => e.field === "password") && (
                <Text className="mt-1 text-xs text-red-500">
                  {errors.find((e) => e.field === "password")?.message}
                </Text>
              )}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={isLoading}
              className="self-end">
              <Text className="text-sm text-emerald-500">{t("auth.login.forgot")}</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className="mt-6 items-center rounded-lg bg-emerald-600 py-4"
              style={{ opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-semibold text-white">{t("auth.login.submit")}</Text>
              )}
            </TouchableOpacity>

            {/* Divisor */}
            <View className="my-6 flex-row items-center">
              <View className="h-px flex-1 bg-zinc-700" />
              <Text className="px-4 text-sm text-zinc-500">{t("auth.login.or")}</Text>
              <View className="h-px flex-1 bg-zinc-700" />
            </View>

            {/* Google Sign-In Button */}
            <GoogleSignInButton
              onSuccess={handleGoogleSignIn}
              onError={handleGoogleError}
              disabled={isLoading}
              mode="signin"
            />

            {/* Register Link */}
            <View className="mt-6 flex-row items-center justify-center">
              <Text className="text-zinc-400">{t("auth.login.noAccount")}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Register")}
                disabled={isLoading}>
                <Text className="font-medium text-emerald-500">{t("auth.login.register")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
