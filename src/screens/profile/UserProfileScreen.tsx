import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { useScreenTracking } from '@/hooks/useFirebase';

interface UserProfileScreenProps {
	navigation: any;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ navigation }) => {
	const [displayName, setDisplayName] = useState('');
	const [isSaving, setIsSaving] = useState(false);

	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
	const { user, updateProfile } = useAuth();
	const { showAlert } = useAlert();

	useScreenTracking('UserProfile', 'UserProfileScreen');

	useEffect(() => {
		if (user?.displayName) {
			setDisplayName(user.displayName);
		} else if (user?.email) {
			// Use email prefix as fallback
			setDisplayName(user.email.split('@')[0]);
		}
	}, [user]);

	const handleSaveProfile = async () => {
		if (!displayName.trim()) {
			showAlert({
				title: 'Erro',
				message: 'O nome é obrigatório.',
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

		if (displayName.trim() === user?.displayName) {
			showAlert({
				title: 'Informação',
				message: 'Nenhuma alteração foi feita.',
				icon: 'information-circle',
				iconColor: '#3b82f6',
				buttons: [
					{
						text: 'OK',
						style: 'default',
					},
				],
			});
			return;
		}

		setIsSaving(true);
		try {
			await updateProfile({ displayName: displayName.trim() });
			showAlert({
				title: 'Sucesso',
				message: 'Perfil atualizado com sucesso!',
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [
					{
						text: 'OK',
						style: 'default',
						onPress: () => navigation.goBack(),
					},
				],
			});
		} catch (error: any) {
			showAlert({
				title: 'Erro',
				message: error.message || 'Erro ao atualizar perfil. Tente novamente.',
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
			setIsSaving(false);
		}
	};

	const handleChangeIcon = () => {
		showAlert({
			title: 'Alterar Ícone',
			message: 'Em breve você poderá escolher um ícone personalizado para seu perfil.',
			icon: 'information-circle',
			iconColor: '#3b82f6',
			buttons: [
				{
					text: 'OK',
					style: 'default',
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
				<View className="flex-row items-center justify-between mb-8">
					<TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
						<Ionicons name="arrow-back" size={28} color="#a1a1aa" />
					</TouchableOpacity>
					<Text className="text-2xl font-bold text-white flex-1 text-center mr-10">Meu Perfil</Text>
				</View>

				{/* Profile Icon Section */}
				<View className="items-center mb-8">
					<TouchableOpacity
						onPress={handleChangeIcon}
						className="w-24 h-24 bg-zinc-800 rounded-full items-center justify-center border-2 border-zinc-700"
						disabled={isSaving}
					>
						<Ionicons name="person" size={40} color="#a1a1aa" />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={handleChangeIcon}
						className="mt-3"
						disabled={isSaving}
					>
						<Text className="text-emerald-500 text-sm font-medium">Alterar Ícone</Text>
					</TouchableOpacity>
				</View>

				{/* Profile Information */}
				<View className="space-y-6">
					<View>
						<Text className="text-white text-sm font-medium mb-2">Nome de Exibição</Text>
						<TextInput
							className="bg-zinc-800 rounded-lg border border-zinc-700 text-white py-4 px-4"
							placeholder="Seu nome"
							placeholderTextColor="#71717a"
							value={displayName}
							onChangeText={setDisplayName}
							editable={!isSaving}
							maxLength={50}
						/>
						<Text className="text-zinc-500 text-xs mt-1">
							Este nome será exibido para outros usuários
						</Text>
					</View>

					<View>
						<Text className="text-white text-sm font-medium mb-2">Email</Text>
						<View className="bg-zinc-800 rounded-lg border border-zinc-700 py-4 px-4">
							<Text className="text-zinc-400">
								{user?.email || 'Não disponível'}
							</Text>
						</View>
						<Text className="text-zinc-500 text-xs mt-1">
							O email não pode ser alterado
						</Text>
					</View>

					{/* Information Card */}
					<View className="bg-zinc-800 rounded-lg p-4">
						<View className="flex-row items-center mb-3">
							<Ionicons name="information-circle-outline" size={20} color="#10b981" className="mr-2" />
							<Text className="text-white font-medium">Sobre o Perfil</Text>
						</View>
						<Text className="text-zinc-400 text-sm leading-5">
							• Seu nome será exibido em convites e notificações{'\n'}
							• Outros usuários verão seu nome ao gerenciar casas{'\n'}
							• Você pode alterar seu nome a qualquer momento
						</Text>
					</View>

					{/* Save Button */}
					<TouchableOpacity
						onPress={handleSaveProfile}
						disabled={isSaving || !displayName.trim()}
						className={`rounded-lg py-4 items-center mt-6 ${isSaving || !displayName.trim()
							? 'bg-zinc-700'
							: 'bg-emerald-600'
							}`}
						style={{ opacity: isSaving || !displayName.trim() ? 0.7 : 1 }}
					>
						{isSaving ? (
							<ActivityIndicator color="white" />
						) : (
							<Text className="text-white font-semibold text-lg">Salvar Alterações</Text>
						)}
					</TouchableOpacity>

					{/* Cancel Button */}
					<TouchableOpacity
						onPress={() => navigation.goBack()}
						disabled={isSaving}
						className="py-3 items-center"
					>
						<Text className="text-zinc-400 text-base">Cancelar</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
};
