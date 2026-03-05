import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Card } from '@/components/Card';

export const AccountManagementScreen = () => {

	const { user, linkWithGoogle, unlinkProvider, setPasswordForGoogleAccount, updatePassword } = useAuth();
	const { showAlert } = useAlert();
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	const [showPasswordForm, setShowPasswordForm] = useState(false);
	const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	// Form states
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPasswordUpdate, setNewPasswordUpdate] = useState('');
	const [confirmPasswordUpdate, setConfirmPasswordUpdate] = useState('');

	if (!user) {
		return (
			<View className="flex-1 bg-zinc-900 items-center justify-center">
				<Text className="text-zinc-400">Nenhum usuário logado</Text>
			</View>
		);
	}

	const hasGoogle = user.providers.includes('google.com');
	const hasPassword = user.hasPassword;

	// ✅ Vincular Google
	const handleLinkGoogle = async (idToken: string) => {
		try {
			setIsLoading(true);
			await linkWithGoogle(idToken);
			showAlert({
				title: 'Sucesso',
				message: 'Conta Google vinculada com sucesso! Agora você pode fazer login com Google.',
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} catch (error: any) {
			showAlert({
				title: 'Erro',
				message: error.message || 'Erro ao vincular conta Google',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} finally {
			setIsLoading(false);
		}
	};

	// ❌ Desvincular Google
	const handleUnlinkGoogle = () => {
		if (user.providers.length <= 1) {
			showAlert({
				title: 'Erro',
				message: 'Você precisa ter pelo menos um método de login. Vinculue outro método antes de desvincular este.',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
			return;
		}

		showAlert({
			title: 'Desvincular Google',
			message: 'Tem certeza que deseja desvincular sua conta Google? Você ainda poderá fazer login com seu método principal.',
			icon: 'unlink',
			iconColor: '#f59e0b',
			buttons: [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Desvincular',
					style: 'destructive',
					onPress: async () => {
						try {
							setIsLoading(true);
							await unlinkProvider('google.com');
							showAlert({
								title: 'Sucesso',
								message: 'Conta Google desvinculada com sucesso',
								icon: 'checkmark-circle',
								iconColor: '#10b981',
								buttons: [{ text: 'OK', style: 'default' }],
							});
						} catch (error: any) {
							showAlert({
								title: 'Erro',
								message: error.message || 'Erro ao desvincular',
								icon: 'alert-circle',
								iconColor: '#ef4444',
								buttons: [{ text: 'OK', style: 'default' }],
							});
						} finally {
							setIsLoading(false);
						}
					},
				},
			],
		});
	};

	// ✅ Configurar Senha (para conta Google)
	const handleSetPassword = async () => {
		if (newPassword.length < 6) {
			showAlert({
				title: 'Erro',
				message: 'A senha deve ter pelo menos 6 caracteres',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
			return;
		}

		if (newPassword !== confirmPassword) {
			showAlert({
				title: 'Erro',
				message: 'As senhas não coincidem',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
			return;
		}

		try {
			setIsLoading(true);
			await setPasswordForGoogleAccount(newPassword);
			setShowPasswordForm(false);
			setNewPassword('');
			setConfirmPassword('');
			showAlert({
				title: 'Sucesso',
				message: 'Senha configurada com sucesso! Agora você pode fazer login com email e senha também.',
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} catch (error: any) {
			showAlert({
				title: 'Erro',
				message: error.message || 'Erro ao configurar senha',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} finally {
			setIsLoading(false);
		}
	};

	// ✅ Atualizar Senha (para quem já tem senha)
	const handleUpdatePassword = async () => {
		if (!currentPassword) {
			showAlert({
				title: 'Erro',
				message: 'Digite a senha atual',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
			return;
		}

		if (newPasswordUpdate.length < 6) {
			showAlert({
				title: 'Erro',
				message: 'A nova senha deve ter pelo menos 6 caracteres',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
			return;
		}

		if (newPasswordUpdate !== confirmPasswordUpdate) {
			showAlert({
				title: 'Erro',
				message: 'As novas senhas não coincidem',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
			return;
		}

		try {
			setIsLoading(true);
			await updatePassword(currentPassword, newPasswordUpdate);
			setShowChangePasswordForm(false);
			setCurrentPassword('');
			setNewPasswordUpdate('');
			setConfirmPasswordUpdate('');
			showAlert({
				title: 'Sucesso',
				message: 'Senha alterada com sucesso!',
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} catch (error: any) {
			showAlert({
				title: 'Erro',
				message: error.message || 'Erro ao alterar senha',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleError = (error: Error) => {
		showAlert({
			title: 'Erro',
			message: 'Não foi possível vincular Google',
			icon: 'alert-circle',
			iconColor: '#ef4444',
			buttons: [{ text: 'OK', style: 'default' }],
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
			<ScrollView
				className="flex-1 px-6"
				contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Header */}
				<View className="mb-8">
					<Text className="text-2xl font-bold text-white mb-2">Gerenciar Conta</Text>
					<Text className="text-zinc-400">Métodos de login e segurança</Text>
				</View>

				{/* Métodos de Login */}
				<Card variant="elevated" className="mb-6">
					<Text className="text-white font-semibold mb-6">Métodos de Login</Text>

					{/* Email/Senha */}
					<View className="mb-6 pb-6 border-b border-zinc-700">
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center flex-1">
								<View className="w-12 h-12 bg-emerald-600/20 rounded-full items-center justify-center mr-4">
									<Ionicons name="mail" size={24} color="#10b981" />
								</View>
								<View className="flex-1">
									<Text className="text-white font-medium">Email e Senha</Text>
									<Text className="text-xs text-zinc-400 mt-1">{user.email}</Text>
								</View>
							</View>
							<View className="items-center">
								{hasPassword ? (
									<Ionicons name="checkmark-circle" size={24} color="#10b981" />
								) : (
									<Text className="text-xs text-zinc-400">Não configurado</Text>
								)}
							</View>
						</View>

						{/* Botões para Senha */}
						<View className="flex-row gap-2 mt-4">
							{hasPassword ? (
								<TouchableOpacity
									onPress={() => setShowChangePasswordForm(true)}
									disabled={isLoading}
									className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-3 items-center"
								>
									<Text className="text-white text-sm font-medium">Alterar Senha</Text>
								</TouchableOpacity>
							) : (
								<TouchableOpacity
									onPress={() => setShowPasswordForm(true)}
									disabled={isLoading}
									className="flex-1 bg-emerald-600 rounded-lg py-3 items-center"
								>
									<Text className="text-white text-sm font-medium">Configurar Senha</Text>
								</TouchableOpacity>
							)}
						</View>
					</View>

					{/* Google */}
					<View>
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center flex-1">
								<View className="w-12 h-12 bg-blue-600/20 rounded-full items-center justify-center mr-4">
									<Ionicons name="logo-google" size={24} color="#3b82f6" />
								</View>
								<View className="flex-1">
									<Text className="text-white font-medium">Google</Text>
									<Text className="text-xs text-zinc-400 mt-1">
										{hasGoogle ? 'Vinculado' : 'Não vinculado'}
									</Text>
								</View>
							</View>
							<View className="items-center">
								{hasGoogle ? (
									<Ionicons name="checkmark-circle" size={24} color="#10b981" />
								) : (
									<Text className="text-xs text-zinc-400">Não vinculado</Text>
								)}
							</View>
						</View>

						{/* Botões Google */}
						<View className="mt-4">
							{hasGoogle ? (
								<TouchableOpacity
									onPress={handleUnlinkGoogle}
									disabled={isLoading || user.providers.length <= 1}
									className={`rounded-lg py-3 items-center ${user.providers.length <= 1 ? 'bg-red-600/30' : 'bg-red-600'}`}
								>
									{isLoading ? (
										<ActivityIndicator color="white" />
									) : (
										<Text className="text-white text-sm font-medium">Desvincular</Text>
									)}
								</TouchableOpacity>
							) : (
								<GoogleSignInButton
									mode="link"
									onSuccess={handleLinkGoogle}
									onError={handleGoogleError}
									disabled={isLoading}
								/>
							)}
						</View>
					</View>
				</Card>

				{/* Form Configurar Senha (Google → Senha) */}
				{showPasswordForm && !hasPassword && (
					<Card variant="elevated" className="mb-6">
						<View className="flex-row items-center justify-between mb-4">
							<Text className="text-white font-semibold flex-1">Configurar Senha</Text>
							<TouchableOpacity
								onPress={() => {
									setShowPasswordForm(false);
									setNewPassword('');
									setConfirmPassword('');
								}}
								disabled={isLoading}
							>
								<Ionicons name="close" size={24} color="#9ca3af" />
							</TouchableOpacity>
						</View>

						<Text className="text-zinc-400 text-sm mb-6">
							Configure uma senha para poder fazer login sem depender do Google
						</Text>

						<View className="gap-4 mb-6">
							<View>
								<Text className="text-zinc-300 text-sm font-medium mb-2">Nova Senha</Text>
								<TextInput
									className="bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700"
									placeholder="Mínimo 6 caracteres"
									placeholderTextColor="#71717a"
									secureTextEntry
									value={newPassword}
									onChangeText={setNewPassword}
									editable={!isLoading}
								/>
							</View>

							<View>
								<Text className="text-zinc-300 text-sm font-medium mb-2">Confirmar Senha</Text>
								<TextInput
									className="bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700"
									placeholder="Repita a senha"
									placeholderTextColor="#71717a"
									secureTextEntry
									value={confirmPassword}
									onChangeText={setConfirmPassword}
									editable={!isLoading}
								/>
							</View>
						</View>

						<View className="flex-row gap-3">
							<TouchableOpacity
								onPress={() => {
									setShowPasswordForm(false);
									setNewPassword('');
									setConfirmPassword('');
								}}
								disabled={isLoading}
								className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-3 items-center"
							>
								<Text className="text-white font-medium">Cancelar</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleSetPassword}
								disabled={isLoading}
								className="flex-1 bg-emerald-600 rounded-lg py-3 items-center"
							>
								{isLoading ? (
									<ActivityIndicator color="white" />
								) : (
									<Text className="text-white font-semibold">Confirmar</Text>
								)}
							</TouchableOpacity>
						</View>
					</Card>
				)}

				{/* Form Alterar Senha (existente) */}
				{showChangePasswordForm && hasPassword && (
					<Card variant="elevated" className="mb-6">
						<View className="flex-row items-center justify-between mb-4">
							<Text className="text-white font-semibold flex-1">Alterar Senha</Text>
							<TouchableOpacity
								onPress={() => {
									setShowChangePasswordForm(false);
									setCurrentPassword('');
									setNewPasswordUpdate('');
									setConfirmPasswordUpdate('');
								}}
								disabled={isLoading}
							>
								<Ionicons name="close" size={24} color="#9ca3af" />
							</TouchableOpacity>
						</View>

						<View className="gap-4 mb-6">
							<View>
								<Text className="text-zinc-300 text-sm font-medium mb-2">Senha Atual</Text>
								<TextInput
									className="bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700"
									placeholder="Sua senha atual"
									placeholderTextColor="#71717a"
									secureTextEntry
									value={currentPassword}
									onChangeText={setCurrentPassword}
									editable={!isLoading}
								/>
							</View>

							<View>
								<Text className="text-zinc-300 text-sm font-medium mb-2">Nova Senha</Text>
								<TextInput
									className="bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700"
									placeholder="Mínimo 6 caracteres"
									placeholderTextColor="#71717a"
									secureTextEntry
									value={newPasswordUpdate}
									onChangeText={setNewPasswordUpdate}
									editable={!isLoading}
								/>
							</View>

							<View>
								<Text className="text-zinc-300 text-sm font-medium mb-2">Confirmar Nova Senha</Text>
								<TextInput
									className="bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700"
									placeholder="Repita a senha"
									placeholderTextColor="#71717a"
									secureTextEntry
									value={confirmPasswordUpdate}
									onChangeText={setConfirmPasswordUpdate}
									editable={!isLoading}
								/>
							</View>
						</View>

						<View className="flex-row gap-3">
							<TouchableOpacity
								onPress={() => {
									setShowChangePasswordForm(false);
									setCurrentPassword('');
									setNewPasswordUpdate('');
									setConfirmPasswordUpdate('');
								}}
								disabled={isLoading}
								className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-3 items-center"
							>
								<Text className="text-white font-medium">Cancelar</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={handleUpdatePassword}
								disabled={isLoading}
								className="flex-1 bg-emerald-600 rounded-lg py-3 items-center"
							>
								{isLoading ? (
									<ActivityIndicator color="white" />
								) : (
									<Text className="text-white font-semibold">Atualizar</Text>
								)}
							</TouchableOpacity>
						</View>
					</Card>
				)}

				{/* Info Card */}
				<Card variant="outlined" className="bg-blue-900/20 border-blue-700/50">
					<View className="flex-row gap-3">
						<View className="pt-1">
							<Ionicons name="information-circle" size={20} color="#3b82f6" />
						</View>
						<View className="flex-1">
							<Text className="text-blue-300 text-sm leading-5">
								Recomendamos vincular múltiplos métodos de login para garantir acesso à sua conta em qualquer situação.
							</Text>
						</View>
					</View>
				</Card>
			</ScrollView>
		</View>
	);
};
