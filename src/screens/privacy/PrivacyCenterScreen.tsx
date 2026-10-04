import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { FirestoreService } from "@/services/firestore";
import { exportPersonalData } from "@/services/exportService";
import { Card } from "@/components/Card";
import { ConsentToggle } from "@/screens/privacy/ConsentScreen";
import { summarizeDataExport } from "@/utils/dataExport";
import { telemetryConsents, telemetryPreferences } from "@/utils/privacy";

interface PrivacyCenterScreenProps {
  navigation: any;
}

const DATA_PROTECTION = [
  "Nomes e valores de cuidadores e pagamentos são criptografados com AES-256-GCM no aparelho, antes do envio",
  "Cada casa tem sua própria chave, acessível somente aos gerentes da casa",
  "Toda comunicação com o servidor usa conexão criptografada (TLS)",
  "Ao excluir uma casa ou a conta, os dados e as chaves de criptografia são apagados",
];

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

/**
 * Where users exercise their LGPD rights (art. 18): review and revoke consent,
 * export their data, correct it and delete it.
 */
export const PrivacyCenterScreen: React.FC<PrivacyCenterScreenProps> = ({ navigation }) => {
  useScreenTracking("PrivacyCenter", "PrivacyCenterScreen");

  const { user, updateConsents } = useAuth();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const [isExporting, setIsExporting] = useState(false);
  // One consent change at a time
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const preferences = telemetryPreferences(user?.consents);

  const showError = (message: string) =>
    showAlert({
      title: "Erro",
      message,
      icon: "alert-circle",
      iconColor: "#ef4444",
      buttons: [{ text: "OK", style: "default" }],
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
      showError("Não foi possível aplicar sua escolha. Tente novamente.");
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      setIsExporting(true);
      const data = await FirestoreService.exportUserData(user.uid, user.email);
      await exportPersonalData(data);
      const summary = summarizeDataExport(data);
      showAlert({
        title: "Dados exportados",
        message: `Seu arquivo inclui sua conta, consentimentos, ${summary.houses} casa(s), ${summary.caregivers} cuidador(es) e ${summary.payments} pagamento(s), em formato JSON.`,
        icon: "checkmark-circle",
        iconColor: "#10b981",
        buttons: [{ text: "OK", style: "default" }],
      });
    } catch (error) {
      console.error("Error exporting personal data:", error);
      showError("Não foi possível exportar seus dados. Verifique sua conexão e tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const contactDataProtectionOfficer = () =>
    Linking.openURL("mailto:contato@pedrorbc.com?subject=LGPD - Solicitação de titular");

  return (
    <View className="flex-1 bg-zinc-900">
      <View
        className="flex-row items-center border-b border-zinc-700 bg-zinc-800 px-4 py-3"
        style={{ paddingTop: topInset + 12 }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
          <Text className="ml-2 text-lg font-semibold text-white">Privacidade e Dados</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 32 }}>
        <View className="gap-6">
          <View>
            <Text className="font-heading mb-3 text-lg text-zinc-200">Proteção dos seus dados</Text>
            <Card variant="elevated">
              <View className="gap-3">
                {DATA_PROTECTION.map((text) => (
                  <View key={text} className="flex-row items-start gap-3">
                    <Ionicons name="lock-closed" size={16} color="#10B981" />
                    <Text className="flex-1 text-sm leading-5 text-zinc-300">{text}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          <View>
            <Text className="font-heading mb-3 text-lg text-zinc-200">Consentimentos</Text>
            <View className="gap-3">
              <Card variant="elevated">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="document-text-outline" size={22} color="#9CA3AF" />
                  <View className="flex-1">
                    <Text className="font-medium text-zinc-200">
                      Termos e Política de Privacidade
                    </Text>
                    <Text className="mt-1 text-xs text-zinc-400">
                      Aceitos em {formatDate(user?.consents?.privacyPolicy?.acceptedAt)} (versão{" "}
                      {user?.consents?.privacyPolicy?.version ?? "—"})
                    </Text>
                  </View>
                </View>
              </Card>
              <ConsentToggle
                testID="privacy-analytics"
                icon="stats-chart-outline"
                title="Estatísticas de uso"
                description="Telas visitadas e ações no app, sem nome, email ou valores (Google Analytics)."
                value={preferences.analytics}
                disabled={isSavingConsent}
                onChange={(analytics) => changePreference({ analytics })}
              />
              <ConsentToggle
                testID="privacy-crash-reports"
                icon="bug-outline"
                title="Relatórios de erro"
                description="Informações técnicas sobre falhas, para corrigirmos problemas (Firebase Crashlytics)."
                value={preferences.crashReports}
                disabled={isSavingConsent}
                onChange={(crashReports) => changePreference({ crashReports })}
              />
            </View>
          </View>

          <View>
            <Text className="font-heading mb-3 text-lg text-zinc-200">Seus direitos (LGPD)</Text>
            <Card variant="elevated">
              <View className="gap-1">
                <RightItem
                  icon="download-outline"
                  title="Exportar meus dados"
                  subtitle="Cópia completa em JSON: conta, casas, cuidadores e pagamentos"
                  onPress={handleExport}
                  loading={isExporting}
                />
                <RightItem
                  icon="create-outline"
                  title="Corrigir meus dados"
                  subtitle="Alterar nome e ícone do perfil"
                  onPress={() => navigation.navigate("UserProfile")}
                />
                <RightItem
                  icon="shield-outline"
                  title="Política de Privacidade"
                  subtitle="Quais dados tratamos, por quê e com quem"
                  onPress={() => navigation.navigate("PrivacyPolicy")}
                />
                <RightItem
                  icon="document-outline"
                  title="Termos de Uso"
                  onPress={() => navigation.navigate("TermsOfService")}
                />
                <RightItem
                  icon="mail-outline"
                  title="Falar com o Encarregado (DPO)"
                  subtitle="contato@pedrorbc.com"
                  onPress={contactDataProtectionOfficer}
                />
                <RightItem
                  icon="person-remove-outline"
                  title="Excluir conta e dados"
                  subtitle="Remove sua conta e as casas que você possui"
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
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
};

const RightItem = ({ icon, title, subtitle, onPress, loading, danger }: RightItemProps) => (
  <Pressable
    onPress={onPress}
    disabled={loading}
    className="flex-row items-center gap-3 rounded-lg px-1 py-3"
    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
    <View
      className={`h-10 w-10 items-center justify-center rounded-full ${danger ? "bg-red-900/40" : "bg-zinc-700"}`}>
      <Ionicons name={icon} size={20} color={danger ? "#EF4444" : "#9CA3AF"} />
    </View>
    <View className="flex-1">
      <Text className={`font-medium ${danger ? "text-red-400" : "text-zinc-200"}`}>{title}</Text>
      {subtitle && <Text className="mt-0.5 text-xs text-zinc-400">{subtitle}</Text>}
    </View>
    {loading ? (
      <ActivityIndicator color="#10B981" />
    ) : (
      <Ionicons name="chevron-forward" size={20} color={danger ? "#EF4444" : "#9CA3AF"} />
    )}
  </Pressable>
);
