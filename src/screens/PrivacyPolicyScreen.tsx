import React from "react";
import {
	View,
	Text,
	ScrollView,
	Pressable,
	Linking
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface PrivacyPolicyScreenProps {
	navigation: any;
}

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
	navigation,
}) => {
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	const openEmail = () => {
		Linking.openURL("mailto:contato@pedrorbc.com?subject=Privacy Policy Inquiry");
	};

	const openWebsite = () => {
		Linking.openURL("https://pedrorbc.com/privacy");
	};

	return (
		<SafeAreaView className="flex-1 bg-gray-900" style={{ backgroundColor: '#111827' }}>
			{/* Header */}
			<View
				className="flex-row items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3"
				style={{ paddingTop: topInset }}
			>
				<Pressable
					onPress={() => navigation.goBack()}
					className="flex-row items-center"
				>
					<Ionicons name="arrow-back" size={24} color="#ffffff" />
					<Text className="ml-2 text-lg font-semibold text-white">
						Política de Privacidade
					</Text>
				</Pressable>
			</View>

			<ScrollView
				contentContainerStyle={{ padding: 8, paddingBottom: bottomInset + 36 }}
			>
				<View className="space-y-6">
					{/* Introduction */}
					<View>
						<Text className="text-xl font-bold text-white mb-3">
							Política de Privacidade
						</Text>
						<Text className="text-sm text-gray-300 mb-2">
							<Text className="font-semibold">Última atualização:</Text>{" "}
							{new Date().toLocaleDateString("pt-BR")}
						</Text>
						<Text className="text-sm text-gray-300">
							Esta Política de Privacidade descreve como o HomeCare ("nós", "nosso" ou "aplicativo") coleta, usa e protege suas informações quando você usa nosso aplicativo móvel.
						</Text>
					</View>

					{/* Information We Collect */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							1. Informações que Coletamos
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							1.1 Informações de Conta
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Endereço de e-mail (obrigatório para autenticação)
							{"\n"}• Nome de exibição (opcional)
							{"\n"}• Identificador único do usuário (gerado automaticamente)
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							1.2 Dados do Aplicativo
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Informações de cuidadores (nome, frequência, valor)
							{"\n"}• Cronogramas e agendamentos
							{"\n"}• Histórico de pagamentos
							{"\n"}• Dados de casas/famílias (quando aplicável)
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							1.3 Dados de Uso e Analytics
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Telas visualizadas no aplicativo
							{"\n"}• Ações realizadas (criar cuidador, marcar pagamento, etc.)
							{"\n"}• Informações de dispositivo (tipo, versão do sistema operacional)
							{"\n"}• Dados de crash e erros (para melhorar a estabilidade)
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							1.4 Dados de Notificações
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Status de permissão de notificações
							{"\n"}• Notificações agendadas para lembretes de pagamento
						</Text>
					</View>

					{/* How We Use Information */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							2. Como Usamos Suas Informações
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							2.1 Funcionalidades do Aplicativo
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Gerenciar sua conta e autenticação
							{"\n"}• Armazenar e sincronizar seus dados de cuidadores
							{"\n"}• Manter cronogramas e agendamentos
							{"\n"}• Rastrear pagamentos e histórico
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							2.2 Melhorias e Suporte
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Analisar uso do aplicativo para melhorias
							{"\n"}• Identificar e corrigir bugs e problemas
							{"\n"}• Fornecer suporte técnico
							{"\n"}• Enviar notificações importantes sobre o serviço
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							2.3 Notificações
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Enviar lembretes de pagamentos em atraso
							{"\n"}• Notificar sobre atualizações importantes do aplicativo
						</Text>
					</View>

					{/* Data Storage and Security */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							3. Armazenamento e Segurança
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							3.1 Armazenamento de Dados
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Seus dados são armazenados no Firebase (Google Cloud Platform)
							{"\n"}• Dados são criptografados em trânsito e em repouso
							{"\n"}• Backup automático para garantir disponibilidade
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							3.2 Medidas de Segurança
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Autenticação segura com Firebase Auth
							{"\n"}• Acesso baseado em permissões por usuário
							{"\n"}• Monitoramento de segurança 24/7
							{"\n"}• Atualizações regulares de segurança
						</Text>
					</View>

					{/* Data Sharing */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							4. Compartilhamento de Dados
						</Text>

						<Text className="text-sm text-gray-300 mb-3">
							Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto nas seguintes circunstâncias:
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							4.1 Provedores de Serviços
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Firebase (Google) - para armazenamento e autenticação
							{"\n"}• Google Analytics - para análise de uso (dados anonimizados)
							{"\n"}• Google Crashlytics - para relatórios de erro (dados anonimizados)
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							4.2 Requisitos Legais
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Quando exigido por lei ou processo legal
							{"\n"}• Para proteger nossos direitos ou propriedade
							{"\n"}• Para proteger a segurança dos usuários
						</Text>
					</View>

					{/* Your Rights */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							5. Seus Direitos
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							5.1 Acesso e Controle
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Visualizar todos os seus dados no aplicativo
							{"\n"}• Editar ou atualizar suas informações
							{"\n"}• Exportar seus dados (entre em contato conosco)
							{"\n"}• Excluir sua conta e dados permanentemente
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							5.2 Notificações
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Ativar ou desativar notificações a qualquer momento
							{"\n"}• Configurar preferências de notificação
						</Text>

						<Text className="text-base font-semibold text-gray-200 mb-2">
							5.3 Exclusão de Dados
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Solicitar exclusão de dados específicos
							{"\n"}• Excluir conta completa (todos os dados serão removidos)
						</Text>
					</View>

					{/* Data Retention */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							6. Retenção de Dados
						</Text>

						<Text className="text-sm text-gray-300 mb-3">
							• Mantemos seus dados enquanto sua conta estiver ativa
							{"\n"}• Dados são excluídos permanentemente quando você exclui sua conta
							{"\n"}• Dados de analytics são anonimizados e podem ser mantidos por até 26 meses
							{"\n"}• Dados de crash são mantidos por até 90 dias
						</Text>
					</View>

					{/* Children's Privacy */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							7. Privacidade de Menores
						</Text>

						<Text className="text-sm text-gray-300 mb-3">
							Nosso aplicativo não é direcionado a menores de 13 anos. Não coletamos intencionalmente informações pessoais de menores de 13 anos. Se descobrirmos que coletamos dados de um menor de 13 anos, excluiremos essas informações imediatamente.
						</Text>
					</View>

					{/* International Users */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							8. Usuários Internacionais
						</Text>

						<Text className="text-sm text-gray-300 mb-3">
							Seus dados podem ser transferidos e processados em servidores localizados fora do seu país de residência. Ao usar nosso aplicativo, você consente com a transferência de seus dados para esses servidores.
						</Text>
					</View>

					{/* Changes to Policy */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							9. Alterações nesta Política
						</Text>

						<Text className="text-sm text-gray-300 mb-3">
							Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre mudanças significativas através do aplicativo ou por e-mail. Sua continuação no uso do aplicativo após as alterações constitui aceitação da nova política.
						</Text>
					</View>

					{/* Contact Information */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							10. Contato
						</Text>

						<Text className="text-sm text-gray-300 mb-3">
							Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus dados, entre em contato conosco:
						</Text>

						<View className="space-y-2">
							<Pressable
								onPress={openEmail}
								className="flex-row items-center rounded-lg bg-blue-600 p-3"
							>
								<Ionicons name="mail" size={20} color="#ffffff" />
								<Text className="ml-2 text-white font-medium">
									contato@pedrorbc.com
								</Text>
							</Pressable>

							<Pressable
								onPress={openWebsite}
								className="flex-row items-center rounded-lg bg-gray-700 p-3"
							>
								<Ionicons name="globe" size={20} color="#ffffff" />
								<Text className="ml-2 text-white font-medium">
									https://pedrorbc.com/privacy
								</Text>
							</Pressable>
						</View>
					</View>

					{/* Footer */}
					<View className="mt-8 p-4 bg-gray-800 rounded-lg">
						<Text className="text-xs text-gray-400 text-center">
							Esta Política de Privacidade é efetiva a partir de{" "}
							{new Date().toLocaleDateString("pt-BR")} e se aplica a todos os usuários do aplicativo HomeCare.
						</Text>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};
