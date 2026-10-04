import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHouse } from "@/context/HouseContext";
import { useCaregiver } from "@/context/CaregiverContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useAppNavigation } from "@/hooks/useAppNavigation";

interface HouseSelectionScreenProps {
  navigation: any;
}

export const HouseSelectionScreen: React.FC<HouseSelectionScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { userHouses, selectHouse, isLoading: housesLoading, invitations } = useHouse();
  const { links: caregiverLinks } = useCaregiver();
  const { showAlert } = useAlert();
  const { navigateToCareManagement } = useAppNavigation();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  // Track screen view
  useScreenTracking("HouseSelection", "HouseSelectionScreen");

  const handleSelectHouse = async (houseId: string) => {
    try {
      setIsLoading(true);
      console.log("HouseSelectionScreen: Selecting house with ID:", houseId);
      await selectHouse(houseId);
      console.log(
        "HouseSelectionScreen: House selected successfully, navigating to CareManagement",
      );
      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        navigateToCareManagement();
      }, 100);
    } catch (error: any) {
      console.error("Error selecting house:", error);
      showAlert({
        title: "Erro",
        message: "Erro ao selecionar a casa. Tente novamente.",
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

  const handleCreateHouse = () => {
    navigation.navigate("CreateHouse");
  };

  const handleViewInvitations = () => {
    navigation.navigate("HouseInvite");
  };

  const handleEditHouse = (house: any) => {
    navigation.navigate("EditHouse", { house });
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

  if (housesLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-zinc-900"
        style={{
          paddingTop: topInset,
          paddingBottom: bottomInset,
        }}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="mt-4 text-lg text-white">Carregando casas...</Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-zinc-900"
      style={{
        paddingTop: topInset + 24,
        paddingBottom: bottomInset + 16,
        paddingHorizontal: 18,
      }}>
      <ScrollView className="flex-1 px-6 py-8">
        {/* Header */}
        <View className="mb-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-600">
            <Ionicons name="home" size={40} color="white" />
          </View>
          <Text className="mb-2 text-2xl font-bold text-white">Selecionar Casa</Text>
          <Text className="text-center text-zinc-400">
            Escolha uma casa para gerenciar ou crie uma nova
          </Text>
        </View>

        {/* Shortcut to her own schedule when she also works as a caregiver */}
        {caregiverLinks.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate("MyShifts")}
            className="mb-6 flex-row items-center rounded-lg border border-emerald-700 bg-emerald-900/20 p-4">
            <Ionicons name="calendar" size={24} color="#10b981" />
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-white">Meus Plantões</Text>
              <Text className="text-sm text-emerald-300">
                Você é cuidadora em {new Set(caregiverLinks.map((l) => l.houseId)).size}{" "}
                {new Set(caregiverLinks.map((l) => l.houseId)).size === 1 ? "casa" : "casas"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#10b981" />
          </TouchableOpacity>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <View className="mb-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-white">
                Convites Pendentes ({pendingInvitations.length})
              </Text>
              <TouchableOpacity
                onPress={handleViewInvitations}
                className="rounded-lg bg-amber-600 px-3 py-1">
                <Text className="text-sm font-medium text-white">Ver Todos</Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-3">
              {pendingInvitations.slice(0, 2).map((invitation) => (
                <View
                  key={invitation.id}
                  className="rounded-lg border border-amber-700 bg-amber-900/20 p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="font-semibold text-white">{invitation.houseName}</Text>
                      <Text className="text-sm text-amber-300">
                        Convidado por: {invitation.invitedByName}
                      </Text>
                    </View>
                    <View className="rounded-full bg-amber-500 px-2 py-1">
                      <Text className="text-xs font-medium text-white">Novo</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {pendingInvitations.length > 2 && (
              <TouchableOpacity
                onPress={handleViewInvitations}
                className="mt-3 items-center rounded-lg bg-zinc-800 py-3">
                <Text className="text-sm text-zinc-400">
                  Ver mais {pendingInvitations.length - 2} convites
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Houses List */}
        <View className="mb-6">
          <Text className="mb-4 text-lg font-semibold text-white">Suas Casas</Text>

          {userHouses.length === 0 ? (
            <View className="items-center rounded-lg bg-zinc-800 p-6">
              <Ionicons name="home-outline" size={48} color="#71717a" />
              <Text className="mt-4 mb-2 text-center text-zinc-400">Você ainda não tem casas</Text>
              <Text className="text-center text-sm text-zinc-500">
                Crie sua primeira casa para começar
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {userHouses.map((house) => (
                <View key={house.id} className="rounded-lg border border-zinc-700 bg-zinc-800">
                  <TouchableOpacity
                    onPress={() => handleSelectHouse(house.id)}
                    disabled={isLoading}
                    className="p-4 pb-2"
                    style={{ opacity: isLoading ? 0.7 : 1 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-white">{house.name}</Text>
                        {house.description && (
                          <Text className="mt-1 text-sm text-zinc-400">{house.description}</Text>
                        )}
                        <View className="mt-2 flex-row items-center">
                          <Ionicons name="people" size={16} color="#71717a" />
                          <Text className="ml-1 text-sm text-zinc-500">
                            {house.managers.length} gerente{house.managers.length !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#71717a" />
                    </View>
                  </TouchableOpacity>

                  {/* Edit Button */}
                  <View className="border-t border-zinc-700 py-2">
                    <TouchableOpacity
                      onPress={() => handleEditHouse(house)}
                      disabled={isLoading}
                      className="flex-row items-center justify-center py-2"
                      style={{ opacity: isLoading ? 0.7 : 1 }}>
                      <Ionicons name="create-outline" size={16} color="#10b981" />
                      <Text className="ml-2 text-sm font-medium text-emerald-500">Editar Casa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="gap-3 space-y-3">
          <TouchableOpacity
            onPress={handleCreateHouse}
            disabled={isLoading}
            className="items-center rounded-lg bg-emerald-600 py-4"
            style={{ opacity: isLoading ? 0.7 : 1 }}>
            <View className="flex-row items-center">
              <Ionicons name="add" size={20} color="white" />
              <Text className="ml-2 text-lg font-semibold text-white">Criar Nova Casa</Text>
            </View>
          </TouchableOpacity>

          {pendingInvitations.length > 0 && (
            <TouchableOpacity
              onPress={handleViewInvitations}
              disabled={isLoading}
              className="items-center rounded-lg bg-zinc-700 py-4"
              style={{ opacity: isLoading ? 0.7 : 1 }}>
              <View className="flex-row items-center">
                <Ionicons name="mail" size={20} color="white" />
                <Text className="ml-2 text-lg font-semibold text-white">
                  Ver Convites ({pendingInvitations.length})
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Help Text */}
        <View className="mt-8 rounded-lg bg-zinc-800 p-4">
          <Text className="text-center text-sm text-zinc-400">
            💡 Dica: Você pode compartilhar casas com outros gerentes para colaborar no
            gerenciamento
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
