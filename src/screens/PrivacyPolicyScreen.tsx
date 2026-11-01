import { useAppTheme } from "@/theme";
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
  const { colors } = useAppTheme();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const openEmail = () => {
    Linking.openURL("mailto:contato@pedrorbc.com?subject=LGPD - Política de Privacidade");
  };

  const openWebsite = () => {
    Linking.openURL("https://pedrorbc.com/homecare/privacy");
  };

  const openDataDeletionPage = () => {
    Linking.openURL("https://pedrorbc.com/homecare/data-deletion");
  };

  return (
    <SafeAreaView className="bg-app flex-1">
      {/* Header */}
      <View
        className="border-divider bg-surface flex-row items-center justify-between border-b px-4 py-3"
        style={{ paddingTop: topInset }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text className="text-content ml-2 text-lg font-semibold">Política de Privacidade</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: bottomInset + 36 }}>
        <View className="space-y-6">
          {/* Introduction */}
          <View>
            <Text className="text-content mb-3 text-xl font-bold">Política de Privacidade</Text>
            <Text className="text-muted mb-2 text-sm">
              <Text className="font-semibold">Última atualização:</Text> {LAST_UPDATED} (versão{" "}
              {PRIVACY_POLICY_VERSION})
            </Text>
            <Text className="text-muted text-sm">
              Esta Política de Privacidade descreve como o HomeCare (&quot;nós&quot;,
              &quot;nosso&quot; ou &quot;aplicativo&quot;) trata dados pessoais, em conformidade com
              a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
            </Text>
            <Text className="text-muted mt-3 text-sm">
              O HomeCare é uma ferramenta administrativa para organizar cuidados domiciliares. Não é
              um dispositivo médico e não oferece diagnóstico, tratamento ou prescrição. Para
              orientações de saúde, consulte um profissional qualificado.
            </Text>
          </View>

          {/* Controller */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              1. Controlador e Encarregado
            </Text>
            <Text className="text-muted mb-3 text-sm">
              O controlador dos dados é o desenvolvedor do HomeCare. O Encarregado pelo tratamento
              de dados pessoais (DPO) pode ser contatado pelo e-mail contato@pedrorbc.com, para
              qualquer solicitação relacionada aos seus dados.
            </Text>
          </View>

          {/* Information We Collect */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">2. Dados que Tratamos</Text>

            <Text className="text-content mb-2 text-base font-semibold">
              2.1 Dados da sua conta
            </Text>
            <Text className="text-muted mb-3 text-sm">
              • Endereço de e-mail, quando fornecido, e método de login (senha, Google ou Facebook)
              {"\n"}• Nome de exibição e ícone do perfil; foto ou endereço da foto, quando
              fornecidos pelo provedor de login
              {"\n"}• Identificador único do usuário (gerado automaticamente)
              {"\n"}• Registro dos seus consentimentos (versão aceita e data)
            </Text>

            <Text className="text-content mb-2 text-base font-semibold">
              2.2 Dados que você registra no aplicativo
            </Text>
            <Text className="text-muted mb-3 text-sm">
              • Casas, com nome, descrição e gerentes convidados (nome e e-mail)
              {"\n"}• Cuidadores: nome, e-mail de acesso (opcional), frequência e valores de
              pagamento
              {"\n"}• Escalas de trabalho e histórico de pagamentos
              {"\n"}• Convites enviados e recebidos
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Os dados de cuidadores pertencem a terceiros. Ao cadastrá-los, você declara ter base
              legal para isso (por exemplo, a relação de trabalho) e deve informá-los sobre o uso do
              HomeCare.
            </Text>

            <Text className="text-content mb-2 text-base font-semibold">
              2.3 Dados de uso (somente com seu consentimento)
            </Text>
            <Text className="text-muted mb-3 text-sm">
              • Eventos de uso e informações técnicas de falhas, como modelo do aparelho e versão do
              sistema
              {"\n"}• Os parâmetros de Analytics são filtrados para evitar nomes, e-mails, valores e
              mensagens pessoais; isso não significa que todas as estatísticas sejam anônimas
              {"\n"}• Quando ativado, o Analytics também pode estimar localização aproximada a
              partir do endereço IP. Isso não usa o GPS nem solicita localização exata do aparelho
            </Text>

            <Text className="text-content mb-2 text-base font-semibold">2.4 Notificações</Text>
            <Text className="text-muted mb-3 text-sm">
              • Status de permissão de notificações
              {"\n"}• Lembretes de pagamento agendados no próprio aparelho
              {"\n"}• Para notificações push, o app solicita ao Firebase Cloud Messaging (FCM) um
              token técnico associado à instalação, usado na entrega das notificações e armazenado
              no aparelho quando a permissão correspondente é concedida. Esse tratamento relacionado
              a notificações é independente do consentimento para Analytics e Crashlytics.
            </Text>
          </View>

          <View>
            <Text className="text-content mb-2 text-base font-semibold">
              2.5 Feedback e relatos de problemas voluntários
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Ao enviar um relato, tratamos seu identificador de conta, título, descrição e detalhes
              opcionais do problema, além da versão do aplicativo, versão do sistema, plataforma e
              idioma. O envio é voluntário e independente do consentimento para Analytics ou
              Crashlytics. Não envie informações de pacientes, dados médicos, senhas ou outros dados
              sensíveis. Não coletamos capturas de tela ou logs nesse fluxo.
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Os relatos ficam separados das casas e podem ser consultados por você e pela equipe de
              suporte explicitamente autorizada, para atender sua solicitação e corrigir problemas
              (execução do contrato, art. 7º, V). O texto é protegido por TLS e pelas regras de
              acesso do Firebase, mas não pela chave de criptografia da casa. Os relatos enviados
              são incluídos na exportação dos seus dados e removidos ao excluir sua conta; a equipe
              pode removê-los antes. Não há expiração automática nesta versão.
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Não enviamos relatos automaticamente a serviços de IA ou ao GitHub. Uma pessoa da
              equipe pode revisar e remover dados pessoais antes de copiar o conteúdo para uma
              ferramenta de investigação ou issue. Essas cópias externas têm retenção própria e não
              são apagadas pela exclusão da conta no HomeCare; pedidos de remoção dessas cópias
              podem ser enviados ao Encarregado.
            </Text>
          </View>

          <View>
            <Text className="text-content mb-2 text-base font-semibold">
              2.6 Dados técnicos dos serviços
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Os serviços Firebase de autenticação, notificações e configuração remota podem
              processar identificadores de conta e instalação, endereço IP, país aproximado, idioma
              e versões do aplicativo e do sistema para funcionamento e segurança. Esses serviços
              operacionais são separados das escolhas opcionais de Analytics e Crashlytics. Não
              solicitamos acesso ao GPS nem coletamos localização exata.
            </Text>
          </View>

          <View>
            <Text className="text-content mb-2 text-base font-semibold">
              2.7 Notas do turno e passagem de plantão
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Recados da família e dos cuidadores são vinculados ao dia e turno da escala. A
              passagem de plantão pode registrar medicação, refeições, atividades, pendências e
              observações de saúde. Registre somente o necessário ao cuidado e apenas quando houver
              base legal aplicável aos dados de saúde do titular (art. 11 da LGPD); aceitar esta
              política não substitui essa base legal nem a autorização para compartilhar dados de
              terceiros.
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Os textos são criptografados no aparelho com AES-256-GCM, com chaves separadas para
              recados e conteúdo clínico. A família acessa os recados, mas não as passagens clínicas
              nem sua chave. Somente cuidadores aceitos e ativos na casa acessam o conteúdo clínico;
              quem assume um turno pode atualizar o estado das pendências anteriores sem reescrever
              o texto de outro autor. Autoria, referência à escala, datas, revisões e estados das
              pendências são metadados usados para controle de acesso e funcionamento.
            </Text>
            <Text className="text-muted mb-3 text-sm">
              As chaves ficam no Firebase, protegidas por regras de acesso; esta proteção não é uma
              promessa de criptografia ponta a ponta contra o operador do serviço. Suas notas são
              incluídas na exportação e removidas ao excluir a conta. Se o acesso à chave tiver sido
              revogado, a exportação identifica o conteúdo próprio como cifrado e não legível. Ao
              excluir uma casa, as chaves são removidas e a limpeza das notas é concluída por um
              serviço de servidor com novas tentativas. Cópias já exportadas e backups têm retenção
              própria. Esta versão não envia notificações push de novas notas.
            </Text>
          </View>

          {/* Purposes and legal bases */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              3. Finalidades e Bases Legais
            </Text>
            <Text className="text-muted mb-3 text-sm">
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
            <Text className="text-content mb-3 text-lg font-bold">
              4. Segurança e Armazenamento
            </Text>
            <Text className="text-muted mb-3 text-sm">
              • Em trânsito: a comunicação com os serviços usa conexão criptografada (TLS)
              {"\n"}• Dados sensíveis de cuidadores e pagamentos são criptografados no aparelho com
              AES-256-GCM, usando uma chave por casa, antes do envio; isso não abrange todos os
              campos. Alguns dados necessários para convites e acesso à escala, como nome, e-mail,
              casa e plantões associados ao vínculo de acesso, podem permanecer em texto claro
              {"\n"}• Registros antigos passam por migração para esse formato de criptografia
              {"\n"}• Regras de acesso limitam os dados disponíveis a cada usuário conforme sua
              participação nas casas
              {"\n"}• A criptografia complementa os controles de acesso e não impede o acesso de
              administradores da infraestrutura; cópias ou chaves já obtidas por outras pessoas não
              são removidas ao revogar o acesso
            </Text>
          </View>

          {/* Data Sharing */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              5. Compartilhamento de Dados
            </Text>

            <Text className="text-muted mb-3 text-sm">
              Não vendemos nem alugamos seus dados. Eles são compartilhados apenas com:
            </Text>
            <Text className="text-muted mb-3 text-sm">
              • Gerentes que você convida para uma casa, que passam a ver os dados dessa casa
              {"\n"}• Cuidadoras cadastradas com e-mail, que veem a escala da casa e seus plantões
              depois de aceitarem o convite
              {"\n"}• Google Firebase, para autenticação e banco de dados
              {"\n"}• Firebase Cloud Messaging (FCM), que recebe o token técnico da instalação para
              entregar notificações push, independentemente do consentimento para Analytics e
              Crashlytics
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
            <Text className="text-content mb-3 text-lg font-bold">
              6. Transferência Internacional
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Nossos provedores podem processar ou armazenar dados fora do Brasil. Essas
              transferências observam as regras aplicáveis e as garantias contratuais pertinentes. A
              criptografia de dados sensíveis de cuidadores e pagamentos não abrange todos os
              campos; dados necessários para convites e acesso à escala podem permanecer sem essa
              proteção.
            </Text>
          </View>

          {/* Data Retention */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">7. Retenção e Eliminação</Text>
            <Text className="text-muted mb-3 text-sm">
              Mantemos os dados necessários para a conta e as funcionalidades do aplicativo. Quando
              uma solicitação de exclusão é concluída com sucesso, removemos a identidade de
              autenticação, o perfil, os consentimentos e as casas de sua propriedade com os dados
              associados. Em casas de outras pessoas, removemos sua participação e revogamos seu
              acesso à escala; alguns vínculos de acesso associados a um e-mail verificado podem ser
              mantidos com status de recusado, em vez de apagados. A casa e os registros de trabalho
              que outras pessoas mantêm sobre você não são necessariamente excluídos.
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Backups do provedor, exportações já feitas e cópias ou chaves obtidas por outras
              pessoas podem persistir após a exclusão; dados também podem ser mantidos quando houver
              obrigação legal. A retenção desses itens e da telemetria segue regras próprias, sem um
              prazo único de eliminação garantido nesta política. Consulte as instruções de exclusão
              para conhecer o procedimento e seus limites.
            </Text>
          </View>

          {/* Your Rights */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">8. Seus Direitos (art. 18)</Text>
            <Text className="text-muted mb-3 text-sm">
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
            <Text className="text-muted mb-3 text-sm">
              No aplicativo, em Configurações › Privacidade e Dados, você pode exportar seus dados,
              revogar consentimentos e solicitar a exclusão da conta. Para outras solicitações ou
              problemas de acesso, fale com o Encarregado pelo e-mail contato@pedrorbc.com. Podemos
              verificar sua identidade antes de atender a pedidos relacionados à conta.
            </Text>
            <Pressable
              onPress={openDataDeletionPage}
              className="bg-surface-raised mb-3 flex-row items-center rounded-lg p-3">
              <Ionicons name="open-outline" size={20} color={colors.text} />
              <Text className="text-content ml-2 flex-1 font-medium">
                Instruções para exclusão de conta e dados
              </Text>
            </Pressable>
            <Text className="text-muted mb-3 text-sm">
              Se você não consentir com estatísticas e relatórios de erro, o aplicativo funciona
              normalmente. Sem aceitar esta política, não é possível usar o aplicativo.
            </Text>
          </View>

          {/* Children's Privacy */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">9. Crianças e Adolescentes</Text>
            <Text className="text-muted mb-3 text-sm">
              O HomeCare é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de
              crianças ou adolescentes. Se identificarmos esse tipo de dado, ele será excluído.
            </Text>
          </View>

          {/* Changes to Policy */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">
              10. Alterações nesta Política
            </Text>
            <Text className="text-muted mb-3 text-sm">
              Quando esta política mudar, mostraremos a nova versão no aplicativo e pediremos seu
              aceite antes de você continuar usando o HomeCare.
            </Text>
          </View>

          {/* Contact Information */}
          <View>
            <Text className="text-content mb-3 text-lg font-bold">11. Contato</Text>

            <Text className="text-muted mb-3 text-sm">
              Se você tiver dúvidas sobre esta Política de Privacidade ou quiser exercer seus
              direitos, entre em contato com o Encarregado:
            </Text>

            <View className="space-y-2">
              <Pressable
                onPress={openEmail}
                className="bg-primary flex-row items-center rounded-lg p-3">
                <Ionicons name="mail" size={20} color={colors.onPrimary} />
                <Text className="text-on-primary ml-2 font-medium">contato@pedrorbc.com</Text>
              </Pressable>

              <Pressable
                onPress={openWebsite}
                className="bg-surface-raised flex-row items-center rounded-lg p-3">
                <Ionicons name="globe" size={20} color={colors.text} />
                <Text className="text-content ml-2 flex-1 font-medium">
                  https://pedrorbc.com/homecare/privacy
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View className="bg-surface mt-8 rounded-lg p-4">
            <Text className="text-muted text-center text-xs">
              Esta Política de Privacidade é efetiva a partir de {LAST_UPDATED} e se aplica a todos
              os usuários do aplicativo HomeCare.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
