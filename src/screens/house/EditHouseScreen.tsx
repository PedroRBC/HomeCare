import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHouse } from '@/context/HouseContext';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { useScreenTracking } from '@/hooks/useFirebase';
import { House } from '@/types/house.types';
import { FirestoreService } from '@/services/firestore';

interface EditHouseScreenProps {
	navigation: any;
	route: {
		params: {
			house: House;
		};
	};
}

export const EditHouseScreen: React.FC<EditHouseScreenProps> = ({ navigation, route }) => {
	const { house } = route.params;
	const { updateHouse, deleteHouse, userRole, removeManager } = useHouse();
	const { user } = useAuth();
	const { showAlert } = useAlert();
	const { top: topInset } = useSafeAreaInsets();

	const [name, setName] = useState(house.name);
	const [description, setDescription] = useState(house.description || '');
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isRemovingManager, setIsRemovingManager] = useState(false);
	const [managerNames, setManagerNames] = useState<Map<string, string>>(new Map());

	// Track screen view
	useScreenTracking('EditHouse', 'EditHouseScreen');

	// Fetch manager names when component mounts
	useEffect(() => {
		const fetchManagerNames = async () => {
			try {
				const userIds = house.managers.map(manager => manager.userId);
				const userProfiles = await FirestoreService.getUserProfiles(userIds);
				const namesMap = new Map<string, string>();

				userProfiles.forEach((profile, userId) => {
					namesMap.set(userId, profile.displayName || profile.email || 'Usuário');
				});

				setManagerNames(namesMap);
			} catch (error) {
				console.error('Error fetching manager names:', error);
			}
		};

		fetchManagerNames();
	}, [house.managers]);

	const handleSave = async () => {
		if (!name.trim()) {
			showAlert({
				title: 'Erro',
				message: 'O nome da casa é obrigatório.',
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

		try {
			setIsLoading(true);

			// Prepare updates object, only including description if it's not empty
			const updates: Partial<House> = {
				name: name.trim(),
			};

			// Only include description if it's not empty
			if (description.trim()) {
				updates.description = description.trim();
			}

			await updateHouse(house.id, updates);

			showAlert({
				title: 'Sucesso',
				message: 'Casa atualizada com sucesso!',
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
		} catch (error) {
			console.error('Error updating house:', error);
			showAlert({
				title: 'Erro',
				message: 'Erro ao atualizar a casa. Tente novamente.',
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
	};

	const handleDelete = () => {
		showAlert({
			title: 'Excluir Casa',
			message: `Tem certeza que deseja excluir a casa "${house.name}"?\n\nEsta ação irá:\n• Remover a casa permanentemente\n• Excluir todos os dados associados\n• Remover todos os gerentes\n\nEsta ação NÃO pode ser desfeita.`,
			icon: 'trash',
			iconColor: '#ef4444',
			buttons: [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Excluir',
					style: 'destructive',
					onPress: confirmDelete,
				},
			],
		});
	};

	const confirmDelete = async () => {
		try {
			setIsDeleting(true);
			await deleteHouse(house.id);

			showAlert({
				title: 'Sucesso',
				message: 'Casa excluída com sucesso!',
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [
					{ text: 'OK', onPress: () => navigation.navigate('HouseSelection') }
				],
			});
		} catch (error) {
			console.error('Error deleting house:', error);
			showAlert({
				title: 'Erro',
				message: 'Erro ao excluir a casa. Tente novamente.',
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
			setIsDeleting(false);
		}
	};

	const canDelete = userRole === 'owner';

	const handleRemoveManager = (managerUserId: string, managerName: string) => {
		showAlert({
			title: 'Remover Gerente',
			message: `Tem certeza que deseja remover "${managerName}" da casa?\n\nEsta ação irá:\n• Remover o acesso à casa\n• Excluir todos os dados associados\n\nEsta ação NÃO pode ser desfeita.`,
			icon: 'person-remove',
			iconColor: '#ef4444',
			buttons: [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Remover',
					style: 'destructive',
					onPress: () => confirmRemoveManager(managerUserId),
				},
			],
		});
	};

	const confirmRemoveManager = async (managerUserId: string) => {
		try {
			setIsRemovingManager(true);
			await removeManager(house.id, managerUserId);

			showAlert({
				title: 'Sucesso',
				message: 'Gerente removido com sucesso!',
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [
					{
						text: 'OK',
						style: 'default',
					},
				],
			});
		} catch (error) {
			console.error('Error removing manager:', error);
			showAlert({
				title: 'Erro',
				message: 'Erro ao remover gerente. Tente novamente.',
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
			setIsRemovingManager(false);
		}
	};

	return (
		<View className="flex-1 bg-zinc-900" style={{ paddingTop: topInset }}>
			{/* Header */}
			<View className="flex-row items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3">
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					className="flex-row items-center"
				>
					<Ionicons name="arrow-back" size={24} color="#ffffff" />
					<Text className="ml-2 text-lg font-semibold text-white">
						Editar Casa
					</Text>
				</TouchableOpacity>
			</View>

			<ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
				{/* House Info */}
				<View className="mb-8">
					<View className="items-center mb-6">
						<View className="h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 mb-4">
							<Ionicons name="home" size={40} color="#FFFFFF" />
						</View>
						<Text className="text-xl font-bold text-zinc-50 mb-2">{house.name}</Text>
						<Text className="text-zinc-400 text-center">
							{house.managers.length} gerente{house.managers.length !== 1 ? 's' : ''}
						</Text>
					</View>
				</View>

				{/* Form */}
				<View className="gap-4">
					{/* Name Field */}
					<View>
						<Text className="text-zinc-200 font-medium mb-2">Nome da Casa *</Text>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="Digite o nome da casa"
							placeholderTextColor="#71717a"
							className="bg-zinc-800 text-zinc-50 rounded-lg px-4 py-3 border border-zinc-700"
							editable={!isLoading && !isDeleting}
						/>
					</View>

					{/* Description Field */}
					<View>
						<Text className="text-zinc-200 font-medium mb-2">Descrição</Text>
						<TextInput
							value={description}
							onChangeText={setDescription}
							placeholder="Digite uma descrição (opcional)"
							placeholderTextColor="#71717a"
							multiline
							numberOfLines={3}
							className="bg-zinc-800 text-zinc-50 rounded-lg px-4 py-3 border border-zinc-700"
							editable={!isLoading && !isDeleting}
							textAlignVertical="top"
						/>
					</View>

					{/* Managers List */}
					<View>
						<Text className="text-zinc-200 font-medium mb-3">Gerentes</Text>
						<View className="bg-zinc-800 rounded-lg p-4">
							{house.managers.map((manager, index) => {
								const displayName = managerNames.get(manager.userId) || manager.displayName || manager.email || 'Usuário';
								const initials = displayName.charAt(0).toUpperCase();
								const isCurrentUser = user?.uid === manager.userId;
								const canRemoveManager = userRole === 'owner' && !isCurrentUser;

								return (
									<View key={manager.userId} className="flex-row items-center justify-between py-2">
										<View className="flex-row items-center flex-1">
											<View className="h-8 w-8 bg-emerald-600 rounded-full items-center justify-center mr-3">
												<Text className="text-white font-semibold text-sm">
													{initials}
												</Text>
											</View>
											<View className="flex-1">
												<Text className="text-zinc-50 font-medium">{displayName}</Text>
												<Text className="text-zinc-400 text-sm capitalize">
													{manager.role === 'owner' ? 'Proprietário' : 'Gerente'}
													{isCurrentUser && ' (Você)'}
												</Text>
											</View>
										</View>
										<View className="flex-row items-center">
											{manager.role === 'owner' && (
												<View className="bg-emerald-600/20 px-2 py-1 rounded mr-2">
													<Text className="text-emerald-400 text-xs font-medium">
														Proprietário
													</Text>
												</View>
											)}
											{canRemoveManager && (
												<TouchableOpacity
													onPress={() => handleRemoveManager(manager.userId, displayName)}
													disabled={isRemovingManager}
													className="bg-red-600/20 p-2 rounded-full"
													style={{ opacity: isRemovingManager ? 0.7 : 1 }}
												>
													{isRemovingManager ? (
														<ActivityIndicator size="small" color="#ef4444" />
													) : (
														<Ionicons name="trash" size={16} color="#ef4444" />
													)}
												</TouchableOpacity>
											)}
										</View>
									</View>
								);
							})}
						</View>
					</View>
				</View>

				{/* Action Buttons */}
				<View className="mt-8 gap-3">
					{/* Save Button */}
					<TouchableOpacity
						onPress={handleSave}
						disabled={isLoading || isDeleting || !name.trim()}
						className="bg-emerald-600 rounded-lg py-4 items-center"
						style={{ opacity: (isLoading || isDeleting || !name.trim()) ? 0.7 : 1 }}
					>
						{isLoading ? (
							<ActivityIndicator size="small" color="#ffffff" />
						) : (
							<View className="flex-row items-center">
								<Ionicons name="checkmark" size={20} color="white" />
								<Text className="text-white font-semibold text-lg ml-2">
									Salvar Alterações
								</Text>
							</View>
						)}
					</TouchableOpacity>

					{/* Delete Button - Only for owners */}
					{canDelete && (
						<TouchableOpacity
							onPress={handleDelete}
							disabled={isLoading || isDeleting}
							className="bg-red-600 rounded-lg py-4 items-center"
							style={{ opacity: (isLoading || isDeleting) ? 0.7 : 1 }}
						>
							{isDeleting ? (
								<ActivityIndicator size="small" color="#ffffff" />
							) : (
								<View className="flex-row items-center">
									<Ionicons name="trash" size={20} color="white" />
									<Text className="text-white font-semibold text-lg ml-2">
										Excluir Casa
									</Text>
								</View>
							)}
						</TouchableOpacity>
					)}
				</View>

				{/* Warning for non-owners */}
				{!canDelete && (
					<View className="mt-6 p-4 bg-amber-900/20 border border-amber-700 rounded-lg">
						<View className="flex-row items-center mb-2">
							<Ionicons name="warning" size={20} color="#f59e0b" />
							<Text className="text-amber-400 font-medium ml-2">
								Permissão Limitada
							</Text>
						</View>
						<Text className="text-amber-300 text-sm">
							Apenas o proprietário da casa pode excluí-la. Você pode editar as informações básicas.
						</Text>
					</View>
				)}
			</ScrollView>
		</View>
	);
};
