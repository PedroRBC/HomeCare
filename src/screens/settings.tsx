import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, Alert } from "react-native";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useSchedule } from "@/context/ScheduleContext";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { NotificationService } from "@/services/notificationService";
import { Card } from "@/components/Card";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApplicationVersion as AppVersion } from "expo-application";

export const SettingsScreen = () => {
	useScreenTracking("Settings", "SettingsScreen");

	const {
		caregivers,
		paymentHistory,
		isFirestoreConnected,
		clearAllData: clearAllDataFromContext,
	} = useSchedule();
	const { user, signOut } = useAuth();
	const { top: topInset } = useSafeAreaInsets();
	const [notificationsEnabled, setNotificationsEnabled] = useState(false);

	// Check notification permission status
	React.useEffect(() => {
		const checkNotificationStatus = async () => {
			try {
				const { status } = await Notifications.getPermissionsAsync();
				setNotificationsEnabled(status === "granted");
			} catch (error) {
				console.error("Error checking notification status:", error);
			}
		};
		checkNotificationStatus();
	}, []);

	const toggleNotifications = async () => {
		try {
			if (notificationsEnabled) {
				// Disable notifications
				await Notifications.cancelAllScheduledNotificationsAsync();
				setNotificationsEnabled(false);
			} else {
				// Enable notifications
				const { status } = await Notifications.requestPermissionsAsync();
				if (status === "granted") {
					await NotificationService.initialize();
					setNotificationsEnabled(true);
				} else {
					Alert.alert(
						"Permissão Negada",
						"As notificações são necessárias para lembrar sobre pagamentos em atraso.",
						[{ text: "OK" }],
					);
				}
			}
		} catch (error) {
			console.error("Error toggling notifications:", error);
			Alert.alert("Erro", "Não foi possível alterar as configurações de notificação.");
		}
	};

	const clearAllData = () => {
		Alert.alert(
			"Limpar Todos os Dados",
			"Esta ação irá remover todos os cuidadores, agendamentos e histórico de pagamentos. Esta ação não pode ser desfeita.",
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Limpar",
					style: "destructive",
					onPress: async () => {
						try {
							// Show loading state
							Alert.alert(
								"Limpando Dados...",
								"Por favor, aguarde enquanto os dados são removidos.",
							);

							await clearAllDataFromContext();

							Alert.alert(
								"Dados Limpos",
								"Todos os dados foram removidos com sucesso. O aplicativo foi resetado para o estado inicial.",
								[{ text: "OK" }],
							);
						} catch (error) {
							console.error("Error clearing all data:", error);
							Alert.alert(
								"Erro",
								"Ocorreu um erro ao limpar os dados. Tente novamente ou verifique sua conexão com a internet.",
								[{ text: "OK" }],
							);
						}
					},
				},
			],
		);
	};

	const handleLogout = () => {
		Alert.alert(
			"Sair da Conta",
			"Tem certeza que deseja sair da sua conta?",
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Sair",
					style: "destructive",
					onPress: async () => {
						try {
							await signOut();
						} catch (error) {
							console.error("Error signing out:", error);
							Alert.alert("Erro", "Não foi possível sair da conta. Tente novamente.");
						}
					},
				},
			],
		);
	};

	const showAbout = () => {
		Alert.alert(
			"Sobre o HomeCare",
			"HomeCare v" +
			AppVersion +
			"\n\nUm aplicativo para gerenciar pagamentos de cuidadores.\n\nDesenvolvido com React Native e Expo.",
			[{ text: "OK" }],
		);
	};

	const SettingItem = ({
		icon,
		title,
		subtitle,
		onPress,
		rightComponent,
		danger = false,
	}: {
		icon: string;
		title: string;
		subtitle?: string;
		onPress?: () => void;
		rightComponent?: React.ReactNode;
		danger?: boolean;
	}) => (
		<Pressable
			onPress={onPress}
			className="mb-3 flex-row items-center justify-between rounded-lg bg-zinc-800 px-4 py-4"
			style={({ pressed }) => ({
				opacity: pressed ? 0.8 : 1,
			})}>
			<View className="flex-1 flex-row items-center">
				<View
					className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${danger ? "bg-red-900/40" : "bg-zinc-700"}`}>
					<Ionicons name={icon as any} size={20} color={danger ? "#EF4444" : "#9CA3AF"} />
				</View>
				<View className="flex-1">
					<Text className={`font-subtitle ${danger ? "text-red-400" : "text-zinc-200"}`}>
						{title}
					</Text>
					{subtitle && <Text className="mt-1 text-sm text-zinc-400">{subtitle}</Text>}
				</View>
			</View>
			{rightComponent}
		</Pressable>
	);

	return (
		<View className="flex-1 bg-zinc-900">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 16, paddingTop: topInset + 16 }}
				showsVerticalScrollIndicator={false}>
				{/* Header */}
				<View className="mb-8">
					<Text className="font-heading mb-2 text-2xl text-zinc-50">Configurações</Text>
					<Text className="text-zinc-400">Gerencie suas preferências e informações do app</Text>
				</View>

				<View className="gap-6">
					{/* User Information */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Conta</Text>

						<Card variant="elevated">
							<View className="gap-4">
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<Ionicons name="person-outline" size={20} color="#9CA3AF" />
										<Text className="font-subtitle text-zinc-200">Nome</Text>
									</View>
									<Text className="text-zinc-300">{user?.displayName || "Não definido"}</Text>
								</View>

								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<Ionicons name="mail-outline" size={20} color="#9CA3AF" />
										<Text className="font-subtitle text-zinc-200">Email</Text>
									</View>
									<Text className="text-zinc-300">{user?.email || "Não definido"}</Text>
								</View>

								<SettingItem
									icon="log-out-outline"
									title="Sair da Conta"
									subtitle="Fazer logout da sua conta"
									onPress={handleLogout}
									danger
									rightComponent={<Ionicons name="chevron-forward" size={20} color="#EF4444" />}
								/>
							</View>
						</Card>
					</View>

					{/* App Information */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Informações do App</Text>

						<Card variant="elevated">
							<View className="gap-4">
								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
										<Text className="font-subtitle text-zinc-200">Versão</Text>
									</View>
									<Text className="text-zinc-300">{AppVersion}</Text>
								</View>

								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<Ionicons name="people-outline" size={20} color="#9CA3AF" />
										<Text className="font-subtitle text-zinc-200">Cuidadores</Text>
									</View>
									<Text className="text-zinc-300">{caregivers.length}</Text>
								</View>

								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<Ionicons name="card-outline" size={20} color="#9CA3AF" />
										<Text className="font-subtitle text-zinc-200">Pagamentos</Text>
									</View>
									<Text className="text-zinc-300">{paymentHistory.length}</Text>
								</View>

								<View className="flex-row items-center justify-between">
									<View className="flex-row items-center gap-3">
										<Ionicons name="cloud-outline" size={20} color="#9CA3AF" />
										<Text className="font-subtitle text-zinc-200">Firebase</Text>
									</View>
									<View className="flex-row items-center gap-2">
										<View
											className={`h-2 w-2 rounded-full ${isFirestoreConnected ? "bg-emerald-400" : "bg-red-400"}`}
										/>
										<Text className="text-zinc-300">
											{isFirestoreConnected ? "Conectado" : "Desconectado"}
										</Text>
									</View>
								</View>
							</View>
						</Card>
					</View>

					{/* Notifications */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Notificações</Text>

						<Card variant="elevated">
							<SettingItem
								icon="notifications-outline"
								title="Lembretes de Pagamento"
								subtitle="Receba notificações sobre pagamentos em atraso"
								rightComponent={
									<Switch
										value={notificationsEnabled}
										onValueChange={toggleNotifications}
										trackColor={{ false: "#3F3F46", true: "#059669" }}
										thumbColor={notificationsEnabled ? "#FFFFFF" : "#9CA3AF"}
									/>
								}
							/>
						</Card>
					</View>

					{/* Data Management */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Gerenciamento de Dados</Text>

						<Card variant="elevated">
							<SettingItem
								icon="trash-outline"
								title="Limpar Todos os Dados"
								subtitle={`Remove todos os cuidadores e histórico (${__DEV__ ? "Desenvolvimento" : "Produção"})`}
								onPress={clearAllData}
								danger
								rightComponent={<Ionicons name="chevron-forward" size={20} color="#EF4444" />}
							/>
						</Card>
					</View>

					{/* About */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Sobre</Text>

						<Card variant="elevated">
							<SettingItem
								icon="information-circle-outline"
								title="Sobre o HomeCare"
								subtitle="Informações sobre o aplicativo"
								onPress={showAbout}
								rightComponent={<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
							/>
						</Card>
					</View>

					{/* Footer */}
					<View className="items-center py-8">
						<Text className="text-center text-xs text-zinc-500">
							HomeCare v{AppVersion}
							{"\n"}
							Desenvolvido com ❤️ usando React Native
						</Text>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};
