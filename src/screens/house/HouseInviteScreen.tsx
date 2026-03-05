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
import { useHouse } from "@/context/HouseContext";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { HouseInvitation } from "@/types/house.types";

interface HouseInviteScreenProps {
  navigation: any;
}

export const HouseInviteScreen: React.FC<HouseInviteScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [selectedHouseId, setSelectedHouseId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"send" | "view">("send");

  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const {
    userHouses,
    sendInvitation,
    invitations,
    acceptInvitation,
    declineInvitation,
    refreshHouses,
  } = useHouse();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Filter houses where the current user is the owner
  const ownedHouses = userHouses.filter((house) =>
    house.managers.some((manager) => manager.userId === user?.uid && manager.role === "owner"),
  );

  useEffect(() => {
    // Refresh invitations when component mounts
    refreshHouses();
  }, [refreshHouses]);

  useScreenTracking("HouseInvite", "HouseInviteScreen");

  const handleSendInvitation = async () => {
    if (!email.trim()) {
      showAlert({
        title: "Erro",
        message: "Por favor, insira um email válido.",
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

    if (!selectedHouseId) {
      showAlert({
        title: "Erro",
        message: "Por favor, selecione uma casa.",
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

    if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
      showAlert({
        title: "Erro",
        message: "Você não pode convidar a si mesmo.",
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert({
        title: "Erro",
        message: "Por favor, insira um email válido.",
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

    const selectedHouse = ownedHouses.find((house) => house.id === selectedHouseId);
    if (!selectedHouse) {
      showAlert({
        title: "Erro",
        message: "Casa selecionada não encontrada ou você não é o proprietário.",
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [
          {
            text: "OK",
            style: "default",
          },
        ],
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendInvitation(selectedHouseId, email.trim());
      showAlert({
        title: "Convite Enviado",
        message: `Um convite foi enviado para ${email.trim()} para a casa "${selectedHouse.name}". Eles receberão uma notificação e poderão aceitar o convite.`,
        icon: "checkmark-circle",
        iconColor: "#10b981",
        buttons: [
          {
            text: "OK",
            style: "default",
            onPress: () => {
              setEmail("");
              setSelectedHouseId("");
              navigation.goBack();
            },
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: "Erro",
        message: error.message || "Erro ao enviar convite. Tente novamente.",
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
          <Text className="mb-2 text-3xl font-bold text-white">Convites</Text>
          <Text className="text-center text-zinc-400">
            Envie convites e gerencie seus convites recebidos
          </Text>
        </View>

        {/* Tab Navigation */}
        <View className="mb-6 flex-row rounded-lg bg-zinc-800 p-1">
          <TouchableOpacity
            onPress={() => setActiveTab("send")}
            className={`flex-1 items-center rounded-md py-3 ${activeTab === "send" ? "bg-emerald-600" : ""}`}>
            <Text
              className={`font-semibold ${activeTab === "send" ? "text-white" : "text-zinc-400"}`}>
              Enviar Convite
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("view")}
            className={`flex-1 items-center rounded-md py-3 ${activeTab === "view" ? "bg-emerald-600" : ""}`}>
            <Text
              className={`font-semibold ${activeTab === "view" ? "text-white" : "text-zinc-400"}`}>
              Ver Convites ({invitations.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Send Invite Tab */}
        {activeTab === "send" && (
          <View className="gap-3 space-y-6">
            <View>
              <Text className="mb-2 text-sm font-medium text-white">Selecionar Casa</Text>
              {ownedHouses.length === 0 ? (
                <View className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
                  <View className="flex-row items-center">
                    <Ionicons name="home-outline" size={24} color="#71717a" className="mr-3" />
                    <View className="flex-1">
                      <Text className="text-center text-zinc-400">
                        Você não possui nenhuma casa como proprietário
                      </Text>
                      <Text className="mt-1 text-center text-sm text-zinc-500">
                        Apenas proprietários podem convidar usuários
                      </Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate("CreateHouse")}
                        className="mt-2">
                        <Text className="text-center font-medium text-emerald-500">
                          Criar primeira casa
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <View className="gap-2">
                    {ownedHouses.map((house) => (
                      <TouchableOpacity
                        key={house.id}
                        onPress={() => setSelectedHouseId(house.id)}
                        className={`rounded-lg border p-4 ${
                          selectedHouseId === house.id
                            ? "border-emerald-600 bg-emerald-900/20"
                            : "border-zinc-700 bg-zinc-800"
                        }`}
                        disabled={isLoading}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <Text
                              className={`font-semibold ${
                                selectedHouseId === house.id ? "text-emerald-300" : "text-white"
                              }`}>
                              {house.name}
                            </Text>
                            {house.description && (
                              <Text className="mt-1 text-sm text-zinc-400">
                                {house.description}
                              </Text>
                            )}
                          </View>
                          {selectedHouseId === house.id && (
                            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="mt-2 text-xs text-zinc-500">
                    Escolha a casa para a qual deseja enviar o convite
                  </Text>
                </>
              )}
            </View>

            <View>
              <Text className="mb-2 text-sm font-medium text-white">Email do Usuário</Text>
              <TextInput
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-4 text-white"
                placeholder="usuario@exemplo.com"
                placeholderTextColor="#71717a"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <Text className="mt-1 text-xs text-zinc-500">
                O usuário receberá um convite para gerenciar a casa selecionada
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSendInvitation}
              disabled={isLoading || !selectedHouseId || ownedHouses.length === 0}
              className={`mt-6 items-center rounded-lg py-4 ${
                isLoading || !selectedHouseId || ownedHouses.length === 0
                  ? "bg-zinc-700"
                  : "bg-emerald-600"
              }`}
              style={{
                opacity: isLoading || !selectedHouseId || ownedHouses.length === 0 ? 0.7 : 1,
              }}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-semibold text-white">
                  {ownedHouses.length === 0
                    ? "Crie uma casa como proprietário"
                    : !selectedHouseId
                      ? "Selecione uma casa"
                      : "Enviar Convite"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* View Invitations Tab */}
        {activeTab === "view" && (
          <View className="space-y-6">
            {invitations.length === 0 ? (
              <View className="flex-1 items-center justify-center py-12">
                <Ionicons name="mail-open-outline" size={50} color="#a1a1aa" className="mb-4" />
                <Text className="mb-6 text-center text-lg text-zinc-400">
                  Você não tem nenhum convite.
                </Text>
              </View>
            ) : (
              <>
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
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isLoading}
          className="mt-6 items-center py-3">
          <Text className="text-base text-zinc-400">Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
