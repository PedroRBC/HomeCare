import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeApplicationVersion as AppVersion } from "expo-application";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";
import { AppLogo } from "@/components/AppLogo";

interface AboutScreenProps {
  navigation: any;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { top: topInset } = useSafeAreaInsets();

  return (
    <View className="bg-app flex-1">
      {/* Header */}
      <View
        className="border-divider bg-surface flex-row items-center justify-between border-b px-4 py-3"
        style={{ paddingTop: topInset }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text className="text-content ml-2 text-lg font-semibold">
            {t("account.about.title")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}>
        {/* App Info */}
        <View className="mb-8">
          <View className="mb-6 items-center">
            <AppLogo size={48} className="mb-4" />
            <Text className="text-muted">Versão {AppVersion}</Text>
          </View>

          <Text className="text-muted mb-6 text-base leading-6">
            {t("account.about.description")}
          </Text>
        </View>

        {/* Features */}
        <View className="mb-8">
          <Text className="text-content mb-4 text-lg font-semibold">
            {t("account.about.featuresTitle")}
          </Text>

          <View className="space-y-4">
            <View className="flex-row items-start">
              <View className="bg-primary-soft mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full">
                <Ionicons name="calendar" size={14} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-content font-medium">{t("account.about.calendar")}</Text>
                <Text className="text-muted text-sm">{t("account.about.calendarHint")}</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="bg-primary-soft mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full">
                <Ionicons name="people" size={14} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-content font-medium">{t("account.about.caregivers")}</Text>
                <Text className="text-muted text-sm">{t("account.about.caregiversHint")}</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="bg-primary-soft mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full">
                <Ionicons name="card" size={14} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-content font-medium">{t("account.about.finance")}</Text>
                <Text className="text-muted text-sm">{t("account.about.financeHint")}</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="bg-primary-soft mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full">
                <Ionicons name="notifications" size={14} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-content font-medium">{t("account.about.reminders")}</Text>
                <Text className="text-muted text-sm">{t("account.about.remindersHint")}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Technology Stack */}
        <View className="mb-8">
          <Text className="text-content mb-4 text-lg font-semibold">
            {t("account.about.technologies")}
          </Text>

          <View className="flex-row flex-wrap gap-2">
            <View className="bg-surface rounded-lg px-3 py-2">
              <Text className="text-accent text-sm font-medium">React Native</Text>
            </View>
            <View className="bg-surface rounded-lg px-3 py-2">
              <Text className="text-accent text-sm font-medium">Expo</Text>
            </View>
            <View className="bg-surface rounded-lg px-3 py-2">
              <Text className="text-accent text-sm font-medium">Firebase</Text>
            </View>
            <View className="bg-surface rounded-lg px-3 py-2">
              <Text className="text-accent text-sm font-medium">TypeScript</Text>
            </View>
            <View className="bg-surface rounded-lg px-3 py-2">
              <Text className="text-accent text-sm font-medium">Tailwind CSS</Text>
            </View>
          </View>
        </View>

        {/* Footer branding */}
        <View className="items-center py-6">
          <View className="mb-4 h-32 w-full items-center justify-center">
            <AppLogo size={80} showWordmark={false} />
          </View>

          <Text className="text-subtle mb-2 text-center text-sm">{t("account.about.footer")}</Text>
          <Text className="text-subtle text-center text-xs">
            HomeCare v{AppVersion} • React Native & Expo
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
