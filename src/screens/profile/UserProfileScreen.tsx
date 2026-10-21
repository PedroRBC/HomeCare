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
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import {
  AvatarPicker,
  AvatarDisplay,
  parseAvatarConfig,
  type AvatarConfig,
} from "@/components/AvatarPicker";
import { useTranslation } from "react-i18next";

interface UserProfileScreenProps {
  navigation: any;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
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
        title: t("common.error"),
        message: t("account.profile.nameRequired"),
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

    if (displayName.trim() === user?.displayName) {
      showAlert({
        title: t("account.profile.info"),
        message: t("account.profile.noChanges"),
        icon: "information-circle",
        iconColor: colors.info,
        buttons: [
          {
            text: t("common.ok"),
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
        title: t("account.profile.success"),
        message: t("account.profile.updated"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: t("common.error"),
        message: error.message || t("account.profile.updateError"),
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
      className="bg-app flex-1"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 }}>
        {/* Header */}
        <View className="mb-8 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            className="h-[48px] w-[48px] items-center justify-center">
            <Ionicons name="arrow-back" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text className="text-content font-heading mr-10 flex-1 text-center text-2xl">
            {t("account.profile.title")}
          </Text>
        </View>

        {/* Profile Icon Section */}
        <View className="mb-8 items-center">
          <TouchableOpacity onPress={handleChangeIcon} disabled={isSaving}>
            <AvatarDisplay config={avatarConfig} size={96} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleChangeIcon} className="mt-3" disabled={isSaving}>
            <Text className="text-accent font-subtitle text-sm">
              {t("account.profile.changeIcon")}
            </Text>
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
            <Text className="text-content font-subtitle mb-2 text-sm">
              {t("account.profile.displayName")}
            </Text>
            <TextInput
              className="border-divider bg-surface text-content rounded-lg border px-4 py-4"
              placeholder={t("account.profile.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              editable={!isSaving}
              maxLength={50}
            />
            <Text className="text-subtle mt-1 text-xs">{t("account.profile.nameHint")}</Text>
          </View>

          <View>
            <Text className="text-content font-subtitle mb-2 text-sm">
              {t("account.profile.email")}
            </Text>
            <View className="border-divider bg-surface rounded-lg border px-4 py-4">
              <Text className="text-muted">
                {user?.email || t("account.profile.emailUnavailable")}
              </Text>
            </View>
            <Text className="text-subtle mt-1 text-xs">{t("account.profile.emailHint")}</Text>
          </View>

          {/* Information Card */}
          <View className="bg-surface rounded-lg p-4">
            <View className="mb-3 flex-row items-center">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.accent}
                className="mr-2"
              />
              <Text className="text-content font-subtitle">{t("account.profile.aboutTitle")}</Text>
            </View>
            <Text className="text-muted text-sm leading-5">{t("account.profile.aboutText")}</Text>
          </View>

          {/* Manage Account Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate("AccountManagement")}
            disabled={isSaving}
            className="bg-primary items-center rounded-lg py-4">
            <Text className="text-on-primary font-subtitle text-base">
              {t("account.profile.manage")}
            </Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={isSaving || !displayName.trim()}
            className={`mt-6 items-center rounded-lg py-4 ${
              isSaving || !displayName.trim() ? "bg-disabled" : "bg-primary"
            }`}
            style={{ opacity: isSaving || !displayName.trim() ? 0.7 : 1 }}>
            {isSaving ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : (
              <Text
                className={`font-subtitle text-lg ${!displayName.trim() ? "text-muted" : "text-on-primary"}`}>
                {t("account.profile.save")}
              </Text>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={isSaving}
            className="items-center py-3">
            <Text className="text-muted text-base">{t("account.profile.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
