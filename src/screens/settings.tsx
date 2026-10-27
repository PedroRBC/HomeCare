import { ScreenHeading } from "@/components/ScreenHeading";
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
import { palettes, THEME_NAMES, themeLabels, useAppTheme, type ThemePreference } from "@/theme";

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  useScreenTracking("Settings", "SettingsScreen");

  const { t } = useTranslation();
  const { preference, setPreference } = useLanguage();
  const {
    colors,
    scheme,
    preference: themePreference,
    setPreference: setThemePreference,
    theme,
    setTheme,
  } = useAppTheme();
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
            iconColor: colors.warning,
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
        iconColor: colors.danger,
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
      iconColor: colors.warning,
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

  const appearanceOptions: { value: ThemePreference; label: string; hint?: string }[] = [
    { value: "light", label: t("settings.appearance.light") },
    { value: "dark", label: t("settings.appearance.dark") },
    {
      value: "system",
      label: t("settings.appearance.system"),
      hint: t("settings.appearance.systemHint"),
    },
  ];

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
      iconColor: colors.warning,
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
                iconColor: colors.danger,
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
      className="bg-surface mb-3 flex-row items-center justify-between rounded-lg px-4 py-4"
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
      })}>
      <View className="flex-1 flex-row items-center">
        <View
          className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${danger ? "bg-danger-soft" : "bg-surface-raised"}`}>
          <Ionicons
            name={icon as any}
            size={20}
            color={danger ? colors.danger : colors.textSecondary}
          />
        </View>
        <View className="flex-1">
          <Text className={`font-subtitle ${danger ? "text-danger" : "text-content"}`}>
            {title}
          </Text>
          {subtitle && <Text className="text-muted mt-1 text-sm">{subtitle}</Text>}
        </View>
      </View>
      {rightComponent}
    </Pressable>
  );

  return (
    <View className="bg-app flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: topInset + 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-8">
          <ScreenHeading title={t("settings.title")} subtitle={t("settings.subtitle")} />
        </View>

        <View className="gap-6">
          {/* User Information */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">{t("settings.account")}</Text>

            <Card variant="elevated">
              <View className="gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                    <Text className="font-subtitle text-content">{t("settings.name")}</Text>
                  </View>
                  <Text className="text-content">
                    {user?.displayName || t("common.notDefined")}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                    <Text className="font-subtitle text-content">{t("settings.email")}</Text>
                  </View>
                  <Text className="text-content">{user?.email || t("common.notDefined")}</Text>
                </View>

                <SettingItem
                  icon="person-outline"
                  title={t("settings.editProfile")}
                  subtitle={t("settings.editProfileHint")}
                  onPress={() => navigation.navigate("UserProfile")}
                  rightComponent={
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  }
                />

                <SettingItem
                  icon="log-out-outline"
                  title={t("settings.logout")}
                  subtitle={t("settings.logoutHint")}
                  onPress={handleLogout}
                  danger
                  rightComponent={
                    <Ionicons name="chevron-forward" size={20} color={colors.danger} />
                  }
                />
              </View>
            </Card>
          </View>

          {/* App Information */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">{t("settings.appInfo")}</Text>

            <Card variant="elevated">
              <View className="gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text className="font-subtitle text-content">{t("settings.version")}</Text>
                  </View>
                  <Text className="text-content">{AppVersion}</Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="cloud-outline" size={20} color={colors.textSecondary} />
                    <Text className="font-subtitle text-content">Firebase</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`h-2 w-2 rounded-full ${isFirestoreConnected ? "bg-success" : "bg-danger"}`}
                    />
                    <Text className="text-content">
                      {isFirestoreConnected ? t("settings.connected") : t("settings.disconnected")}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>

          {/* Language */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">
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
                      className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${selected ? "bg-primary-soft" : "bg-surface"}`}>
                      <View className="flex-1">
                        <Text className="font-subtitle text-content">{option.label}</Text>
                        {option.hint && (
                          <Text className="text-muted mt-1 text-sm">{option.hint}</Text>
                        )}
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>

          {/* Appearance */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">
              {t("settings.appearance.title")}
            </Text>

            <Card variant="elevated">
              <View
                testID="appearance-options"
                accessibilityRole="radiogroup"
                accessibilityLabel={t("settings.appearance.title")}
                className="gap-2">
                {appearanceOptions.map((option) => {
                  const selected = themePreference === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      testID={`appearance-${option.value}`}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected, checked: selected }}
                      onPress={() => setThemePreference(option.value)}
                      className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${selected ? "bg-primary-soft" : "bg-surface"}`}>
                      <View className="flex-1">
                        <Text className="font-subtitle text-content">{option.label}</Text>
                        {option.hint && (
                          <Text className="text-muted mt-1 text-sm">{option.hint}</Text>
                        )}
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>

          {/* Theme */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">
              {t("settings.appearance.theme")}
            </Text>

            <Card variant="elevated">
              <View
                testID="theme-options"
                accessibilityRole="radiogroup"
                accessibilityLabel={t("settings.appearance.theme")}
                className="gap-2">
                {THEME_NAMES.map((name) => {
                  const selected = theme === name;
                  const preview = palettes[name][scheme];
                  return (
                    <Pressable
                      key={name}
                      testID={`theme-${name}`}
                      accessibilityRole="radio"
                      accessibilityLabel={themeLabels[name]}
                      accessibilityState={{ selected, checked: selected }}
                      onPress={() => setTheme(name)}
                      className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${selected ? "bg-primary-soft" : "bg-surface"}`}>
                      <View className="flex-1 flex-row items-center gap-3">
                        <View
                          className="border-divider flex-row overflow-hidden rounded-full border"
                          importantForAccessibility="no-hide-descendants">
                          {[preview.background, preview.primary, preview.accent].map(
                            (color, index) => (
                              <View
                                key={index}
                                style={{ backgroundColor: color, width: 12, height: 24 }}
                              />
                            ),
                          )}
                        </View>
                        <Text className="font-subtitle text-content">{themeLabels[name]}</Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>

          {/* Notifications */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">
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
                    trackColor={{ false: colors.disabled, true: colors.primary }}
                    thumbColor={notificationsEnabled ? "#FFFFFF" : colors.textSecondary}
                    ios_backgroundColor={colors.disabled}
                  />
                }
              />
            </Card>
          </View>

          {/* Account Management */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">
              {t("settings.accountManagement")}
            </Text>

            <Card variant="elevated">
              <SettingItem
                icon="person-remove-outline"
                title={t("settings.deleteAccount")}
                subtitle={t("settings.deleteAccountHint")}
                onPress={handleDeleteAccount}
                danger
                rightComponent={<Ionicons name="chevron-forward" size={20} color={colors.danger} />}
              />
            </Card>
          </View>

          {/* Support */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">{t("settings.support")}</Text>

            <Card variant="elevated">
              <SettingItem
                icon="chatbox-ellipses-outline"
                title={t("settings.feedback")}
                subtitle={t("settings.feedbackHint")}
                onPress={() => navigation.navigate("Feedback")}
                rightComponent={
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                }
              />
            </Card>
          </View>

          {/* Privacy & Legal */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">
              {t("settings.privacyLegal")}
            </Text>

            <Card variant="elevated">
              <SettingItem
                icon="shield-checkmark-outline"
                title={t("privacy.center.title")}
                subtitle={t("privacy.center.menuHint")}
                onPress={() => navigation.navigate("PrivacyCenter")}
                rightComponent={
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                }
              />
              <SettingItem
                icon="shield-outline"
                title={t("settings.privacyPolicy")}
                subtitle={t("settings.privacyPolicyHint")}
                onPress={() => navigation.navigate("PrivacyPolicy")}
                rightComponent={
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                }
              />
            </Card>
          </View>

          {/* About */}
          <View>
            <Text className="font-heading text-content mb-4 text-lg">{t("settings.about")}</Text>

            <Card variant="elevated">
              <SettingItem
                icon="information-circle-outline"
                title={t("settings.aboutApp")}
                subtitle={t("settings.aboutAppHint")}
                onPress={showAbout}
                rightComponent={
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                }
              />
            </Card>
          </View>

          {/* Footer */}
          <View className="items-center py-8">
            <Text className="text-subtle text-center text-xs">
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
