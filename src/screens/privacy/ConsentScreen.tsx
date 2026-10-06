import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { PrivacyPolicyScreen } from "@/screens/PrivacyPolicyScreen";
import { TermsOfServiceScreen } from "@/screens/TermsOfServiceScreen";
import {
  acceptPolicies,
  hasAcceptedCurrentPolicies,
  telemetryConsents,
  telemetryPreferences,
} from "@/utils/privacy";

const HIGHLIGHTS = [
  { icon: "lock-closed-outline", text: "privacy.consent.highlightEncryption" },
  { icon: "people-outline", text: "privacy.consent.highlightAccess" },
  { icon: "download-outline", text: "privacy.consent.highlightRights" },
] as const;

interface ConsentScreenProps {
  navigation: any;
}

/**
 * Collects the user's consent before using the app (LGPD arts. 7 and 8): the
 * required acceptance of the Terms and Privacy Policy, and the optional purposes
 * (analytics and crash reports), which start disabled. Exporting the data and
 * deleting the account stay available without accepting (LGPD art. 18).
 */
export const ConsentScreen: React.FC<ConsentScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { user, updateConsents, signOut } = useAuth();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const alreadyAccepted = hasAcceptedCurrentPolicies(user?.consents);
  const isPolicyUpdate = !alreadyAccepted && !!user?.consents?.privacyPolicy;
  const initialPreferences = telemetryPreferences(user?.consents);

  const [accepted, setAccepted] = useState(alreadyAccepted);
  const [analytics, setAnalytics] = useState(initialPreferences.analytics);
  const [crashReports, setCrashReports] = useState(initialPreferences.crashReports);
  const [document, setDocument] = useState<"privacy" | "terms" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await updateConsents({
        ...(alreadyAccepted ? {} : acceptPolicies()),
        ...telemetryConsents({ analytics, crashReports }),
      });
    } catch (saveError) {
      console.error("Error saving consents:", saveError);
      setError(t("privacy.consent.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const closeDocument = () => setDocument(null);

  return (
    <View className="flex-1 bg-zinc-900" style={{ paddingTop: topInset }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: bottomInset + 24 }}>
        <View className="mb-6 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/20">
            <Ionicons name="shield-checkmark-outline" size={36} color="#10B981" />
          </View>
          <Text className="mb-2 text-center text-2xl font-bold text-white">
            {isPolicyUpdate ? t("privacy.consent.titleUpdate") : t("privacy.consent.title")}
          </Text>
          <Text className="text-center text-zinc-400">
            {isPolicyUpdate ? t("privacy.consent.subtitleUpdate") : t("privacy.consent.subtitle")}
          </Text>
        </View>

        <View className="mb-6 gap-3 rounded-xl bg-zinc-800 p-4">
          {HIGHLIGHTS.map((item) => (
            <View key={item.icon} className="flex-row items-start gap-3">
              <Ionicons name={item.icon} size={20} color="#10B981" />
              <Text className="flex-1 text-sm leading-5 text-zinc-300">{t(item.text)}</Text>
            </View>
          ))}
        </View>

        {/* Required */}
        <Pressable
          testID="consent-accept-policies"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted, disabled: alreadyAccepted }}
          accessibilityLabel={t("privacy.consent.acceptLabel")}
          disabled={alreadyAccepted}
          onPress={() => setAccepted(!accepted)}
          className="mb-6 flex-row items-start gap-3 rounded-xl border border-zinc-700 p-4">
          <View
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${
              accepted ? "border-emerald-600 bg-emerald-600" : "border-zinc-500"
            }`}>
            {accepted && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text className="flex-1 text-sm leading-5 text-zinc-300">
            {t("privacy.consent.acceptBefore")}
            <Text className="font-semibold text-emerald-500" onPress={() => setDocument("terms")}>
              {t("privacy.consent.terms")}
            </Text>
            {t("privacy.consent.acceptAnd")}
            <Text className="font-semibold text-emerald-500" onPress={() => setDocument("privacy")}>
              {t("privacy.consent.privacy")}
            </Text>
            . <Text className="text-zinc-500">{t("privacy.consent.required")}</Text>
          </Text>
        </Pressable>

        {/* Optional purposes */}
        <Text className="mb-1 text-base font-semibold text-zinc-200">
          {t("privacy.consent.optional")}
        </Text>
        <Text className="mb-3 text-xs text-zinc-500">{t("privacy.consent.optionalHint")}</Text>
        <View className="mb-6 gap-3">
          <ConsentToggle
            testID="consent-analytics"
            icon="stats-chart-outline"
            title={t("privacy.telemetry.analyticsTitle")}
            description={t("privacy.telemetry.analyticsDescription")}
            value={analytics}
            onChange={setAnalytics}
          />
          <ConsentToggle
            testID="consent-crash-reports"
            icon="bug-outline"
            title={t("privacy.telemetry.crashTitle")}
            description={t("privacy.telemetry.crashDescription")}
            value={crashReports}
            onChange={setCrashReports}
          />
        </View>

        {error && <Text className="mb-4 text-center text-sm text-red-400">{error}</Text>}

        <TouchableOpacity
          testID="consent-continue"
          onPress={handleContinue}
          disabled={!accepted || isSaving}
          className={`items-center rounded-lg py-4 ${accepted ? "bg-emerald-600" : "bg-zinc-700"}`}
          style={{ opacity: !accepted || isSaving ? 0.7 : 1 }}>
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-semibold text-white">
              {t("privacy.consent.continue")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut} disabled={isSaving} className="mt-2 items-center py-3">
          <Text className="text-base text-zinc-400">{t("privacy.consent.decline")}</Text>
        </TouchableOpacity>

        {/* Rights that don't depend on accepting */}
        <View className="mt-4 border-t border-zinc-800 pt-4">
          <Text className="mb-2 text-center text-xs text-zinc-500">
            {t("privacy.consent.rightsTitle")}
          </Text>
          <View className="flex-row justify-center gap-6">
            <TouchableOpacity
              testID="consent-export"
              disabled={isSaving}
              onPress={() => navigation.navigate("PrivacyCenter")}
              className="py-2">
              <Text className="text-sm text-emerald-500">{t("privacy.consent.exportLink")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="consent-delete"
              disabled={isSaving}
              onPress={() => navigation.navigate("DeleteAccount")}
              className="py-2">
              <Text className="text-sm text-red-400">{t("privacy.consent.deleteLink")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={document !== null} animationType="slide" onRequestClose={closeDocument}>
        {document === "privacy" && <PrivacyPolicyScreen navigation={{ goBack: closeDocument }} />}
        {document === "terms" && <TermsOfServiceScreen navigation={{ goBack: closeDocument }} />}
      </Modal>
    </View>
  );
};

type ConsentToggleProps = {
  testID: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export const ConsentToggle = ({
  testID,
  icon,
  title,
  description,
  value,
  onChange,
  disabled,
}: ConsentToggleProps) => (
  <View className="flex-row items-center gap-3 rounded-xl bg-zinc-800 p-4">
    <Ionicons name={icon} size={22} color="#9CA3AF" />
    <View className="flex-1">
      <Text className="font-medium text-zinc-200">{title}</Text>
      <Text className="mt-1 text-xs leading-4 text-zinc-400">{description}</Text>
    </View>
    <Switch
      testID={testID}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={title}
      trackColor={{ false: "#3F3F46", true: "#059669" }}
      thumbColor={value ? "#FFFFFF" : "#9CA3AF"}
    />
  </View>
);
