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

interface DeleteAccountScreenProps {
  navigation: any;
}

export const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({ navigation }) => {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { user, deleteAccount } = useAuth();
  const { showAlert } = useAlert();

  useScreenTracking("DeleteAccount", "DeleteAccountScreen");

  const handleDeleteAccount = async () => {
    if (!password || password.trim() === "") {
      showAlert({
        title: "Erro",
        message: "Por favor, digite sua senha para confirmar a exclusão da conta.",
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

    // Final confirmation
    showAlert({
      title: "Confirmação Final",
      message:
        "Tem certeza absoluta que deseja excluir sua conta? Esta ação é irreversível e irá:\n\n• Remover sua conta permanentemente\n• Excluir todas as casas que você possui\n• Remover seu acesso às casas onde é gerente\n• Deletar todos os convites",
      icon: "warning",
      iconColor: "#f59e0b",
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);

              await deleteAccount(password.trim());

              showAlert({
                title: "Conta Excluída",
                message: "Sua conta foi excluída com sucesso. Obrigado por usar o HomeCare.",
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
              console.error("Error deleting account:", error);
              showAlert({
                title: "Erro",
                message:
                  error.message ||
                  "Ocorreu um erro ao excluir sua conta. Tente novamente ou verifique sua conexão com a internet.",
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
          <Text className="mb-2 text-3xl font-bold text-white">Excluir Conta</Text>
          <Text className="text-center text-zinc-400">
            Confirme sua senha para excluir permanentemente sua conta
          </Text>
        </View>

        {/* Warning Card */}
        <View className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-4">
          <View className="flex-row items-start">
            <Ionicons name="warning-outline" size={24} color="#EF4444" className="mt-1 mr-3" />
            <View className="flex-1">
              <Text className="mb-2 text-lg font-semibold text-red-400">Atenção!</Text>
              <Text className="text-sm leading-5 text-red-300">
                Esta ação é irreversível. Ao excluir sua conta:
              </Text>
              <Text className="mt-2 text-sm leading-5 text-red-300">
                • Sua conta será removida permanentemente{"\n"}• Todas as casas que você possui
                serão excluídas{"\n"}• Você perderá acesso às casas onde é gerente{"\n"}• Todos os
                convites serão removidos{"\n"}• Todos os dados serão perdidos
              </Text>
            </View>
          </View>
        </View>

        {/* User Info */}
        <View className="mb-6 rounded-lg bg-zinc-800 p-4">
          <Text className="mb-3 text-lg font-semibold text-white">Informações da Conta</Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={20} color="#9CA3AF" className="mr-3" />
              <Text className="text-zinc-300">Nome: {user?.displayName || "Não definido"}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" className="mr-3" />
              <Text className="text-zinc-300">Email: {user?.email || "Não definido"}</Text>
            </View>
          </View>
        </View>

        {/* Password Input */}
        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-white">Confirmar Senha</Text>
          <View className="relative">
            <TextInput
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4 pr-12 text-white"
              placeholder="Digite sua senha atual"
              placeholderTextColor="#71717a"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2"
              disabled={isLoading}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
          <Text className="mt-1 text-xs text-zinc-500">
            Digite sua senha atual para confirmar a exclusão da conta
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={isLoading || !password.trim()}
            className={`items-center rounded-lg py-4 ${
              isLoading || !password.trim() ? "bg-zinc-700" : "bg-red-600"
            }`}
            style={{ opacity: isLoading || !password.trim() ? 0.7 : 1 }}>
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-lg font-semibold text-white">
                Excluir Conta Permanentemente
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={isLoading}
            className="items-center py-3">
            <Text className="text-base text-zinc-400">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
