import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { useScreenTracking } from '@/hooks/useFirebase';

interface DeleteAccountScreenProps {
	navigation: any;
}

export const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({ navigation }) => {
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
	const { user, deleteAccount } = useAuth();
	const { showAlert } = useAlert();

	useScreenTracking('DeleteAccount', 'DeleteAccountScreen');

	const handleDeleteAccount = async () => {
		if (!password || password.trim() === '') {
			showAlert({
				title: 'Erro',
				message: 'Por favor, digite sua senha para confirmar a exclusão da conta.',
				icon: 'warning',
				iconColor: '#f59e0b',
				buttons: [
					{
						text: 'OK',
						style: 'default',
					},
				],
			});
			return;
		}

		// Final confirmation
		showAlert({
			title: 'Confirmação Final',
			message: 'Tem certeza absoluta que deseja excluir sua conta? Esta ação é irreversível e irá:\n\n• Remover sua conta permanentemente\n• Excluir todas as casas que você possui\n• Remover seu acesso às casas onde é gerente\n• Deletar todos os convites',
			icon: 'warning',
			iconColor: '#f59e0b',
			buttons: [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Sim, Excluir',
					style: 'destructive',
					onPress: async () => {
						try {
							setIsLoading(true);

							await deleteAccount(password.trim());

							showAlert({
								title: 'Conta Excluída',
								message: 'Sua conta foi excluída com sucesso. Obrigado por usar o HomeCare.',
								icon: 'checkmark-circle',
								iconColor: '#10b981',
								buttons: [
									{
										text: 'OK',
										style: 'default',
									},
								],
							});
						} catch (error: any) {
							console.error('Error deleting account:', error);
							showAlert({
								title: 'Erro',
								message: error.message || 'Ocorreu um erro ao excluir sua conta. Tente novamente ou verifique sua conexão com a internet.',
								icon: 'alert-circle',
								iconColor: '#ef4444',
								buttons: [
									{
										text: 'OK',
										style: 'default',
									},
								],
							});
						} finally {
							setIsLoading(false);
						}
					},
				},
			],
		});
	};

	return (
		<View
			className="flex-1 bg-zinc-900"
			style={{
				paddingTop: topInset,
				paddingBottom: bottomInset,
			}}
		>
			<ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
				{/* Header */}
				<View className="items-center mb-8">
					<Ionicons name="person-remove-outline" size={60} color="#EF4444" className="mb-4" />
					<Text className="text-3xl font-bold text-white mb-2">Excluir Conta</Text>
					<Text className="text-zinc-400 text-center">
						Confirme sua senha para excluir permanentemente sua conta
					</Text>
				</View>

				{/* Warning Card */}
				<View className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
					<View className="flex-row items-start">
						<Ionicons name="warning-outline" size={24} color="#EF4444" className="mr-3 mt-1" />
						<View className="flex-1">
							<Text className="text-red-400 font-semibold text-lg mb-2">Atenção!</Text>
							<Text className="text-red-300 text-sm leading-5">
								Esta ação é irreversível. Ao excluir sua conta:
							</Text>
							<Text className="text-red-300 text-sm mt-2 leading-5">
								• Sua conta será removida permanentemente{'\n'}
								• Todas as casas que você possui serão excluídas{'\n'}
								• Você perderá acesso às casas onde é gerente{'\n'}
								• Todos os convites serão removidos{'\n'}
								• Todos os dados serão perdidos
							</Text>
						</View>
					</View>
				</View>

				{/* User Info */}
				<View className="bg-zinc-800 rounded-lg p-4 mb-6">
					<Text className="text-white font-semibold text-lg mb-3">Informações da Conta</Text>
					<View className="space-y-2">
						<View className="flex-row items-center">
							<Ionicons name="person-outline" size={20} color="#9CA3AF" className="mr-3" />
							<Text className="text-zinc-300">Nome: {user?.displayName || 'Não definido'}</Text>
						</View>
						<View className="flex-row items-center">
							<Ionicons name="mail-outline" size={20} color="#9CA3AF" className="mr-3" />
							<Text className="text-zinc-300">Email: {user?.email || 'Não definido'}</Text>
						</View>
					</View>
				</View>

				{/* Password Input */}
				<View className="mb-6">
					<Text className="text-white text-sm font-medium mb-2">Confirmar Senha</Text>
					<View className="relative">
						<TextInput
							className="bg-zinc-800 rounded-lg border border-zinc-700 text-white py-4 px-4 pr-12"
							placeholder="Digite sua senha atual"
							placeholderTextColor="#71717a"
							value={password}
							onChangeText={setPassword}
							secureTextEntry={!showPassword}
							autoCapitalize="none"
							autoCorrect={false}
							editable={!isLoading}
						/>
						<TouchableOpacity
							onPress={() => setShowPassword(!showPassword)}
							className="absolute right-3 top-1/2 -translate-y-1/2"
							disabled={isLoading}
						>
							<Ionicons
								name={showPassword ? "eye-off-outline" : "eye-outline"}
								size={20}
								color="#9CA3AF"
							/>
						</TouchableOpacity>
					</View>
					<Text className="text-zinc-500 text-xs mt-1">
						Digite sua senha atual para confirmar a exclusão da conta
					</Text>
				</View>

				{/* Action Buttons */}
				<View className="space-y-3">
					<TouchableOpacity
						onPress={handleDeleteAccount}
						disabled={isLoading || !password.trim()}
						className={`rounded-lg py-4 items-center ${isLoading || !password.trim()
							? 'bg-zinc-700'
							: 'bg-red-600'
							}`}
						style={{ opacity: isLoading || !password.trim() ? 0.7 : 1 }}
					>
						{isLoading ? (
							<ActivityIndicator color="white" />
						) : (
							<Text className="text-white font-semibold text-lg">
								Excluir Conta Permanentemente
							</Text>
						)}
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => navigation.goBack()}
						disabled={isLoading}
						className="py-3 items-center"
					>
						<Text className="text-zinc-400 text-base">Cancelar</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
};
