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
import { AppHeader } from "@/components/AppHeader";
import { ScreenHeading } from "@/components/ScreenHeading";
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
  const { bottom: bottomInset } = useSafeAreaInsets();

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
      <View className="bg-app flex-1" style={{ paddingBottom: bottomInset }}>
        <AppHeader role="manager" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text className="text-content mt-4 text-lg">{t("houses.select.loading")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-app flex-1" style={{ paddingBottom: bottomInset }}>
      <AppHeader role="manager" />
      <ScrollView className="flex-1">
        <View className="gap-6 px-5 pt-6 pb-8">
          <ScreenHeading title={t("houses.select.title")} subtitle={t("houses.select.subtitle")} />

          <EmailVerificationBanner />

          {houseAccessIssues.length > 0 && (
            <View
              testID="house-access-warning"
              className="border-warning bg-warning-soft rounded-[20px] border p-[18px]">
              <Text accessibilityRole="alert" className="text-warning text-[13px] leading-5">
                {t("houses.select.accessRepair", { count: houseAccessIssues.length })}
              </Text>
              <TouchableOpacity
                testID="house-access-retry"
                onPress={() => refreshHouses().catch(console.error)}
                className="bg-surface mt-3 self-start rounded-xl px-4 py-2">
                <Text className="text-content font-subtitle text-[13px]">
                  {t("common.tryAgain")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Shortcut to her own schedule; new users may be caregivers waiting to be linked */}
          {(caregiverLinks.length > 0 || userHouses.length === 0) && (
            <TouchableOpacity
              onPress={() => navigation.navigate("MyShifts")}
              className="border-divider bg-surface flex-row items-center gap-3 rounded-[20px] border p-[18px]">
              <View className="bg-primary-soft h-12 w-[42px] items-center justify-center rounded-xl">
                <Ionicons name="calendar" size={23} color={colors.accent} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-content font-subtitle text-[15px]">
                  {t("caregiverView.title")}
                </Text>
                <Text className="text-accent text-xs">
                  {pendingCaregiverInvites > 0
                    ? t("caregiverView.shortcutPending", { count: pendingCaregiverInvites })
                    : caregiverLinkedHouses > 0
                      ? t("caregiverView.shortcutHouses", { count: caregiverLinkedHouses })
                      : t("caregiverView.shortcutHint")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-content font-subtitle text-base">
                  {t("houses.select.pendingInvites", { count: pendingInvitations.length })}
                </Text>
                <TouchableOpacity
                  onPress={handleViewInvitations}
                  className="bg-primary rounded-lg px-3 py-1">
                  <Text className="text-on-primary font-subtitle text-sm">
                    {t("houses.select.viewAll")}
                  </Text>
                </TouchableOpacity>
              </View>

              {pendingInvitations.slice(0, 2).map((invitation) => (
                <View
                  key={invitation.id}
                  className="border-warning bg-warning-soft flex-row items-center justify-between rounded-[20px] border p-[18px]">
                  <View className="flex-1 gap-1">
                    <Text className="text-content font-subtitle">{invitation.houseName}</Text>
                    <Text className="text-warning text-sm">
                      {t("houses.select.invitedBy", { name: invitation.invitedByName })}
                    </Text>
                  </View>
                  <View className="bg-surface rounded-full px-2 py-1">
                    <Text className="text-warning font-subtitle text-xs">
                      {t("houses.select.newShort")}
                    </Text>
                  </View>
                </View>
              ))}

              {pendingInvitations.length > 2 && (
                <TouchableOpacity
                  onPress={handleViewInvitations}
                  className="bg-surface border-divider items-center rounded-xl border py-3">
                  <Text className="text-muted text-sm">
                    Ver mais {pendingInvitations.length - 2} convites
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Houses List */}
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-content font-subtitle text-base">
                {t("houses.select.yours")}
              </Text>
              <View className="bg-primary-soft rounded-full px-2.5 py-[5px]">
                <Text className="text-accent font-subtitle text-[11px]">
                  {t("houses.count", { count: userHouses.length })}
                </Text>
              </View>
            </View>

            {userHouses.length === 0 ? (
              <View className="bg-surface border-divider items-center gap-2 rounded-[20px] border p-6">
                <Ionicons name="home-outline" size={48} color={colors.textMuted} />
                <Text className="text-content font-subtitle text-center">
                  {t(houseAccessIssues.length ? "houses.select.unavailable" : "houses.select.none")}
                </Text>
                <Text className="text-muted text-center text-sm">
                  {t(
                    houseAccessIssues.length
                      ? "houses.select.unavailableHint"
                      : "houses.select.noneHint",
                  )}
                </Text>
              </View>
            ) : (
              <View className="gap-3.5">
                {userHouses.map((house) => (
                  <View
                    key={house.id}
                    className="bg-surface border-divider overflow-hidden rounded-[20px] border">
                    <TouchableOpacity
                      onPress={() => handleSelectHouse(house.id)}
                      disabled={isLoading}
                      className="flex-row items-center gap-3 p-[18px]"
                      style={{ opacity: isLoading ? 0.7 : 1 }}>
                      <View className="bg-primary-soft h-12 w-[42px] items-center justify-center rounded-xl">
                        <Ionicons name="home-outline" size={23} color={colors.accent} />
                      </View>
                      <View className="flex-1 gap-2">
                        <Text className="text-content font-subtitle text-[17px]">{house.name}</Text>
                        {house.description ? (
                          <Text className="text-muted text-xs">{house.description}</Text>
                        ) : null}
                        <View className="flex-row items-center gap-[5px]">
                          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                          <Text className="text-muted text-xs">
                            {t("houses.select.managersCount", { count: house.managers.length })}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                    </TouchableOpacity>

                    <View className="bg-divider h-px" />

                    {/* Edit Button */}
                    <TouchableOpacity
                      onPress={() => handleEditHouse(house)}
                      disabled={isLoading}
                      className="h-12 flex-row items-center justify-center gap-[7px]"
                      style={{ opacity: isLoading ? 0.7 : 1 }}>
                      <Ionicons name="create-outline" size={16} color={colors.accent} />
                      <Text className="text-accent font-subtitle text-[13px]">
                        {t("houses.select.edit")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <TouchableOpacity
              onPress={handleCreateHouse}
              disabled={isLoading}
              className="bg-primary h-[52px] flex-row items-center justify-center gap-2 rounded-xl"
              style={{ opacity: isLoading ? 0.7 : 1 }}>
              <Ionicons name="add" size={20} color={colors.onPrimary} />
              <Text className="text-on-primary font-subtitle text-sm">
                {t("houses.select.create")}
              </Text>
            </TouchableOpacity>

            {pendingInvitations.length > 0 && (
              <TouchableOpacity
                onPress={handleViewInvitations}
                disabled={isLoading}
                className="bg-surface border-divider h-[52px] flex-row items-center justify-center gap-2 rounded-xl border"
                style={{ opacity: isLoading ? 0.7 : 1 }}>
                <Ionicons name="mail" size={20} color={colors.accent} />
                <Text className="text-content font-subtitle text-sm">
                  {t("houses.select.viewInvites", { count: pendingInvitations.length })}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tip */}
          <View className="bg-primary-soft flex-row items-start gap-3 rounded-[20px] p-[18px]">
            <Ionicons name="bulb-outline" size={20} color={colors.accent} />
            <View className="flex-1 gap-1.5">
              <Text className="text-accent font-subtitle text-[13px]">{t("houses.tipTitle")}</Text>
              <Text className="text-content text-[13px] leading-5">{t("houses.tipBody")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
