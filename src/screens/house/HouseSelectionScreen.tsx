import { useAppTheme } from "@/theme";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHouse } from "@/context/HouseContext";
import { useCaregiver } from "@/context/CaregiverContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { useTranslation } from "react-i18next";

interface HouseSelectionScreenProps {
  navigation: any;
}

export const HouseSelectionScreen: React.FC<HouseSelectionScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const {
    userHouses,
    selectHouse,
    isLoading: housesLoading,
    invitations,
    houseAccessIssues,
    refreshHouses,
  } = useHouse();
  const { links: caregiverLinks, acceptedLinks, pendingLinks } = useCaregiver();
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
        title: t("common.error"),
        message: t("houses.select.selectError"),
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

  const handleCreateHouse = () => {
    navigation.navigate("CreateHouse");
  };

  const handleViewInvitations = () => {
    navigation.navigate("HouseInvite");
  };

  const handleEditHouse = (house: any) => {
    navigation.navigate("EditHouse", { house });
  };

  const caregiverLinkedHouses = new Set(acceptedLinks.map((l) => l.houseId)).size;
  const pendingCaregiverInvites = pendingLinks.length;
  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

  if (housesLoading) {
    return (
      <View
        className="bg-app flex-1 items-center justify-center"
        style={{
          paddingTop: topInset,
          paddingBottom: bottomInset,
        }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text className="text-content mt-4 text-lg">{t("houses.select.loading")}</Text>
      </View>
    );
  }

  return (
    <View
      className="bg-app flex-1"
      style={{
        paddingTop: topInset + 24,
        paddingBottom: bottomInset + 16,
        paddingHorizontal: 18,
      }}>
      <ScrollView className="flex-1 px-6 py-8">
        {/* Header */}
        <View className="mb-8 items-center">
          <View className="bg-primary mb-4 h-20 w-20 items-center justify-center rounded-full">
            <Ionicons name="home" size={40} color={colors.onPrimary} />
          </View>
          <Text className="text-content mb-2 text-2xl font-bold">{t("houses.select.title")}</Text>
          <Text className="text-muted text-center">{t("houses.select.subtitle")}</Text>
        </View>

        <EmailVerificationBanner />

        {houseAccessIssues.length > 0 && (
          <View
            testID="house-access-warning"
            className="border-warning bg-warning-soft mb-6 rounded-lg border p-4">
            <Text accessibilityRole="alert" className="text-warning">
              {t("houses.select.accessRepair", { count: houseAccessIssues.length })}
            </Text>
            <TouchableOpacity
              testID="house-access-retry"
              onPress={() => refreshHouses().catch(console.error)}
              className="bg-surface mt-3 self-start rounded-lg px-4 py-2">
              <Text className="text-content font-medium">{t("common.tryAgain")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Shortcut to her own schedule; new users may be caregivers waiting to be linked */}
        {(caregiverLinks.length > 0 || userHouses.length === 0) && (
          <TouchableOpacity
            onPress={() => navigation.navigate("MyShifts")}
            className="border-primary bg-primary-soft mb-6 flex-row items-center rounded-lg border p-4">
            <Ionicons name="calendar" size={24} color={colors.accent} />
            <View className="ml-3 flex-1">
              <Text className="text-content font-semibold">{t("caregiverView.title")}</Text>
              <Text className="text-accent text-sm">
                {pendingCaregiverInvites > 0
                  ? t("caregiverView.shortcutPending", { count: pendingCaregiverInvites })
                  : caregiverLinkedHouses > 0
                    ? t("caregiverView.shortcutHouses", { count: caregiverLinkedHouses })
                    : t("caregiverView.shortcutHint")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </TouchableOpacity>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <View className="mb-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-content text-lg font-semibold">
                {t("houses.select.pendingInvites", { count: pendingInvitations.length })}
              </Text>
              <TouchableOpacity
                onPress={handleViewInvitations}
                className="bg-primary rounded-lg px-3 py-1">
                <Text className="text-on-primary text-sm font-medium">
                  {t("houses.select.viewAll")}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-3">
              {pendingInvitations.slice(0, 2).map((invitation) => (
                <View
                  key={invitation.id}
                  className="border-warning bg-warning-soft rounded-lg border p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-content font-semibold">{invitation.houseName}</Text>
                      <Text className="text-warning text-sm">
                        {t("houses.select.invitedBy", { name: invitation.invitedByName })}
                      </Text>
                    </View>
                    <View className="bg-warning-soft rounded-full px-2 py-1">
                      <Text className="text-warning text-xs font-medium">
                        {t("houses.select.newShort")}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {pendingInvitations.length > 2 && (
              <TouchableOpacity
                onPress={handleViewInvitations}
                className="bg-surface mt-3 items-center rounded-lg py-3">
                <Text className="text-muted text-sm">
                  Ver mais {pendingInvitations.length - 2} convites
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Houses List */}
        <View className="mb-6">
          <Text className="text-content mb-4 text-lg font-semibold">
            {t("houses.select.yours")}
          </Text>

          {userHouses.length === 0 ? (
            <View className="bg-surface items-center rounded-lg p-6">
              <Ionicons name="home-outline" size={48} color={colors.textMuted} />
              <Text className="text-muted mt-4 mb-2 text-center">
                {t(houseAccessIssues.length ? "houses.select.unavailable" : "houses.select.none")}
              </Text>
              <Text className="text-subtle text-center text-sm">
                {t(
                  houseAccessIssues.length
                    ? "houses.select.unavailableHint"
                    : "houses.select.noneHint",
                )}
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {userHouses.map((house) => (
                <View key={house.id} className="border-divider bg-surface rounded-lg border">
                  <TouchableOpacity
                    onPress={() => handleSelectHouse(house.id)}
                    disabled={isLoading}
                    className="p-4 pb-2"
                    style={{ opacity: isLoading ? 0.7 : 1 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-content text-lg font-semibold">{house.name}</Text>
                        {house.description ? (
                          <Text className="text-muted mt-1 text-sm">{house.description}</Text>
                        ) : null}
                        <View className="mt-2 flex-row items-center">
                          <Ionicons name="people" size={16} color={colors.textMuted} />
                          <Text className="text-subtle ml-1 text-sm">
                            {t("houses.select.managersCount", { count: house.managers.length })}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>

                  {/* Edit Button */}
                  <View className="border-divider border-t py-2">
                    <TouchableOpacity
                      onPress={() => handleEditHouse(house)}
                      disabled={isLoading}
                      className="flex-row items-center justify-center py-2"
                      style={{ opacity: isLoading ? 0.7 : 1 }}>
                      <Ionicons name="create-outline" size={16} color={colors.accent} />
                      <Text className="text-accent ml-2 text-sm font-medium">
                        {t("houses.select.edit")}
                      </Text>
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
            className="bg-primary items-center rounded-lg py-4"
            style={{ opacity: isLoading ? 0.7 : 1 }}>
            <View className="flex-row items-center">
              <Ionicons name="add" size={20} color={colors.onPrimary} />
              <Text className="text-on-primary ml-2 text-lg font-semibold">
                {t("houses.select.create")}
              </Text>
            </View>
          </TouchableOpacity>

          {pendingInvitations.length > 0 && (
            <TouchableOpacity
              onPress={handleViewInvitations}
              disabled={isLoading}
              className="bg-surface-raised items-center rounded-lg py-4"
              style={{ opacity: isLoading ? 0.7 : 1 }}>
              <View className="flex-row items-center">
                <Ionicons name="mail" size={20} color={colors.text} />
                <Text className="text-content ml-2 text-lg font-semibold">
                  {t("houses.select.viewInvites", { count: pendingInvitations.length })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Help Text */}
        <View className="bg-surface mt-8 rounded-lg p-4">
          <Text className="text-muted text-center text-sm">{t("houses.select.tip")}</Text>
        </View>
      </ScrollView>
    </View>
  );
};
