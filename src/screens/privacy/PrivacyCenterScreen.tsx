import { useAppTheme } from "@/theme";
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { FirestoreService } from "@/services/firestore";
import { exportPersonalData } from "@/services/exportService";
import { Card } from "@/components/Card";
import { ConsentToggle } from "@/screens/privacy/ConsentScreen";
import { summarizeDataExport } from "@/utils/dataExport";
import { telemetryConsents, telemetryPreferences } from "@/utils/privacy";
import { currentLocale } from "@/i18n/locale";

interface PrivacyCenterScreenProps {
  navigation: any;
}

const DATA_PROTECTION = [
  "privacy.center.protectionEncryption",
  "privacy.center.protectionKeys",
  "privacy.center.protectionTls",
  "privacy.center.protectionDeletion",
  "privacy.center.protectionSupport",
  "privacy.center.socialLogin",
] as const;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(currentLocale()) : "—";

/**
 * Where users exercise their LGPD rights (art. 18): review and revoke consent,
 * export their data, correct it and delete it. Also reachable before accepting
 * the policies, where only the routes of the consent stack exist.
 */
export const PrivacyCenterScreen: React.FC<PrivacyCenterScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  useScreenTracking("PrivacyCenter", "PrivacyCenterScreen");

  const { t } = useTranslation();
  const { user, updateConsents, refreshEmailVerification } = useAuth();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const [isExporting, setIsExporting] = useState(false);
  // One consent change at a time
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const preferences = telemetryPreferences(user?.consents);
  const canEditProfile = navigation.getState?.()?.routeNames?.includes("UserProfile") ?? false;

  const showError = (message: string) =>
    showAlert({
      title: t("common.error"),
      message,
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });

  const changePreference = async (change: Partial<typeof preferences>) => {
    try {
      setIsSavingConsent(true);
      const changed = telemetryConsents({ ...preferences, ...change });
      await updateConsents(
        "analytics" in change
          ? { analytics: changed.analytics }
          : { crashReports: changed.crashReports },
      );
    } catch (error) {
      console.error("Error updating consent:", error);
      showError(t("privacy.center.consentError"));
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      setIsExporting(true);
      const emailVerified = await refreshEmailVerification();
      const data = await FirestoreService.exportUserData(user.uid, user.email, emailVerified);
      await exportPersonalData(data);
      const summary = summarizeDataExport(data);
      const partial = data.complete === false;
      showAlert({
        title: t(partial ? "privacy.center.partialExportTitle" : "privacy.center.exportedTitle"),
        message: partial
          ? t("privacy.center.partialExportMessage", { count: data.unavailableHouses?.length ?? 0 })
          : t("privacy.center.exportedMessage", summary),
        icon: partial ? "alert-circle" : "checkmark-circle",
        iconColor: partial ? colors.warning : colors.accent,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } catch (error) {
      console.error("Error exporting personal data:", error);
      showError(t("privacy.center.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  const contactDataProtectionOfficer = () =>
    Linking.openURL(
      `mailto:contato@pedrorbc.com?subject=${encodeURIComponent(t("privacy.center.dpoSubject"))}`,
    );

  return (
    <View className="bg-app flex-1">
      <View
        className="border-divider bg-surface flex-row items-center border-b px-4 py-3"
        style={{ paddingTop: topInset + 12 }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text className="text-content ml-2 text-lg font-semibold">
            {t("privacy.center.title")}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 32 }}>
        <View className="gap-6">
          <View>
            <Text className="font-heading text-content mb-3 text-lg">
              {t("privacy.center.protectionTitle")}
            </Text>
            <Card variant="elevated">
              <View className="gap-3">
                {DATA_PROTECTION.map((key) => (
                  <View key={key} className="flex-row items-start gap-3">
                    <Ionicons name="lock-closed" size={16} color={colors.accent} />
                    <Text className="text-muted flex-1 text-sm leading-5">{t(key)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          <View>
            <Text className="font-heading text-content mb-3 text-lg">
              {t("privacy.center.consentsTitle")}
            </Text>
            <View className="gap-3">
              <Card variant="elevated">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
                  <View className="flex-1">
                    <Text className="text-content font-medium">{t("privacy.center.policies")}</Text>
                    <Text className="text-muted mt-1 text-xs">
                      {t("privacy.center.acceptedOn", {
                        date: formatDate(user?.consents?.privacyPolicy?.acceptedAt),
                        version: user?.consents?.privacyPolicy?.version ?? "—",
                      })}
                    </Text>
                  </View>
                </View>
              </Card>
              <ConsentToggle
                testID="privacy-analytics"
                icon="stats-chart-outline"
                title={t("privacy.telemetry.analyticsTitle")}
                description={t("privacy.telemetry.analyticsDescription")}
                value={preferences.analytics}
                disabled={isSavingConsent}
                onChange={(analytics) => changePreference({ analytics })}
              />
              <ConsentToggle
                testID="privacy-crash-reports"
                icon="bug-outline"
                title={t("privacy.telemetry.crashTitle")}
                description={t("privacy.telemetry.crashDescription")}
                value={preferences.crashReports}
                disabled={isSavingConsent}
                onChange={(crashReports) => changePreference({ crashReports })}
              />
            </View>
          </View>

          <View>
            <Text className="font-heading text-content mb-3 text-lg">
              {t("privacy.center.rightsTitle")}
            </Text>
            <Card variant="elevated">
              <View className="gap-1">
                <RightItem
                  testID="privacy-export"
                  icon="download-outline"
                  title={t("privacy.center.export")}
                  subtitle={t("privacy.center.exportHint")}
                  onPress={handleExport}
                  loading={isExporting}
                />
                {canEditProfile && (
                  <RightItem
                    icon="create-outline"
                    title={t("privacy.center.correct")}
                    subtitle={t("privacy.center.correctHint")}
                    onPress={() => navigation.navigate("UserProfile")}
                  />
                )}
                <RightItem
                  icon="shield-outline"
                  title={t("privacy.consent.privacy")}
                  subtitle={t("privacy.center.privacyPolicyHint")}
                  onPress={() => navigation.navigate("PrivacyPolicy")}
                />
                <RightItem
                  icon="document-outline"
                  title={t("privacy.consent.terms")}
                  onPress={() => navigation.navigate("TermsOfService")}
                />
                <RightItem
                  icon="mail-outline"
                  title={t("privacy.center.dpo")}
                  subtitle="contato@pedrorbc.com"
                  onPress={contactDataProtectionOfficer}
                />
                <RightItem
                  testID="privacy-delete"
                  icon="person-remove-outline"
                  title={t("privacy.center.delete")}
                  subtitle={t("privacy.center.deleteHint")}
                  onPress={() => navigation.navigate("DeleteAccount")}
                  danger
                />
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

type RightItemProps = {
  testID?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
};

const RightItem = ({ testID, icon, title, subtitle, onPress, loading, danger }: RightItemProps) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading}
      className="flex-row items-center gap-3 rounded-lg px-1 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${danger ? "bg-danger-soft" : "bg-surface-raised"}`}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      </View>
      <View className="flex-1">
        <Text className={`font-medium ${danger ? "text-danger" : "text-content"}`}>{title}</Text>
        {subtitle && <Text className="text-muted mt-0.5 text-xs">{subtitle}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={danger ? colors.danger : colors.textSecondary}
        />
      )}
    </Pressable>
  );
};
