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

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
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
        title: "Termos e Condições",
        message: "Você deve aceitar os Termos de Uso e Política de Privacidade para continuar.",
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

    // Validate form
    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      await signUp(values.email, values.password, values.name);

      showAlert({
        title: "Sucesso!",
        message: "Conta criada com sucesso! Você já pode fazer login.",
        icon: "checkmark-circle",
        iconColor: "#10b981",
        buttons: [
          {
            text: "OK",
            style: "default",
            onPress: () => navigation.navigate("Login"),
          },
        ],
      });
    } catch (error: any) {
      let errorMessage = "Erro ao criar conta. Tente novamente.";

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "Este email já está em uso.";
          break;
        case "auth/invalid-email":
          errorMessage = "Email inválido.";
          break;
        case "auth/weak-password":
          errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Erro de conexão. Verifique sua internet.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
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

  return (
    <View
      className="flex-1 bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-600">
              <Ionicons name="person-add" size={40} color="white" />
            </View>
            <Text className="mb-2 text-2xl font-bold text-white">Criar Conta</Text>
            <Text className="text-center text-zinc-400">
              Preencha os dados abaixo para criar sua conta
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Name Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">Nome Completo</Text>
              <View
                className={`flex-row items-center rounded-lg border bg-zinc-800 px-4 ${
                  errors.find((e) => e.field === "name") ? "border-red-500" : "border-zinc-700"
                }`}>
                <Ionicons name="person-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder="Seu nome completo"
                  placeholderTextColor="#71717a"
                  value={values.name}
                  onChangeText={(text) => setValue("name", text)}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.find((e) => e.field === "name") && (
                <Text className="mt-1 text-xs text-red-500">
                  {errors.find((e) => e.field === "name")?.message}
                </Text>
              )}
            </View>

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
                  placeholder="Mínimo 6 caracteres"
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

            {/* Confirm Password Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">Confirmar Senha</Text>
              <View
                className={`flex-row items-center rounded-lg border bg-zinc-800 px-4 ${
                  errors.find((e) => e.field === "confirmPassword")
                    ? "border-red-500"
                    : "border-zinc-700"
                }`}>
                <Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder="Digite a senha novamente"
                  placeholderTextColor="#71717a"
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
                    color="#a1a1aa"
                  />
                </TouchableOpacity>
              </View>
              {errors.find((e) => e.field === "confirmPassword") && (
                <Text className="mt-1 text-xs text-red-500">
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
                    acceptTerms ? "border-emerald-600 bg-emerald-600" : "border-zinc-600"
                  }`}>
                  {acceptTerms && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm leading-5 text-zinc-300">
                    Eu concordo com os{" "}
                    <TouchableOpacity onPress={openTermsOfService} disabled={isLoading}>
                      <Text className="font-medium text-emerald-500 underline">Termos de Uso</Text>
                    </TouchableOpacity>{" "}
                    e{" "}
                    <TouchableOpacity onPress={openPrivacyPolicy} disabled={isLoading}>
                      <Text className="font-medium text-emerald-500 underline">
                        Política de Privacidade
                      </Text>
                    </TouchableOpacity>{" "}
                    do HomeCare.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading || !acceptTerms}
              className={`mt-6 items-center rounded-lg py-4 ${
                acceptTerms ? "bg-emerald-600" : "bg-zinc-700"
              }`}
              style={{ opacity: isLoading || !acceptTerms ? 0.7 : 1 }}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-semibold text-white">Criar Conta</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View className="mt-6 flex-row items-center justify-center">
              <Text className="text-zinc-400">Já tem uma conta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")} disabled={isLoading}>
                <Text className="font-medium text-emerald-500">Faça login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
