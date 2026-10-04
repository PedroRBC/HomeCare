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
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const openEmail = () => {
    Linking.openURL("mailto:contato@pedrorbc.com?subject=Termos de Uso - Dúvida");
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3"
        style={{ paddingTop: topInset }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
          <Text className="ml-2 text-lg font-semibold text-white">Termos de Uso</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        style={{ padding: 8 }}
        contentContainerStyle={{ paddingBottom: bottomInset + 36 }}>
        <View className="space-y-6">
          {/* Introduction */}
          <View>
            <Text className="mb-3 text-xl font-bold text-white">Termos de Uso</Text>
            <Text className="mb-2 text-sm text-zinc-300">
              <Text className="font-semibold">Última atualização:</Text> {LAST_UPDATED}
            </Text>
            <Text className="text-sm text-zinc-300">
              Estes Termos de Uso regem o uso do aplicativo HomeCare (&quot;aplicativo&quot;,
              &quot;serviço&quot;) operado por nós (&quot;nós&quot;, &quot;nosso&quot; ou
              &quot;empresa&quot;).
            </Text>
          </View>

          {/* Acceptance of Terms */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">1. Aceitação dos Termos</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Ao acessar e usar este aplicativo, você aceita estar vinculado aos termos e condições
              de uso aqui estabelecidos. Se você não concordar com qualquer parte destes termos, não
              deve usar nosso serviço.
            </Text>
          </View>

          {/* Description of Service */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">2. Descrição do Serviço</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              O HomeCare é um aplicativo móvel que permite aos usuários:
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Gerenciar informações de cuidadores
              {"\n"}• Criar e manter cronogramas de cuidados
              {"\n"}• Rastrear pagamentos e histórico financeiro
              {"\n"}• Receber notificações sobre pagamentos em atraso
              {"\n"}• Colaborar com outros membros da família
            </Text>
          </View>

          {/* User Responsibilities */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">
              3. Responsabilidades do Usuário
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">Você concorda em:</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Fornecer informações precisas e atualizadas
              {"\n"}• Manter a confidencialidade de sua conta
              {"\n"}• Usar o aplicativo apenas para fins legais
              {"\n"}• Não interferir no funcionamento do serviço
              {"\n"}• Respeitar os direitos de outros usuários
            </Text>
          </View>

          {/* Prohibited Uses */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">4. Usos Proibidos</Text>
            <Text className="mb-3 text-sm text-zinc-300">Você não pode usar nosso aplicativo:</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Para qualquer propósito ilegal ou não autorizado
              {"\n"}• Para transmitir vírus ou código malicioso
              {"\n"}• Para coletar informações de outros usuários
              {"\n"}• Para tentar acessar contas de outros usuários
              {"\n"}• Para qualquer atividade que viole estes termos
            </Text>
          </View>

          {/* Privacy and Data */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">5. Privacidade e Dados</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Seu uso do aplicativo também é regido por nossa Política de Privacidade, que descreve
              como tratamos dados pessoais conforme a LGPD. Ao cadastrar dados de cuidadores ou
              convidar outras pessoas, você é responsável por ter base legal para isso e por
              informá-las sobre o uso do HomeCare.
            </Text>
          </View>

          {/* Service Availability */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">6. Disponibilidade do Serviço</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Nos esforçamos para manter o serviço disponível 24/7, mas não garantimos
              disponibilidade ininterrupta. Podemos interromper o serviço para manutenção,
              atualizações ou por motivos técnicos.
            </Text>
          </View>

          {/* Limitation of Liability */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">
              7. Limitação de Responsabilidade
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Em nenhuma circunstância seremos responsáveis por danos diretos, indiretos,
              incidentais, especiais ou consequenciais resultantes do uso ou incapacidade de usar
              nosso serviço.
            </Text>
          </View>

          {/* Changes to Terms */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">8. Alterações nos Termos</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações
              entrarão em vigor imediatamente após a publicação. Seu uso continuado do serviço
              constitui aceitação dos novos termos.
            </Text>
          </View>

          {/* Termination */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">9. Rescisão</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Podemos suspender ou encerrar sua conta a qualquer momento, com ou sem aviso, por
              violação destes termos ou por qualquer outro motivo a nosso critério.
            </Text>
          </View>

          {/* Governing Law */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">10. Lei Aplicável</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Estes termos são regidos pelas leis do Brasil. Qualquer disputa será resolvida nos
              tribunais competentes do Brasil.
            </Text>
          </View>

          {/* Contact Information */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">11. Contato</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco:
            </Text>

            <Pressable
              onPress={openEmail}
              className="flex-row items-center rounded-lg bg-blue-600 p-3">
              <Ionicons name="mail" size={20} color="#ffffff" />
              <Text className="ml-2 font-medium text-white">contato@pedrorbc.com</Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View className="mt-8 rounded-lg bg-zinc-800 p-4">
            <Text className="text-center text-xs text-zinc-400">
              Estes Termos de Uso são efetivos a partir de {LAST_UPDATED} e se aplicam a todos os
              usuários do aplicativo HomeCare.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
