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

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
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
      let errorMessage = "Erro ao fazer login. Tente novamente.";

      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "Usuário não encontrado.";
          break;
        case "auth/wrong-password":
          errorMessage = "Senha incorreta.";
          break;
        case "auth/invalid-email":
          errorMessage = "Email inválido.";
          break;
        case "auth/user-disabled":
          errorMessage = "Esta conta foi desabilitada.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Erro de conexão. Verifique sua internet.";
          break;
      }

      showAlert({
        title: "Erro",
        message: errorMessage,
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [
          {
            text: "OK",
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
        title: "Erro",
        message: "Digite seu email primeiro",
        icon: "warning",
        iconColor: "#f59e0b",
        buttons: [
          {
            text: "OK",
            style: "default",
          },
        ],
      });
      return;
    }

    showAlert({
      title: "Recuperar Senha",
      message: `Enviar email de recuperação para ${values.email}?`,
      icon: "mail",
      iconColor: "#3b82f6",
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          style: "default",
          onPress: async () => {
            try {
              await resetPassword(values.email);
              showAlert({
                title: "Sucesso",
                message: "Email de recuperação enviado!",
                icon: "checkmark-circle",
                iconColor: "#10b981",
                buttons: [
                  {
                    text: "OK",
                    style: "default",
                  },
                ],
              });
            } catch (error: any) {
              console.error("Password reset error:", error);
              showAlert({
                title: "Erro",
                message: "Erro ao enviar email de recuperação",
                icon: "alert-circle",
                iconColor: "#ef4444",
                buttons: [
                  {
                    text: "OK",
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
      let errorMessage = "Erro ao fazer login com Google";

      if (error.message === "ACCOUNT_EXISTS_LINK_REQUIRED") {
        errorMessage =
          "Uma conta com este email já existe. Por favor, faça login com email/senha e vincule sua conta Google nas configurações de perfil.";
      } else if (error.code === "auth/account-exists-with-different-credential") {
        errorMessage =
          "Este email já está registrado com outro método. Faça login com email/senha.";
      }

      showAlert({
        title: "Erro",
        message: errorMessage,
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: "OK", style: "default" }],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (error: Error) => {
    console.error("Google Sign-In error:", error);
    showAlert({
      title: "Erro",
      message: "Não foi possível conectar com Google. Tente novamente.",
      icon: "alert-circle",
      iconColor: "#ef4444",
      buttons: [{ text: "OK", style: "default" }],
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
            <Text className="text-center text-zinc-400">Faça login para acessar sua conta</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Email Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">Email</Text>
              <View
                className={`flex-row items-center rounded-lg border bg-zinc-800 px-4 ${
                  errors.find((e) => e.field === "email") ? "border-red-500" : "border-zinc-700"
                }`}>
                <Ionicons name="mail-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder="seu@email.com"
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
              <Text className="mb-2 text-sm font-medium text-white">Senha</Text>
              <View
                className={`flex-row items-center rounded-lg border bg-zinc-800 px-4 ${
                  errors.find((e) => e.field === "password") ? "border-red-500" : "border-zinc-700"
                }`}>
                <Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder="Sua senha"
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
              <Text className="text-sm text-emerald-500">Esqueceu sua senha?</Text>
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
                <Text className="text-lg font-semibold text-white">Entrar</Text>
              )}
            </TouchableOpacity>

            {/* Divisor */}
            <View className="my-6 flex-row items-center">
              <View className="h-px flex-1 bg-zinc-700" />
              <Text className="px-4 text-sm text-zinc-500">ou</Text>
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
              <Text className="text-zinc-400">Não tem uma conta? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Register")}
                disabled={isLoading}>
                <Text className="font-medium text-emerald-500">Cadastre-se</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
