import React, { useState, useEffect } from "react";
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
import {
  AvatarPicker,
  AvatarDisplay,
  parseAvatarConfig,
  type AvatarConfig,
} from "@/components/AvatarPicker";

interface UserProfileScreenProps {
  navigation: any;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ navigation }) => {
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(parseAvatarConfig(null));

  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const { showAlert } = useAlert();

  useScreenTracking("UserProfile", "UserProfileScreen");

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    } else if (user?.email) {
      setDisplayName(user.email.split("@")[0]);
    }
    setAvatarConfig(parseAvatarConfig(user?.photoURL));
  }, [user]);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      showAlert({
        title: "Erro",
        message: "O nome é obrigatório.",
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

    if (displayName.trim() === user?.displayName) {
      showAlert({
        title: "Informação",
        message: "Nenhuma alteração foi feita.",
        icon: "information-circle",
        iconColor: "#3b82f6",
        buttons: [
          {
            text: "OK",
            style: "default",
          },
        ],
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        photoURL: JSON.stringify(avatarConfig),
      });
      showAlert({
        title: "Sucesso",
        message: "Perfil atualizado com sucesso!",
        icon: "checkmark-circle",
        iconColor: "#10b981",
        buttons: [
          {
            text: "OK",
            style: "default",
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: "Erro",
        message: error.message || "Erro ao atualizar perfil. Tente novamente.",
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
      setIsSaving(false);
    }
  };

  const handleChangeIcon = () => {
    setShowAvatarPicker(true);
  };

  const handleAvatarSelect = (config: AvatarConfig) => {
    setAvatarConfig(config);
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
        <View className="mb-8 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Ionicons name="arrow-back" size={28} color="#a1a1aa" />
          </TouchableOpacity>
          <Text className="mr-10 flex-1 text-center text-2xl font-bold text-white">Meu Perfil</Text>
        </View>

        {/* Profile Icon Section */}
        <View className="mb-8 items-center">
          <TouchableOpacity onPress={handleChangeIcon} disabled={isSaving}>
            <AvatarDisplay config={avatarConfig} size={96} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleChangeIcon} className="mt-3" disabled={isSaving}>
            <Text className="text-sm font-medium text-emerald-500">Alterar Ícone</Text>
          </TouchableOpacity>
        </View>

        <AvatarPicker
          visible={showAvatarPicker}
          currentConfig={avatarConfig}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />

        {/* Profile Information */}
        <View className="space-y-6">
          <View>
            <Text className="mb-2 text-sm font-medium text-white">Nome de Exibição</Text>
            <TextInput
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4 text-white"
              placeholder="Seu nome"
              placeholderTextColor="#71717a"
              value={displayName}
              onChangeText={setDisplayName}
              editable={!isSaving}
              maxLength={50}
            />
            <Text className="mt-1 text-xs text-zinc-500">
              Este nome será exibido para outros usuários
            </Text>
          </View>

          <View>
            <Text className="mb-2 text-sm font-medium text-white">Email</Text>
            <View className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4">
              <Text className="text-zinc-400">{user?.email || "Não disponível"}</Text>
            </View>
            <Text className="mt-1 text-xs text-zinc-500">O email não pode ser alterado</Text>
          </View>

          {/* Information Card */}
          <View className="rounded-lg bg-zinc-800 p-4">
            <View className="mb-3 flex-row items-center">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#10b981"
                className="mr-2"
              />
              <Text className="font-medium text-white">Sobre o Perfil</Text>
            </View>
            <Text className="text-sm leading-5 text-zinc-400">
              • Seu nome será exibido em convites e notificações{"\n"}• Outros usuários verão seu
              nome ao gerenciar casas{"\n"}• Você pode alterar seu nome a qualquer momento
            </Text>
          </View>

          {/* Manage Account Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate("AccountManagement")}
            disabled={isSaving}
            className="items-center rounded-lg bg-blue-600 py-4">
            <Text className="text-base font-semibold text-white">Gerenciar Conta</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={isSaving || !displayName.trim()}
            className={`mt-6 items-center rounded-lg py-4 ${
              isSaving || !displayName.trim() ? "bg-zinc-700" : "bg-emerald-600"
            }`}
            style={{ opacity: isSaving || !displayName.trim() ? 0.7 : 1 }}>
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-lg font-semibold text-white">Salvar Alterações</Text>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={isSaving}
            className="items-center py-3">
            <Text className="text-base text-zinc-400">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
