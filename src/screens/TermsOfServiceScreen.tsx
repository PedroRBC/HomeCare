import React from "react";
import {
	View,
	Text,
	ScrollView,
	Pressable,
	Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface TermsOfServiceScreenProps {
	navigation: any;
}

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
	navigation,
}) => {
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	const openEmail = () => {
		Linking.openURL("mailto:support@homecare.app?subject=Terms of Service Inquiry");
	};

	return (
		<SafeAreaView className="flex-1" style={{ backgroundColor: '#111827' }}>
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
						Termos de Uso
					</Text>
				</Pressable>
			</View>

			<ScrollView
				className="flex-1"
				style={{ backgroundColor: '#111827', padding: 8 }}
				contentContainerStyle={{ paddingBottom: bottomInset + 36 }}
			>
				<View className="space-y-6">
					{/* Introduction */}
					<View>
						<Text className="text-xl font-bold text-white mb-3">
							Termos de Uso
						</Text>
						<Text className="text-sm text-gray-300 mb-2">
							<Text className="font-semibold">Última atualização:</Text>{" "}
							{new Date().toLocaleDateString("pt-BR")}
						</Text>
						<Text className="text-sm text-gray-300">
							Estes Termos de Uso regem o uso do aplicativo HomeCare ("aplicativo", "serviço") operado por nós ("nós", "nosso" ou "empresa").
						</Text>
					</View>

					{/* Acceptance of Terms */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							1. Aceitação dos Termos
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Ao acessar e usar este aplicativo, você aceita estar vinculado aos termos e condições de uso aqui estabelecidos. Se você não concordar com qualquer parte destes termos, não deve usar nosso serviço.
						</Text>
					</View>

					{/* Description of Service */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							2. Descrição do Serviço
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							O HomeCare é um aplicativo móvel que permite aos usuários:
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Gerenciar informações de cuidadores
							{"\n"}• Criar e manter cronogramas de cuidados
							{"\n"}• Rastrear pagamentos e histórico financeiro
							{"\n"}• Receber notificações sobre pagamentos em atraso
							{"\n"}• Colaborar com outros membros da família
						</Text>
					</View>

					{/* User Responsibilities */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							3. Responsabilidades do Usuário
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Você concorda em:
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Fornecer informações precisas e atualizadas
							{"\n"}• Manter a confidencialidade de sua conta
							{"\n"}• Usar o aplicativo apenas para fins legais
							{"\n"}• Não interferir no funcionamento do serviço
							{"\n"}• Respeitar os direitos de outros usuários
						</Text>
					</View>

					{/* Prohibited Uses */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							4. Usos Proibidos
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Você não pode usar nosso aplicativo:
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							• Para qualquer propósito ilegal ou não autorizado
							{"\n"}• Para transmitir vírus ou código malicioso
							{"\n"}• Para coletar informações de outros usuários
							{"\n"}• Para tentar acessar contas de outros usuários
							{"\n"}• Para qualquer atividade que viole estes termos
						</Text>
					</View>

					{/* Privacy and Data */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							5. Privacidade e Dados
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Seu uso do aplicativo também é regido por nossa Política de Privacidade. Ao usar nosso serviço, você concorda com a coleta e uso de informações conforme descrito na Política de Privacidade.
						</Text>
					</View>

					{/* Service Availability */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							6. Disponibilidade do Serviço
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Nos esforçamos para manter o serviço disponível 24/7, mas não garantimos disponibilidade ininterrupta. Podemos interromper o serviço para manutenção, atualizações ou por motivos técnicos.
						</Text>
					</View>

					{/* Limitation of Liability */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							7. Limitação de Responsabilidade
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Em nenhuma circunstância seremos responsáveis por danos diretos, indiretos, incidentais, especiais ou consequenciais resultantes do uso ou incapacidade de usar nosso serviço.
						</Text>
					</View>

					{/* Changes to Terms */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							8. Alterações nos Termos
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação. Seu uso continuado do serviço constitui aceitação dos novos termos.
						</Text>
					</View>

					{/* Termination */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							9. Rescisão
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Podemos suspender ou encerrar sua conta a qualquer momento, com ou sem aviso, por violação destes termos ou por qualquer outro motivo a nosso critério.
						</Text>
					</View>

					{/* Governing Law */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							10. Lei Aplicável
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Estes termos são regidos pelas leis do Brasil. Qualquer disputa será resolvida nos tribunais competentes do Brasil.
						</Text>
					</View>

					{/* Contact Information */}
					<View>
						<Text className="text-lg font-bold text-white mb-3">
							11. Contato
						</Text>
						<Text className="text-sm text-gray-300 mb-3">
							Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco:
						</Text>

						<Pressable
							onPress={openEmail}
							className="flex-row items-center rounded-lg bg-blue-600 p-3"
						>
							<Ionicons name="mail" size={20} color="#ffffff" />
							<Text className="ml-2 text-white font-medium">
								contato@pedrorbc.com
							</Text>
						</Pressable>
					</View>

					{/* Footer */}
					<View className="mt-8 p-4 bg-gray-800 rounded-lg">
						<Text className="text-xs text-gray-400 text-center">
							Estes Termos de Uso são efetivos a partir de{" "}
							{new Date().toLocaleDateString("pt-BR")} e se aplicam a todos os usuários do aplicativo HomeCare.
						</Text>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};
