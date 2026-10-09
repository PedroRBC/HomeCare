import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PRIVACY_POLICY_VERSION } from "@/utils/privacy";

const LAST_UPDATED = PRIVACY_POLICY_VERSION.split("-").reverse().join("/");

interface PrivacyPolicyScreenProps {
  navigation: { goBack: () => void };
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const openEmail = () => {
    Linking.openURL("mailto:contato@pedrorbc.com?subject=LGPD - Política de Privacidade");
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
              <Text className="font-semibold">Última atualização:</Text> {LAST_UPDATED} (versão{" "}
              {PRIVACY_POLICY_VERSION})
            </Text>
            <Text className="text-sm text-zinc-300">
              Esta Política de Privacidade descreve como o HomeCare (&quot;nós&quot;,
              &quot;nosso&quot; ou &quot;aplicativo&quot;) trata dados pessoais, em conformidade com
              a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
            </Text>
          </View>

          {/* Controller */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">1. Controlador e Encarregado</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              O controlador dos dados é o desenvolvedor do HomeCare. O Encarregado pelo tratamento
              de dados pessoais (DPO) pode ser contatado pelo e-mail contato@pedrorbc.com, para
              qualquer solicitação relacionada aos seus dados.
            </Text>
          </View>

          {/* Information We Collect */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">2. Dados que Tratamos</Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              2.1 Dados da sua conta
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Endereço de e-mail, quando fornecido, e método de login (senha, Google ou Facebook)
              {"\n"}• Nome de exibição e ícone do perfil
              {"\n"}• Identificador único do usuário (gerado automaticamente)
              {"\n"}• Registro dos seus consentimentos (versão aceita e data)
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              2.2 Dados que você registra no aplicativo
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Casas, com nome, descrição e gerentes convidados (nome e e-mail)
              {"\n"}• Cuidadores: nome, e-mail de acesso (opcional), frequência e valores de
              pagamento
              {"\n"}• Escalas de trabalho e histórico de pagamentos
              {"\n"}• Convites enviados e recebidos
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Os dados de cuidadores pertencem a terceiros. Ao cadastrá-los, você declara ter base
              legal para isso (por exemplo, a relação de trabalho) e deve informá-los sobre o uso do
              HomeCare.
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">
              2.3 Dados de uso (somente com seu consentimento)
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Telas visualizadas e ações realizadas, sem nome, e-mail ou valores
              {"\n"}• Informações técnicas de falhas (modelo do aparelho, versão do sistema)
            </Text>

            <Text className="mb-2 text-base font-semibold text-zinc-200">2.4 Notificações</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Status de permissão de notificações
              {"\n"}• Lembretes de pagamento agendados no próprio aparelho
            </Text>
          </View>

          {/* Purposes and legal bases */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">3. Finalidades e Bases Legais</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Criar e manter sua conta, sincronizar casas, cuidadores, escalas e pagamentos e
              enviar lembretes: execução do contrato (art. 7º, V)
              {"\n"}• Estatísticas de uso e relatórios de erro: consentimento (art. 7º, I), que você
              pode revogar a qualquer momento
              {"\n"}• Segurança da conta e prevenção a fraudes: legítimo interesse (art. 7º, IX)
              {"\n"}• Atender ordens judiciais ou de autoridades: cumprimento de obrigação legal
              (art. 7º, II)
            </Text>
          </View>

          {/* Data Storage and Security */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">4. Segurança e Armazenamento</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Em trânsito: toda comunicação com nossos servidores usa conexão criptografada (TLS)
              {"\n"}• Em repouso: nomes e valores de cuidadores e pagamentos são criptografados com
              AES-256-GCM no seu aparelho, antes do envio; o servidor guarda apenas o conteúdo
              cifrado, sobre uma infraestrutura que também criptografa todo o armazenamento
              {"\n"}• Cada casa tem uma chave própria, acessível somente aos gerentes da casa
              {"\n"}• Regras de acesso garantem que cada usuário veja apenas as casas das quais
              participa
              {"\n"}• Os dados do aplicativo não são incluídos em backups automáticos do aparelho
            </Text>
          </View>

          {/* Data Sharing */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">5. Compartilhamento de Dados</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Não vendemos nem alugamos seus dados. Eles são compartilhados apenas com:
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Gerentes que você convida para uma casa, que passam a ver os dados dessa casa
              {"\n"}• Cuidadoras cadastradas com e-mail, que veem a escala da casa e seus plantões
              depois de aceitarem o convite
              {"\n"}• Google Firebase (operador), para autenticação, banco de dados e notificações
              {"\n"}• Google Analytics e Firebase Crashlytics, somente se você consentir
              {"\n"}• Meta/Facebook, somente se você escolher esse login, para confirmar sua
              identidade. O provedor pode retornar nome, foto e e-mail (que pode faltar), usados
              pelo Firebase para autenticação e perfil. Não enviamos dados de casas, cuidadores,
              escalas ou pagamentos à Meta, nem usamos esse SDK para publicidade ou analytics
              automático
              {"\n"}• Autoridades, quando exigido por lei ou ordem judicial
            </Text>
          </View>

          {/* International transfer */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">
              6. Transferência Internacional
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Nossos provedores podem armazenar dados em servidores fora do Brasil. Essas
              transferências seguem o art. 33 da LGPD, com provedores que oferecem garantias
              contratuais de proteção de dados. Os dados de cuidadores e pagamentos já saem do seu
              aparelho criptografados.
            </Text>
          </View>

          {/* Data Retention */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">7. Retenção e Eliminação</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Mantemos seus dados enquanto sua conta estiver ativa
              {"\n"}• Ao excluir uma casa ou sua conta, os dados e as chaves de criptografia são
              apagados imediatamente; cópias de segurança do provedor são eliminadas ao fim do seu
              prazo de retenção
              {"\n"}• Convites expiram em 7 dias
              {"\n"}• Estatísticas de uso seguem o prazo de retenção configurado no Google
              Analytics, e relatórios de erro são mantidos por até 90 dias
            </Text>
          </View>

          {/* Your Rights */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">8. Seus Direitos (art. 18)</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              • Confirmação da existência de tratamento e acesso aos dados
              {"\n"}• Correção de dados incompletos, inexatos ou desatualizados
              {"\n"}• Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos
              {"\n"}• Portabilidade dos dados
              {"\n"}• Eliminação dos dados tratados com consentimento
              {"\n"}• Informação sobre com quem compartilhamos seus dados
              {"\n"}• Informação sobre a possibilidade de não consentir e suas consequências
              {"\n"}• Revogação do consentimento
              {"\n"}• Petição à Autoridade Nacional de Proteção de Dados (ANPD)
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              No aplicativo, em Configurações › Privacidade e Dados, você pode exportar seus dados,
              revogar consentimentos e excluir sua conta. Demais solicitações podem ser enviadas ao
              Encarregado e serão respondidas em até 15 dias.
            </Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Se você não consentir com estatísticas e relatórios de erro, o aplicativo funciona
              normalmente. Sem aceitar esta política, não é possível usar o aplicativo.
            </Text>
          </View>

          {/* Children's Privacy */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">9. Crianças e Adolescentes</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              O HomeCare é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de
              crianças ou adolescentes. Se identificarmos esse tipo de dado, ele será excluído.
            </Text>
          </View>

          {/* Changes to Policy */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">10. Alterações nesta Política</Text>
            <Text className="mb-3 text-sm text-zinc-300">
              Quando esta política mudar, mostraremos a nova versão no aplicativo e pediremos seu
              aceite antes de você continuar usando o HomeCare.
            </Text>
          </View>

          {/* Contact Information */}
          <View>
            <Text className="mb-3 text-lg font-bold text-white">11. Contato</Text>

            <Text className="mb-3 text-sm text-zinc-300">
              Se você tiver dúvidas sobre esta Política de Privacidade ou quiser exercer seus
              direitos, entre em contato com o Encarregado:
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
              Esta Política de Privacidade é efetiva a partir de {LAST_UPDATED} e se aplica a todos
              os usuários do aplicativo HomeCare.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
