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
  {
    icon: "lock-closed-outline",
    text: "Nomes e valores de cuidadores e pagamentos são criptografados (AES-256) no seu aparelho antes de serem enviados.",
  },
  {
    icon: "people-outline",
    text: "Somente os gerentes de cada casa têm acesso aos dados dela.",
  },
  {
    icon: "download-outline",
    text: "Você pode exportar ou excluir seus dados quando quiser em Configurações › Privacidade e Dados.",
  },
] as const;

/**
 * Collects the user's consent before using the app (LGPD arts. 7 and 8): the
 * required acceptance of the Terms and Privacy Policy, and the optional purposes
 * (analytics and crash reports), which start disabled.
 */
export const ConsentScreen = () => {
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
      setError("Não foi possível salvar suas escolhas. Verifique sua conexão e tente novamente.");
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
            {isPolicyUpdate ? "Atualizamos nossa política" : "Sua privacidade"}
          </Text>
          <Text className="text-center text-zinc-400">
            {isPolicyUpdate
              ? "Revise e aceite a nova versão para continuar usando o HomeCare."
              : "Antes de continuar, veja como tratamos seus dados, conforme a LGPD."}
          </Text>
        </View>

        <View className="mb-6 gap-3 rounded-xl bg-zinc-800 p-4">
          {HIGHLIGHTS.map((item) => (
            <View key={item.icon} className="flex-row items-start gap-3">
              <Ionicons name={item.icon} size={20} color="#10B981" />
              <Text className="flex-1 text-sm leading-5 text-zinc-300">{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Required */}
        <Pressable
          testID="consent-accept-policies"
          onPress={() => !alreadyAccepted && setAccepted(!accepted)}
          className="mb-6 flex-row items-start gap-3 rounded-xl border border-zinc-700 p-4">
          <View
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${
              accepted ? "border-emerald-600 bg-emerald-600" : "border-zinc-500"
            }`}>
            {accepted && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text className="flex-1 text-sm leading-5 text-zinc-300">
            Li e concordo com os{" "}
            <Text className="font-semibold text-emerald-500" onPress={() => setDocument("terms")}>
              Termos de Uso
            </Text>{" "}
            e a{" "}
            <Text className="font-semibold text-emerald-500" onPress={() => setDocument("privacy")}>
              Política de Privacidade
            </Text>
            . <Text className="text-zinc-500">(obrigatório)</Text>
          </Text>
        </Pressable>

        {/* Optional purposes */}
        <Text className="mb-1 text-base font-semibold text-zinc-200">Opcional</Text>
        <Text className="mb-3 text-xs text-zinc-500">
          Desativados por padrão. Você pode mudar a qualquer momento.
        </Text>
        <View className="mb-6 gap-3">
          <ConsentToggle
            testID="consent-analytics"
            icon="stats-chart-outline"
            title="Estatísticas de uso"
            description="Telas visitadas e ações no app, sem nome, email ou valores (Google Analytics)."
            value={analytics}
            onChange={setAnalytics}
          />
          <ConsentToggle
            testID="consent-crash-reports"
            icon="bug-outline"
            title="Relatórios de erro"
            description="Informações técnicas sobre falhas, para corrigirmos problemas (Firebase Crashlytics)."
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
            <Text className="text-lg font-semibold text-white">Continuar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut} disabled={isSaving} className="mt-2 items-center py-3">
          <Text className="text-base text-zinc-400">Não concordo, sair da conta</Text>
        </TouchableOpacity>
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
};

export const ConsentToggle = ({
  testID,
  icon,
  title,
  description,
  value,
  onChange,
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
      trackColor={{ false: "#3F3F46", true: "#059669" }}
      thumbColor={value ? "#FFFFFF" : "#9CA3AF"}
    />
  </View>
);
