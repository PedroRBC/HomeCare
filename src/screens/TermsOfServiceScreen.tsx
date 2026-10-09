import { useAppTheme } from "@/theme";
import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TERMS_VERSION } from "@/utils/privacy";

const LAST_UPDATED = TERMS_VERSION.split("-").reverse().join("/");

interface TermsOfServiceScreenProps {
  navigation: any;
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({ navigation }) => {
  const { colors } = useAppTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const openEmail = () => {
    Linking.openURL("mailto:contato@pedrorbc.com?subject=Termos de Uso - Dúvida");
  };

  return (
    <SafeAreaView className="bg-app flex-1">
      {/* Header */}
      <View
        className="border-divider bg-surface flex-row items-center justify-between border-b px-4 py-3"
        style={{ paddingTop: topInset }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text className="text-content ml-2 text-lg font-semibold">Termos de Uso</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        style={{ padding: 8 }}
        contentContainerStyle={{ paddingBottom: bottomInset + 36 }}>
        <View className="space-y-6">
          {/* Introduction */}
          <View>
            <Text className="text-content mb-3 text-xl font-bold">Termos de Uso</Text>
            <Text className="text-muted mb-2 text-sm">
              <Text className="font-semibold">Última atualização:</Text> {LAST_UPDATED}
            </Text>
            <Text className="text-muted text-sm">
              Estes Termos de Uso regem o uso do aplicativo HomeCare (&quot;aplicativo&quot;,
              &quot;serviço&quot;) operado por nós (&quot;nós&quot;, &quot;nosso&quot; ou
              &quot;empresa&quot;).
            </Text>
          </View>

          {/* Acceptance of Terms */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">1. Aceitação dos Termos</Text>
            <Text className="text-muted mb-3 text-sm">
              Ao acessar e usar este aplicativo, você aceita estar vinculado aos termos e condições
              de uso aqui estabelecidos. Se você não concordar com qualquer parte destes termos, não
              deve usar nosso serviço.
            </Text>
          </View>

          {/* Description of Service */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">2. Descrição do Serviço</Text>
            <Text className="text-muted mb-3 text-sm">
              O HomeCare é um aplicativo móvel que permite aos usuários:
            </Text>
            <Text className="text-muted mb-3 text-sm">
              • Gerenciar informações de cuidadores
              {"\n"}• Criar e manter cronogramas de cuidados
              {"\n"}• Rastrear pagamentos e histórico financeiro
              {"\n"}• Receber notificações sobre pagamentos em atraso
              {"\n"}• Colaborar com outros membros da família
            </Text>
          </View>

          {/* User Responsibilities */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              3. Responsabilidades do Usuário
            </Text>
            <Text className="text-muted mb-3 text-sm">Você concorda em:</Text>
            <Text className="text-muted mb-3 text-sm">
              • Fornecer informações precisas e atualizadas
              {"\n"}• Manter a confidencialidade de sua conta
              {"\n"}• Usar o aplicativo apenas para fins legais
              {"\n"}• Não interferir no funcionamento do serviço
              {"\n"}• Respeitar os direitos de outros usuários
            </Text>
          </View>

          {/* Prohibited Uses */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">4. Usos Proibidos</Text>
            <Text className="text-muted mb-3 text-sm">Você não pode usar nosso aplicativo:</Text>
            <Text className="text-muted mb-3 text-sm">
              • Para qualquer propósito ilegal ou não autorizado
              {"\n"}• Para transmitir vírus ou código malicioso
              {"\n"}• Para coletar informações de outros usuários
              {"\n"}• Para tentar acessar contas de outros usuários
              {"\n"}• Para qualquer atividade que viole estes termos
            </Text>
          </View>

          {/* Privacy and Data */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">5. Privacidade e Dados</Text>
            <Text className="text-muted mb-3 text-sm">
              Seu uso do aplicativo também é regido por nossa Política de Privacidade, que descreve
              como tratamos dados pessoais conforme a LGPD. Ao cadastrar dados de cuidadores ou
              convidar outras pessoas, você é responsável por ter base legal para isso e por
              informá-las sobre o uso do HomeCare.
            </Text>
          </View>

          {/* Service Availability */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              6. Disponibilidade do Serviço
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Nos esforçamos para manter o serviço disponível 24/7, mas não garantimos
              disponibilidade ininterrupta. Podemos interromper o serviço para manutenção,
              atualizações ou por motivos técnicos.
            </Text>
          </View>

          {/* Limitation of Liability */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              7. Limitação de Responsabilidade
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Em nenhuma circunstância seremos responsáveis por danos diretos, indiretos,
              incidentais, especiais ou consequenciais resultantes do uso ou incapacidade de usar
              nosso serviço.
            </Text>
          </View>

          {/* Changes to Terms */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">8. Alterações nos Termos</Text>
            <Text className="text-muted mb-3 text-sm">
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações
              entrarão em vigor imediatamente após a publicação. Seu uso continuado do serviço
              constitui aceitação dos novos termos.
            </Text>
          </View>

          {/* Termination */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">9. Rescisão</Text>
            <Text className="text-muted mb-3 text-sm">
              Podemos suspender ou encerrar sua conta a qualquer momento, com ou sem aviso, por
              violação destes termos ou por qualquer outro motivo a nosso critério.
            </Text>
          </View>

          {/* Governing Law */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">10. Lei Aplicável</Text>
            <Text className="text-muted mb-3 text-sm">
              Estes termos são regidos pelas leis do Brasil. Qualquer disputa será resolvida nos
              tribunais competentes do Brasil.
            </Text>
          </View>

          {/* Contact Information */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">11. Contato</Text>
            <Text className="text-muted mb-3 text-sm">
              Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco:
            </Text>

            <Pressable
              onPress={openEmail}
              className="bg-primary flex-row items-center rounded-lg p-3">
              <Ionicons name="mail" size={20} color={colors.onPrimary} />
              <Text className="text-on-primary ml-2 font-medium">contato@pedrorbc.com</Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View className="bg-surface mt-8 rounded-lg p-4">
            <Text className="text-muted text-center text-xs">
              Estes Termos de Uso são efetivos a partir de {LAST_UPDATED} e se aplicam a todos os
              usuários do aplicativo HomeCare.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
