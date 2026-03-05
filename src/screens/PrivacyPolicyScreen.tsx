import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface PrivacyPolicyScreenProps {
  navigation: any;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const openEmail = () => {
    Linking.openURL("mailto:contato@pedrorbc.com?subject=Privacy Policy Inquiry");
  };

  const openWebsite = () => {
    Linking.openURL("https://pedrorbc.com/privacy");
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-900">
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3"
        style={{ paddingTop: topInset }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
          <Text className="ml-2 text-lg font-semibold text-white">Política de Privacidade</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: bottomInset + 36 }}>
        <View className="space-y-6">
          {/* Introduction */}
          <View>
            <Text className="mb-3 text-xl font-bold text-white">Política de Privacidade</Text>
            <Text className="mb-2 text-sm text-zinc-300">
              <Text className="font-semibold">Última atualização:</Text> 05/03/2026
            </Text>
            <Text className="text-sm text-zinc-300">
              Esta Política de Privacidade descreve como o HomeCare (&quot;nós&quot;,
              &quot;nosso&quot; ou &quot;aplicativo&quot;) coleta, usa e protege suas informações
              quando você usa nosso aplicativo móvel.
            </Text>
          </View>

          {/* Information We Collect */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">1. Informações que Coletamos</Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              1.1 Informações de Conta
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Endereço de e-mail (obrigatório para autenticação)
              {"\n"}• Nome de exibição (opcional)
              {"\n"}• Identificador único do usuário (gerado automaticamente)
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              1.2 Dados do Aplicativo
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Informações de cuidadores (nome, frequência, valor)
              {"\n"}• Cronogramas e agendamentos
              {"\n"}• Histórico de pagamentos
              {"\n"}• Dados de casas/famílias (quando aplicável)
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              1.3 Dados de Uso e Analytics
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Telas visualizadas no aplicativo
              {"\n"}• Ações realizadas (criar cuidador, marcar pagamento, etc.)
              {"\n"}• Informações de dispositivo (tipo, versão do sistema operacional)
              {"\n"}• Dados de crash e erros (para melhorar a estabilidade)
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              1.4 Dados de Notificações
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Status de permissão de notificações
              {"\n"}• Notificações agendadas para lembretes de pagamento
            </Text>
          </View>

          {/* How We Use Information */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">
              2. Como Usamos Suas Informações
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              2.1 Funcionalidades do Aplicativo
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Gerenciar sua conta e autenticação
              {"\n"}• Armazenar e sincronizar seus dados de cuidadores
              {"\n"}• Manter cronogramas e agendamentos
              {"\n"}• Rastrear pagamentos e histórico
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              2.2 Melhorias e Suporte
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Analisar uso do aplicativo para melhorias
              {"\n"}• Identificar e corrigir bugs e problemas
              {"\n"}• Fornecer suporte técnico
              {"\n"}• Enviar notificações importantes sobre o serviço
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">2.3 Notificações</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Enviar lembretes de pagamentos em atraso
              {"\n"}• Notificar sobre atualizações importantes do aplicativo
            </Text>
          </View>

          {/* Data Storage and Security */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">3. Armazenamento e Segurança</Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              3.1 Armazenamento de Dados
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Seus dados são armazenados no Firebase (Google Cloud Platform)
              {"\n"}• Dados são criptografados em trânsito e em repouso
              {"\n"}• Backup automático para garantir disponibilidade
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              3.2 Medidas de Segurança
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Autenticação segura com Firebase Auth
              {"\n"}• Acesso baseado em permissões por usuário
              {"\n"}• Monitoramento de segurança 24/7
              {"\n"}• Atualizações regulares de segurança
            </Text>
          </View>

          {/* Data Sharing */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">4. Compartilhamento de Dados</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros,
              exceto nas seguintes circunstâncias:
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              4.1 Provedores de Serviços
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Firebase (Google) - para armazenamento e autenticação
              {"\n"}• Google Analytics - para análise de uso (dados anonimizados)
              {"\n"}• Google Crashlytics - para relatórios de erro (dados anonimizados)
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              4.2 Requisitos Legais
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Quando exigido por lei ou processo legal
              {"\n"}• Para proteger nossos direitos ou propriedade
              {"\n"}• Para proteger a segurança dos usuários
            </Text>
          </View>

          {/* Your Rights */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">5. Seus Direitos</Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              5.1 Acesso e Controle
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Visualizar todos os seus dados no aplicativo
              {"\n"}• Editar ou atualizar suas informações
              {"\n"}• Exportar seus dados (entre em contato conosco)
              {"\n"}• Excluir sua conta e dados permanentemente
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">5.2 Notificações</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Ativar ou desativar notificações a qualquer momento
              {"\n"}• Configurar preferências de notificação
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              5.3 Exclusão de Dados
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Solicitar exclusão de dados específicos
              {"\n"}• Excluir conta completa (todos os dados serão removidos)
            </Text>
          </View>

          {/* Data Retention */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">6. Retenção de Dados</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              • Mantemos seus dados enquanto sua conta estiver ativa
              {"\n"}• Dados são excluídos permanentemente quando você exclui sua conta
              {"\n"}• Dados de analytics são anonimizados e podem ser mantidos por até 26 meses
              {"\n"}• Dados de crash são mantidos por até 90 dias
            </Text>
          </View>

          {/* Children's Privacy */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">7. Privacidade de Menores</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Nosso aplicativo não é direcionado a menores de 13 anos. Não coletamos
              intencionalmente informações pessoais de menores de 13 anos. Se descobrirmos que
              coletamos dados de um menor de 13 anos, excluiremos essas informações imediatamente.
            </Text>
          </View>

          {/* International Users */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">8. Usuários Internacionais</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Seus dados podem ser transferidos e processados em servidores localizados fora do seu
              país de residência. Ao usar nosso aplicativo, você consente com a transferência de
              seus dados para esses servidores.
            </Text>
          </View>

          {/* Changes to Policy */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">9. Alterações nesta Política</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você
              sobre mudanças significativas através do aplicativo ou por e-mail. Sua continuação no
              uso do aplicativo após as alterações constitui aceitação da nova política.
            </Text>
          </View>

          {/* Contact Information */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">10. Contato</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus
              dados, entre em contato conosco:
            </Text>

            <View className="space-y-2">
              <Pressable
                onPress={openEmail}
                className="flex-row items-center rounded-lg bg-blue-600 p-3">
                <Ionicons name="mail" size={20} color="#ffffff" />
                <Text className="ml-2 font-medium text-white">contato@pedrorbc.com</Text>
              </Pressable>

              <Pressable
                onPress={openWebsite}
                className="flex-row items-center rounded-lg bg-zinc-700 p-3">
                <Ionicons name="globe" size={20} color="#ffffff" />
                <Text className="ml-2 font-medium text-white">https://pedrorbc.com/privacy</Text>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View className="mt-8 rounded-lg bg-zinc-800 p-4">
            <Text className="text-center text-xs text-zinc-400">
              Esta Política de Privacidade é efetiva a partir de 05/03/2026 e se aplica a todos os
              usuários do aplicativo HomeCare.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
