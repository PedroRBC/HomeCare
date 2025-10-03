import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useSchedule } from "@/context/ScheduleContext";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { NotificationService } from "@/services/notificationService";
import { Card } from "@/components/Card";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeApplicationVersion as AppVersion } from "expo-application";

interface SettingsScreenProps {
	navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
	useScreenTracking("Settings", "SettingsScreen");

	const {
		isFirestoreConnected,
	} = useSchedule();
	const { user, signOut } = useAuth();
	const { showAlert } = useAlert();
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
					showAlert({
						title: "Permissão Negada",
						message: "As notificações são necessárias para lembrar sobre pagamentos em atraso.",
						icon: "warning",
						iconColor: "#f59e0b",
						buttons: [
							{
								text: "OK",
								style: "default",
							},
						],
					});
				}
			}
		} catch (error) {
			console.error("Error toggling notifications:", error);
			showAlert({
				title: "Erro",
				message: "Não foi possível alterar as configurações de notificação.",
				icon: "alert-circle",
				iconColor: "#ef4444",
				buttons: [
					{
						text: "OK",
						style: "default",
					},
				],
			});
		}
	};

	const handleDeleteAccount = () => {
		showAlert({
			title: "Excluir Conta",
			message: "Esta ação irá excluir permanentemente sua conta e todos os dados associados:\n\n• Sua conta será removida do sistema\n• Todas as casas que você possui serão excluídas\n• Você perderá acesso às casas onde é gerente\n• Todos os convites serão removidos\n\nEsta ação NÃO pode ser desfeita.",
			icon: "warning",
			iconColor: "#f59e0b",
			buttons: [
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Continuar",
					style: "destructive",
					onPress: () => {
						navigation.navigate('DeleteAccount');
					},
				},
			],
		});
	};

	const handleLogout = () => {
		showAlert({
			title: "Sair da Conta",
			message: "Tem certeza que deseja sair da sua conta?",
			icon: "log-out",
			iconColor: "#f59e0b",
			buttons: [
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Sair",
					style: "destructive",
					onPress: async () => {
						try {
							await signOut();
						} catch (error) {
							console.error("Error signing out:", error);
							showAlert({
								title: "Erro",
								message: "Não foi possível sair da conta. Tente novamente.",
								icon: "alert-circle",
								iconColor: "#ef4444",
								buttons: [
									{
										text: "OK",
										style: "default",
									},
								],
							});
						}
					},
				},
			],
		});
	};


	const showAbout = () => {
		navigation.navigate('About');
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
									icon="person-outline"
									title="Editar Perfil"
									subtitle="Alterar nome e ícone do perfil"
									onPress={() => navigation.navigate('UserProfile')}
									rightComponent={<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
								/>

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

					{/* Account Management */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Gerenciamento de Conta</Text>

						<Card variant="elevated">
							<SettingItem
								icon="person-remove-outline"
								title="Excluir Conta"
								subtitle="Remove permanentemente sua conta e todos os dados associados"
								onPress={handleDeleteAccount}
								danger
								rightComponent={<Ionicons name="chevron-forward" size={20} color="#EF4444" />}
							/>
						</Card>
					</View>

					{/* Privacy & Legal */}
					<View>
						<Text className="font-heading mb-4 text-lg text-zinc-200">Privacidade e Legal</Text>

						<Card variant="elevated">
							<SettingItem
								icon="shield-outline"
								title="Política de Privacidade"
								subtitle="Como coletamos e usamos seus dados"
								onPress={() => navigation.navigate('PrivacyPolicy')}
								rightComponent={<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
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
