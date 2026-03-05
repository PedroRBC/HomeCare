import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHouse } from "@/context/HouseContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { HouseInvitation } from "@/types/house.types";

interface HouseInvitationsScreenProps {
  navigation: any;
}

export const HouseInvitationsScreen: React.FC<HouseInvitationsScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);

  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { invitations, acceptInvitation, declineInvitation, refreshHouses } = useHouse();
  const { showAlert } = useAlert();

  useScreenTracking("HouseInvitations", "HouseInvitationsScreen");

  useEffect(() => {
    // Refresh invitations when component mounts
    refreshHouses();
  }, [refreshHouses]);

  const handleAcceptInvitation = async (invitation: HouseInvitation) => {
    setIsLoading(true);
    try {
      await acceptInvitation(invitation.id);
      showAlert({
        title: "Convite Aceito",
        message: `Você agora tem acesso à casa "${invitation.houseName}".`,
        icon: "checkmark-circle",
        iconColor: "#10b981",
        buttons: [
          {
            text: "OK",
            style: "default",
            onPress: () => {
              // The router will automatically navigate to the house selection screen
              // where the user can select the newly accessible house
            },
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: "Erro",
        message: error.message || "Erro ao aceitar convite. Tente novamente.",
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

  const handleDeclineInvitation = async (invitation: HouseInvitation) => {
    showAlert({
      title: "Recusar Convite",
      message: `Tem certeza que deseja recusar o convite para a casa "${invitation.houseName}"?`,
      icon: "warning",
      iconColor: "#f59e0b",
      buttons: [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recusar",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await declineInvitation(invitation.id);
              showAlert({
                title: "Convite Recusado",
                message: "O convite foi recusado com sucesso.",
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
              showAlert({
                title: "Erro",
                message: error.message || "Erro ao recusar convite. Tente novamente.",
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#f59e0b"; // amber-500
      case "accepted":
        return "#10b981"; // emerald-500
      case "declined":
        return "#ef4444"; // red-500
      case "expired":
        return "#6b7280"; // gray-500
      default:
        return "#6b7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "accepted":
        return "Aceito";
      case "declined":
        return "Recusado";
      case "expired":
        return "Expirado";
      default:
        return status;
    }
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");
  const otherInvitations = invitations.filter((inv) => inv.status !== "pending");

  if (isLoading && invitations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="mt-4 text-lg text-white">Carregando convites...</Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
        <View className="mb-8 items-center">
          <Ionicons name="mail-outline" size={60} color="#10b981" className="mb-4" />
          <Text className="mb-2 text-3xl font-bold text-white">Convites de Casa</Text>
          <Text className="text-center text-zinc-400">Gerencie seus convites para casas</Text>
        </View>

        {invitations.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="mail-open-outline" size={50} color="#a1a1aa" className="mb-4" />
            <Text className="mb-6 text-center text-lg text-zinc-400">
              Você não tem nenhum convite pendente.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="items-center rounded-lg bg-zinc-800 px-6 py-3">
              <Text className="font-semibold text-white">Voltar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-6">
            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <View>
                <Text className="mb-4 text-lg font-semibold text-white">
                  Convites Pendentes ({pendingInvitations.length})
                </Text>
                <View className="gap-3">
                  {pendingInvitations.map((invitation) => (
                    <View
                      key={invitation.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
                      <View className="mb-3 flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-lg font-semibold text-white">
                            {invitation.houseName}
                          </Text>
                          <Text className="text-sm text-zinc-400">
                            Convidado por: {invitation.invitedByName}
                          </Text>
                          <Text className="mt-1 text-xs text-zinc-500">
                            Enviado em: {formatDate(invitation.createdAt)}
                          </Text>
                        </View>
                        <View className="rounded-full bg-amber-500/20 px-3 py-1">
                          <Text className="text-xs font-medium text-amber-400">
                            {getStatusText(invitation.status)}
                          </Text>
                        </View>
                      </View>

                      <Text className="mb-4 text-sm text-zinc-300">
                        Você foi convidado para gerenciar esta casa como{" "}
                        <Text className="font-semibold">
                          {invitation.role === "owner" ? "proprietário" : "gerente"}
                        </Text>
                        .
                      </Text>

                      <View className="flex-row space-x-3">
                        <TouchableOpacity
                          onPress={() => handleAcceptInvitation(invitation)}
                          disabled={isLoading}
                          className="flex-1 items-center rounded-lg bg-emerald-600 py-3"
                          style={{ opacity: isLoading ? 0.7 : 1 }}>
                          <Text className="font-semibold text-white">Aceitar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeclineInvitation(invitation)}
                          disabled={isLoading}
                          className="flex-1 items-center rounded-lg bg-zinc-700 py-3"
                          style={{ opacity: isLoading ? 0.7 : 1 }}>
                          <Text className="font-semibold text-white">Recusar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Other Invitations */}
            {otherInvitations.length > 0 && (
              <View>
                <Text className="mb-4 text-lg font-semibold text-white">
                  Histórico de Convites ({otherInvitations.length})
                </Text>
                <View className="space-y-3">
                  {otherInvitations.map((invitation) => (
                    <View
                      key={invitation.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
                      <View className="mb-3 flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-lg font-semibold text-white">
                            {invitation.houseName}
                          </Text>
                          <Text className="text-sm text-zinc-400">
                            Convidado por: {invitation.invitedByName}
                          </Text>
                          <Text className="mt-1 text-xs text-zinc-500">
                            Enviado em: {formatDate(invitation.createdAt)}
                          </Text>
                        </View>
                        <View
                          className="rounded-full px-3 py-1"
                          style={{
                            backgroundColor: `${getStatusColor(invitation.status)}20`,
                          }}>
                          <Text
                            className="text-xs font-medium"
                            style={{ color: getStatusColor(invitation.status) }}>
                            {getStatusText(invitation.status)}
                          </Text>
                        </View>
                      </View>

                      <Text className="text-sm text-zinc-300">
                        Convite para ser{" "}
                        <Text className="font-semibold">
                          {invitation.role === "owner" ? "proprietário" : "gerente"}
                        </Text>
                        .
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mt-6 items-center rounded-lg bg-zinc-800 py-3">
              <Text className="font-semibold text-white">Voltar</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
