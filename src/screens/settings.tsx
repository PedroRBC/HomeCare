import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useSchedule } from "@/context/ScheduleContext";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { NotificationService } from "@/services/notificationService";
import { Card } from "@/components/Card";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApplicationVersion as AppVersion } from "expo-application";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/useLanguage";
import { detectDeviceLanguage, SUPPORTED_LANGUAGES, type LanguagePreference } from "@/i18n";

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  useScreenTracking("Settings", "SettingsScreen");

  const { t } = useTranslation();
  const { preference, setPreference } = useLanguage();
  const { isFirestoreConnected } = useSchedule();
  const { user, signOut } = useAuth();
  const { showAlert } = useAlert();
  const { top: topInset } = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Check notification permission status
  React.useEffect(() => {
    const checkNotificationStatus = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationsEnabled(status === "granted");
      } catch (error) {
        console.error("Error checking notification status:", error);
      }
    };
    checkNotificationStatus();
  }, []);

  const toggleNotifications = async () => {
    try {
      if (notificationsEnabled) {
        // Disable notifications
        await Notifications.cancelAllScheduledNotificationsAsync();
        setNotificationsEnabled(false);
      } else {
        // Enable notifications
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          await NotificationService.initialize();
          setNotificationsEnabled(true);
        } else {
          showAlert({
            title: t("settings.permissionDenied"),
            message: t("settings.permissionDeniedMessage"),
            icon: "warning",
            iconColor: "#f59e0b",
            buttons: [
              {
                text: t("common.ok"),
                style: "default",
              },
            ],
          });
        }
      }
    } catch (error) {
      console.error("Error toggling notifications:", error);
      showAlert({
        title: t("common.error"),
        message: t("settings.notificationsError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    }
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: t("settings.deleteAccount"),
      message: t("settings.deleteAccountWarning"),
      icon: "warning",
      iconColor: "#f59e0b",
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          style: "destructive",
          onPress: () => {
            navigation.navigate("DeleteAccount");
          },
        },
      ],
    });
  };

  const languageOptions: { value: LanguagePreference; label: string; hint?: string }[] = [
    {
      value: "system",
      label: t("settings.language.system"),
      hint: t("settings.language.systemHint", {
        language: t(`settings.language.names.${detectDeviceLanguage()}`),
      }),
    },
    ...SUPPORTED_LANGUAGES.map((value) => ({
      value,
      label: t(`settings.language.names.${value}`),
    })),
  ];

  const handleLogout = () => {
    showAlert({
      title: t("settings.logout"),
      message: t("settings.logoutConfirm"),
      icon: "log-out",
      iconColor: "#f59e0b",
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.logout"),
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error("Error signing out:", error);
              showAlert({
                title: t("common.error"),
                message: t("settings.logoutError"),
                icon: "alert-circle",
                iconColor: "#ef4444",
                buttons: [
                  {
                    text: t("common.ok"),
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

  const showAbout = () => {
    navigation.navigate("About");
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightComponent,
    danger = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center justify-between rounded-lg bg-zinc-800 px-4 py-4"
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
      })}>
      <View className="flex-1 flex-row items-center">
        <View
          className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${danger ? "bg-red-900/40" : "bg-zinc-700"}`}>
          <Ionicons name={icon as any} size={20} color={danger ? "#EF4444" : "#9CA3AF"} />
        </View>
        <View className="flex-1">
          <Text className={`font-subtitle ${danger ? "text-red-400" : "text-zinc-200"}`}>
            {title}
          </Text>
          {subtitle && <Text className="mt-1 text-sm text-zinc-400">{subtitle}</Text>}
        </View>
      </View>
      {rightComponent}
    </Pressable>
  );

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingTop: topInset + 16 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-8">
          <Text className="font-heading mb-2 text-2xl text-zinc-50">{t("settings.title")}</Text>
          <Text className="text-zinc-400">{t("settings.subtitle")}</Text>
        </View>

        <View className="gap-6">
          {/* User Information */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">{t("settings.account")}</Text>

            <Card variant="elevated">
              <View className="gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                    <Text className="font-subtitle text-zinc-200">{t("settings.name")}</Text>
                  </View>
                  <Text className="text-zinc-300">
                    {user?.displayName || t("common.notDefined")}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                    <Text className="font-subtitle text-zinc-200">{t("settings.email")}</Text>
                  </View>
                  <Text className="text-zinc-300">{user?.email || t("common.notDefined")}</Text>
                </View>

                <SettingItem
                  icon="person-outline"
                  title={t("settings.editProfile")}
                  subtitle={t("settings.editProfileHint")}
                  onPress={() => navigation.navigate("UserProfile")}
                  rightComponent={<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
                />

                <SettingItem
                  icon="log-out-outline"
                  title={t("settings.logout")}
                  subtitle={t("settings.logoutHint")}
                  onPress={handleLogout}
                  danger
                  rightComponent={<Ionicons name="chevron-forward" size={20} color="#EF4444" />}
                />
              </View>
            </Card>
          </View>

          {/* App Information */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">{t("settings.appInfo")}</Text>

            <Card variant="elevated">
              <View className="gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
                    <Text className="font-subtitle text-zinc-200">{t("settings.version")}</Text>
                  </View>
                  <Text className="text-zinc-300">{AppVersion}</Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="cloud-outline" size={20} color="#9CA3AF" />
                    <Text className="font-subtitle text-zinc-200">Firebase</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`h-2 w-2 rounded-full ${isFirestoreConnected ? "bg-emerald-400" : "bg-red-400"}`}
                    />
                    <Text className="text-zinc-300">
                      {isFirestoreConnected ? t("settings.connected") : t("settings.disconnected")}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>

          {/* Language */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">
              {t("settings.language.title")}
            </Text>

            <Card variant="elevated">
              <View testID="language-options" className="gap-2">
                {languageOptions.map((option) => {
                  const selected = preference === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      testID={`language-${option.value}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setPreference(option.value)}
                      className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${selected ? "bg-emerald-900/40" : "bg-zinc-800"}`}>
                      <View className="flex-1">
                        <Text className="font-subtitle text-zinc-200">{option.label}</Text>
                        {option.hint && (
                          <Text className="mt-1 text-sm text-zinc-400">{option.hint}</Text>
                        )}
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={22} color="#10B981" />}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>

          {/* Notifications */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">
              {t("settings.notifications")}
            </Text>

            <Card variant="elevated">
              <SettingItem
                icon="notifications-outline"
                title={t("settings.paymentReminders")}
                subtitle={t("settings.paymentRemindersHint")}
                rightComponent={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: "#3F3F46", true: "#059669" }}
                    thumbColor={notificationsEnabled ? "#FFFFFF" : "#9CA3AF"}
                  />
                }
              />
            </Card>
          </View>

          {/* Account Management */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">
              {t("settings.accountManagement")}
            </Text>

            <Card variant="elevated">
              <SettingItem
                icon="person-remove-outline"
                title={t("settings.deleteAccount")}
                subtitle={t("settings.deleteAccountHint")}
                onPress={handleDeleteAccount}
                danger
                rightComponent={<Ionicons name="chevron-forward" size={20} color="#EF4444" />}
              />
            </Card>
          </View>

          {/* Privacy & Legal */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">
              {t("settings.privacyLegal")}
            </Text>

            <Card variant="elevated">
              <SettingItem
                icon="shield-outline"
                title={t("settings.privacyPolicy")}
                subtitle={t("settings.privacyPolicyHint")}
                onPress={() => navigation.navigate("PrivacyPolicy")}
                rightComponent={<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
              />
            </Card>
          </View>

          {/* About */}
          <View>
            <Text className="font-heading mb-4 text-lg text-zinc-200">{t("settings.about")}</Text>

            <Card variant="elevated">
              <SettingItem
                icon="information-circle-outline"
                title={t("settings.aboutApp")}
                subtitle={t("settings.aboutAppHint")}
                onPress={showAbout}
                rightComponent={<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
              />
            </Card>
          </View>

          {/* Footer */}
          <View className="items-center py-8">
            <Text className="text-center text-xs text-zinc-500">
              HomeCare v{AppVersion}
              {"\n"}
              {t("settings.footer")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
