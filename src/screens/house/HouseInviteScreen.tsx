import { useAppTheme } from "@/theme";
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
import { useTranslation } from "react-i18next";
import { currentLocale } from "@/i18n/locale";

interface HouseInviteScreenProps {
  navigation: any;
}

export const HouseInviteScreen: React.FC<HouseInviteScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
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
        title: t("common.error"),
        message: t("houses.invite.invalidEmail"),
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

    if (!selectedHouseId) {
      showAlert({
        title: t("common.error"),
        message: t("houses.invite.selectHouseError"),
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

    if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
      showAlert({
        title: t("common.error"),
        message: t("houses.invite.selfInvite"),
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert({
        title: t("common.error"),
        message: t("houses.invite.invalidEmail"),
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

    const selectedHouse = ownedHouses.find((house) => house.id === selectedHouseId);
    if (!selectedHouse) {
      showAlert({
        title: t("common.error"),
        message: t("houses.invite.houseNotFound"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [
          {
            text: t("common.ok"),
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
        title: t("houses.invite.sentTitle"),
        message: t("houses.invite.sentMessage", { email: email.trim(), house: selectedHouse.name }),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
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
        title: t("common.error"),
        message: error.message || t("houses.invite.sendError"),
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

  const handleAcceptInvitation = async (invitation: HouseInvitation) => {
    setIsLoading(true);
    try {
      await acceptInvitation(invitation.id);
      showAlert({
        title: t("houses.invite.acceptedTitle"),
        message: t("houses.invite.acceptedMessage", { house: invitation.houseName }),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
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
        title: t("common.error"),
        message: error.message || t("houses.invite.acceptError"),
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

  const handleDeclineInvitation = async (invitation: HouseInvitation) => {
    showAlert({
      title: t("houses.invite.declineTitle"),
      message: t("houses.invite.declineMessage", { house: invitation.houseName }),
      icon: "warning",
      iconColor: colors.warning,
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("houses.invite.decline"),
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              await declineInvitation(invitation.id);
              showAlert({
                title: t("houses.invite.declinedTitle"),
                message: t("houses.invite.declinedMessage"),
                icon: "checkmark-circle",
                iconColor: colors.success,
                buttons: [
                  {
                    text: t("common.ok"),
                    style: "default",
                  },
                ],
              });
            } catch (error: any) {
              showAlert({
                title: t("common.error"),
                message: error.message || t("houses.invite.declineError"),
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
          },
        },
      ],
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(currentLocale(), {
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
        return colors.warning;
      case "accepted":
        return colors.success;
      case "declined":
        return colors.danger;
      case "expired":
        return colors.textMuted;
      default:
        return colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return t("houses.invite.statusPending");
      case "accepted":
        return t("houses.invite.statusAccepted");
      case "declined":
        return t("houses.invite.statusDeclined");
      case "expired":
        return t("houses.invite.statusExpired");
      default:
        return status;
    }
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");
  const otherInvitations = invitations.filter((inv) => inv.status !== "pending");

  return (
    <View
      className="bg-app flex-1"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
        <View className="mb-8 items-center">
          <Ionicons name="mail-outline" size={60} color={colors.accent} className="mb-4" />
          <Text className="text-content mb-2 text-3xl font-bold">{t("houses.invite.title")}</Text>
          <Text className="text-muted text-center">{t("houses.invite.subtitle")}</Text>
        </View>

        {/* Tab Navigation */}
        <View className="bg-surface mb-6 flex-row rounded-lg p-1">
          <TouchableOpacity
            onPress={() => setActiveTab("send")}
            className={`flex-1 items-center rounded-md py-3 ${activeTab === "send" ? "bg-primary" : ""}`}>
            <Text
              className={`font-semibold ${activeTab === "send" ? "text-on-primary" : "text-muted"}`}>
              {t("houses.invite.tabSend")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("view")}
            className={`flex-1 items-center rounded-md py-3 ${activeTab === "view" ? "bg-primary" : ""}`}>
            <Text
              className={`font-semibold ${activeTab === "view" ? "text-on-primary" : "text-muted"}`}>
              {t("houses.invite.tabView", { count: invitations.length })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Send Invite Tab */}
        {activeTab === "send" && (
          <View className="gap-3 space-y-6">
            <View>
              <Text className="text-content mb-2 text-sm font-medium">
                {t("houses.invite.selectHouse")}
              </Text>
              {ownedHouses.length === 0 ? (
                <View className="border-divider bg-surface rounded-lg border p-4">
                  <View className="flex-row items-center">
                    <Ionicons
                      name="home-outline"
                      size={24}
                      color={colors.textMuted}
                      className="mr-3"
                    />
                    <View className="flex-1">
                      <Text className="text-muted text-center">{t("houses.invite.noOwned")}</Text>
                      <Text className="text-subtle mt-1 text-center text-sm">
                        {t("houses.invite.onlyOwners")}
                      </Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate("CreateHouse")}
                        className="mt-2">
                        <Text className="text-accent text-center font-medium">
                          {t("houses.invite.createFirst")}
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
                            ? "border-primary bg-primary-soft"
                            : "border-divider bg-surface"
                        }`}
                        disabled={isLoading}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <Text
                              className={`font-semibold ${
                                selectedHouseId === house.id ? "text-accent" : "text-content"
                              }`}>
                              {house.name}
                            </Text>
                            {house.description && (
                              <Text className="text-muted mt-1 text-sm">{house.description}</Text>
                            )}
                          </View>
                          {selectedHouseId === house.id && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="text-subtle mt-2 text-xs">{t("houses.invite.chooseHint")}</Text>
                </>
              )}
            </View>

            <View>
              <Text className="text-content mb-2 text-sm font-medium">
                {t("houses.invite.userEmail")}
              </Text>
              <TextInput
                className="border-divider bg-surface text-content rounded-lg border px-4 py-4"
                placeholder={t("houses.invite.emailPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <Text className="text-subtle mt-1 text-xs">{t("houses.invite.emailHint")}</Text>
            </View>

            <TouchableOpacity
              onPress={handleSendInvitation}
              disabled={isLoading || !selectedHouseId || ownedHouses.length === 0}
              className={`mt-6 items-center rounded-lg py-4 ${
                isLoading || !selectedHouseId || ownedHouses.length === 0
                  ? "bg-disabled"
                  : "bg-primary"
              }`}
              style={{
                opacity: isLoading || !selectedHouseId || ownedHouses.length === 0 ? 0.7 : 1,
              }}>
              {isLoading ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text
                  className={`text-lg font-semibold ${!selectedHouseId || ownedHouses.length === 0 ? "text-muted" : "text-on-primary"}`}>
                  {ownedHouses.length === 0
                    ? t("houses.invite.submitNoHouse")
                    : !selectedHouseId
                      ? t("houses.invite.submitSelect")
                      : t("houses.invite.submit")}
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
                <Ionicons
                  name="mail-open-outline"
                  size={50}
                  color={colors.textSecondary}
                  className="mb-4"
                />
                <Text className="text-muted mb-6 text-center text-lg">
                  {t("houses.invite.none")}
                </Text>
              </View>
            ) : (
              <>
                {/* Pending Invitations */}
                {pendingInvitations.length > 0 && (
                  <View>
                    <Text className="text-content mb-4 text-lg font-semibold">
                      {t("houses.invite.pendingTitle", { count: pendingInvitations.length })}
                    </Text>
                    <View className="gap-3">
                      {pendingInvitations.map((invitation) => (
                        <View
                          key={invitation.id}
                          className="border-divider bg-surface rounded-lg border p-4">
                          <View className="mb-3 flex-row items-start justify-between">
                            <View className="flex-1">
                              <Text className="text-content text-lg font-semibold">
                                {invitation.houseName}
                              </Text>
                              <Text className="text-muted text-sm">
                                {t("houses.invite.invitedBy", { name: invitation.invitedByName })}
                              </Text>
                              <Text className="text-subtle mt-1 text-xs">
                                {t("houses.invite.sentAt", {
                                  date: formatDate(invitation.createdAt),
                                })}
                              </Text>
                            </View>
                            <View className="bg-warning-soft rounded-full px-3 py-1">
                              <Text className="text-warning text-xs font-medium">
                                {getStatusText(invitation.status)}
                              </Text>
                            </View>
                          </View>

                          <Text className="text-muted mb-4 text-sm">
                            {t("houses.invite.pendingRoleLine", {
                              role:
                                invitation.role === "owner"
                                  ? t("houses.invite.roleOwner")
                                  : t("houses.invite.roleManager"),
                            })}
                          </Text>

                          <View className="flex-row space-x-3">
                            <TouchableOpacity
                              onPress={() => handleAcceptInvitation(invitation)}
                              disabled={isLoading}
                              className="bg-primary flex-1 items-center rounded-lg py-3"
                              style={{ opacity: isLoading ? 0.7 : 1 }}>
                              <Text className="text-on-primary font-semibold">
                                {t("houses.invite.accept")}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeclineInvitation(invitation)}
                              disabled={isLoading}
                              className="bg-surface-raised flex-1 items-center rounded-lg py-3"
                              style={{ opacity: isLoading ? 0.7 : 1 }}>
                              <Text className="text-content font-semibold">
                                {t("houses.invite.decline")}
                              </Text>
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
                    <Text className="text-content mb-4 text-lg font-semibold">
                      {t("houses.invite.historyTitle", { count: otherInvitations.length })}
                    </Text>
                    <View className="space-y-3">
                      {otherInvitations.map((invitation) => (
                        <View
                          key={invitation.id}
                          className="border-divider bg-surface rounded-lg border p-4">
                          <View className="mb-3 flex-row items-start justify-between">
                            <View className="flex-1">
                              <Text className="text-content text-lg font-semibold">
                                {invitation.houseName}
                              </Text>
                              <Text className="text-muted text-sm">
                                {t("houses.invite.invitedBy", { name: invitation.invitedByName })}
                              </Text>
                              <Text className="text-subtle mt-1 text-xs">
                                {t("houses.invite.sentAt", {
                                  date: formatDate(invitation.createdAt),
                                })}
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

                          <Text className="text-muted text-sm">
                            {t("houses.invite.roleLine", {
                              role:
                                invitation.role === "owner"
                                  ? t("houses.invite.roleOwner")
                                  : t("houses.invite.roleManager"),
                            })}
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
          <Text className="text-muted text-base">{t("houses.invite.back")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
