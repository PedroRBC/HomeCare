import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { nativeApplicationVersion as AppVersion } from 'expo-application';

interface AboutScreenProps {
	navigation: any;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
	const { top: topInset } = useSafeAreaInsets();

	return (
		<View className="flex-1 bg-zinc-900">
			{/* Header */}
			<View
				className="flex-row items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3"
				style={{ paddingTop: topInset }}
			>
				<Pressable
					onPress={() => navigation.goBack()}
					className="flex-row items-center"
				>
					<Ionicons name="arrow-back" size={24} color="#ffffff" />
					<Text className="ml-2 text-lg font-semibold text-white">
						Sobre o HomeCare
					</Text>
				</Pressable>
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 20 }}
				showsVerticalScrollIndicator={false}
			>
				{/* App Info */}
				<View className="mb-8">
					<View className="items-center mb-6">
						<View className="h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 mb-4">
							<Ionicons name="home" size={40} color="#FFFFFF" />
						</View>
						<Text className="text-2xl font-bold text-zinc-50 mb-2">HomeCare</Text>
						<Text className="text-zinc-400">Versão {AppVersion}</Text>
					</View>

					<Text className="text-base text-zinc-300 leading-6 mb-6">
						HomeCare é um aplicativo desenvolvido para facilitar o gerenciamento de pagamentos
						e cuidados domiciliares. Com uma interface intuitiva e funcionalidades robustas,
						o app ajuda famílias a organizarem seus cuidadores e manterem o controle financeiro.
					</Text>
				</View>

				{/* Features */}
				<View className="mb-8">
					<Text className="text-lg font-semibold text-zinc-200 mb-4">Principais Funcionalidades</Text>

					<View className="space-y-4">
						<View className="flex-row items-start">
							<View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 mr-3 mt-0.5">
								<Ionicons name="calendar" size={14} color="#10B981" />
							</View>
							<View className="flex-1">
								<Text className="text-zinc-200 font-medium">Calendário Inteligente</Text>
								<Text className="text-zinc-400 text-sm">Organize e visualize todos os seus compromissos</Text>
							</View>
						</View>

						<View className="flex-row items-start">
							<View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 mr-3 mt-0.5">
								<Ionicons name="people" size={14} color="#10B981" />
							</View>
							<View className="flex-1">
								<Text className="text-zinc-200 font-medium">Gestão de Cuidadores</Text>
								<Text className="text-zinc-400 text-sm">Cadastre e gerencie seus profissionais de saúde</Text>
							</View>
						</View>

						<View className="flex-row items-start">
							<View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 mr-3 mt-0.5">
								<Ionicons name="card" size={14} color="#10B981" />
							</View>
							<View className="flex-1">
								<Text className="text-zinc-200 font-medium">Controle Financeiro</Text>
								<Text className="text-zinc-400 text-sm">Acompanhe pagamentos e despesas relacionadas</Text>
							</View>
						</View>

						<View className="flex-row items-start">
							<View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20 mr-3 mt-0.5">
								<Ionicons name="notifications" size={14} color="#10B981" />
							</View>
							<View className="flex-1">
								<Text className="text-zinc-200 font-medium">Lembretes Inteligentes</Text>
								<Text className="text-zinc-400 text-sm">Receba notificações sobre pagamentos e compromissos</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Technology Stack */}
				<View className="mb-8">
					<Text className="text-lg font-semibold text-zinc-200 mb-4">Tecnologias</Text>

					<View className="flex-row flex-wrap gap-2">
						<View className="bg-zinc-800 px-3 py-2 rounded-lg">
							<Text className="text-emerald-400 text-sm font-medium">React Native</Text>
						</View>
						<View className="bg-zinc-800 px-3 py-2 rounded-lg">
							<Text className="text-emerald-400 text-sm font-medium">Expo</Text>
						</View>
						<View className="bg-zinc-800 px-3 py-2 rounded-lg">
							<Text className="text-emerald-400 text-sm font-medium">Firebase</Text>
						</View>
						<View className="bg-zinc-800 px-3 py-2 rounded-lg">
							<Text className="text-emerald-400 text-sm font-medium">TypeScript</Text>
						</View>
						<View className="bg-zinc-800 px-3 py-2 rounded-lg">
							<Text className="text-emerald-400 text-sm font-medium">Tailwind CSS</Text>
						</View>
					</View>
				</View>

				{/* Footer with Lottie Animation */}
				<View className="items-center py-6">
					<View className="h-32 w-full items-center justify-center mb-4">
						<LottieView
							source={require('../../assets/animations/home-shaking.json')}
							style={{ width: 120, height: 120 }}
							autoPlay
							loop
						/>
					</View>

					<Text className="text-center text-sm text-zinc-500 mb-2">
						Desenvolvido com ❤️ para facilitar o cuidado domiciliar
					</Text>
					<Text className="text-center text-xs text-zinc-600">
						HomeCare v{AppVersion} • React Native & Expo
					</Text>
				</View>
			</ScrollView>
		</View>
	);
};
