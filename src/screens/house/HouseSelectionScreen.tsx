import React, { useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHouse } from '@/context/HouseContext';
import { useScreenTracking } from '@/hooks/useFirebase';
import { useAppNavigation } from '@/hooks/useAppNavigation';

interface HouseSelectionScreenProps {
	navigation: any;
}

export const HouseSelectionScreen: React.FC<HouseSelectionScreenProps> = ({ navigation }) => {
	const [isLoading, setIsLoading] = useState(false);
	const { userHouses, selectHouse, isLoading: housesLoading, invitations } = useHouse();
	const { navigateToCareManagement } = useAppNavigation();
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	// Track screen view
	useScreenTracking('HouseSelection', 'HouseSelectionScreen');

	const handleSelectHouse = async (houseId: string) => {
		try {
			setIsLoading(true);
			console.log('HouseSelectionScreen: Selecting house with ID:', houseId);
			await selectHouse(houseId);
			console.log('HouseSelectionScreen: House selected successfully, navigating to CareManagement');
			// Small delay to ensure state is updated before navigation
			setTimeout(() => {
				navigateToCareManagement();
			}, 100);
		} catch (error: any) {
			console.error('Error selecting house:', error);
			Alert.alert('Erro', 'Erro ao selecionar a casa. Tente novamente.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateHouse = () => {
		navigation.navigate('CreateHouse');
	};

	const handleViewInvitations = () => {
		navigation.navigate('HouseInvite');
	};


	const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

	if (housesLoading) {
		return (
			<View
				className="flex-1 bg-zinc-900 items-center justify-center"
				style={{
					paddingTop: topInset,
					paddingBottom: bottomInset,
				}}
			>
				<ActivityIndicator size="large" color="#10b981" />
				<Text className="text-white text-lg mt-4">Carregando casas...</Text>
			</View>
		);
	}

	return (
		<View
			className="flex-1 bg-zinc-900"
			style={{
				paddingTop: topInset + 24,
				paddingBottom: bottomInset + 16,
				paddingHorizontal: 18,
			}}
		>
			<ScrollView className="flex-1 px-6 py-8">
				{/* Header */}
				<View className="items-center mb-8">
					<View className="w-20 h-20 bg-emerald-600 rounded-full items-center justify-center mb-4">
						<Ionicons name="home" size={40} color="white" />
					</View>
					<Text className="text-2xl font-bold text-white mb-2">Selecionar Casa</Text>
					<Text className="text-zinc-400 text-center">
						Escolha uma casa para gerenciar ou crie uma nova
					</Text>
				</View>

				{/* Pending Invitations */}
				{pendingInvitations.length > 0 && (
					<View className="mb-6">
						<View className="flex-row items-center justify-between mb-4">
							<Text className="text-white text-lg font-semibold">
								Convites Pendentes ({pendingInvitations.length})
							</Text>
							<TouchableOpacity
								onPress={handleViewInvitations}
								className="bg-amber-600 rounded-lg px-3 py-1"
							>
								<Text className="text-white text-sm font-medium">Ver Todos</Text>
							</TouchableOpacity>
						</View>

						<View className="space-y-3">
							{pendingInvitations.slice(0, 2).map((invitation) => (
								<View
									key={invitation.id}
									className="bg-amber-900/20 border border-amber-700 rounded-lg p-4"
								>
									<View className="flex-row items-center justify-between">
										<View className="flex-1">
											<Text className="text-white font-semibold">
												{invitation.houseName}
											</Text>
											<Text className="text-amber-300 text-sm">
												Convidado por: {invitation.invitedByName}
											</Text>
										</View>
										<View className="bg-amber-500 rounded-full px-2 py-1">
											<Text className="text-white text-xs font-medium">
												Novo
											</Text>
										</View>
									</View>
								</View>
							))}
						</View>

						{pendingInvitations.length > 2 && (
							<TouchableOpacity
								onPress={handleViewInvitations}
								className="bg-zinc-800 rounded-lg py-3 items-center mt-3"
							>
								<Text className="text-zinc-400 text-sm">
									Ver mais {pendingInvitations.length - 2} convites
								</Text>
							</TouchableOpacity>
						)}
					</View>
				)}

				{/* Houses List */}
				<View className="mb-6">
					<Text className="text-white text-lg font-semibold mb-4">Suas Casas</Text>

					{userHouses.length === 0 ? (
						<View className="bg-zinc-800 rounded-lg p-6 items-center">
							<Ionicons name="home-outline" size={48} color="#71717a" />
							<Text className="text-zinc-400 text-center mt-4 mb-2">
								Você ainda não tem casas
							</Text>
							<Text className="text-zinc-500 text-sm text-center">
								Crie sua primeira casa para começar
							</Text>
						</View>
					) : (
						<View className="space-y-3">
							{userHouses.map((house) => (
								<TouchableOpacity
									key={house.id}
									onPress={() => handleSelectHouse(house.id)}
									disabled={isLoading}
									className="bg-zinc-800 rounded-lg p-4 border border-zinc-700"
									style={{ opacity: isLoading ? 0.7 : 1 }}
								>
									<View className="flex-row items-center justify-between">
										<View className="flex-1">
											<Text className="text-white text-lg font-semibold">
												{house.name}
											</Text>
											{house.description && (
												<Text className="text-zinc-400 text-sm mt-1">
													{house.description}
												</Text>
											)}
											<View className="flex-row items-center mt-2">
												<Ionicons name="people" size={16} color="#71717a" />
												<Text className="text-zinc-500 text-sm ml-1">
													{house.managers.length} gerente{house.managers.length !== 1 ? 's' : ''}
												</Text>
											</View>
										</View>
										<Ionicons name="chevron-forward" size={20} color="#71717a" />
									</View>
								</TouchableOpacity>
							))}
						</View>
					)}
				</View>

				{/* Action Buttons */}
				<View className="space-y-3 gap-3">
					<TouchableOpacity
						onPress={handleCreateHouse}
						disabled={isLoading}
						className="bg-emerald-600 rounded-lg py-4 items-center"
						style={{ opacity: isLoading ? 0.7 : 1 }}
					>
						<View className="flex-row items-center">
							<Ionicons name="add" size={20} color="white" />
							<Text className="text-white font-semibold text-lg ml-2">
								Criar Nova Casa
							</Text>
						</View>
					</TouchableOpacity>


					{pendingInvitations.length > 0 && (
						<TouchableOpacity
							onPress={handleViewInvitations}
							disabled={isLoading}
							className="bg-zinc-700 rounded-lg py-4 items-center"
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							<View className="flex-row items-center">
								<Ionicons name="mail" size={20} color="white" />
								<Text className="text-white font-semibold text-lg ml-2">
									Ver Convites ({pendingInvitations.length})
								</Text>
							</View>
						</TouchableOpacity>
					)}
				</View>

				{/* Help Text */}
				<View className="mt-8 p-4 bg-zinc-800 rounded-lg">
					<Text className="text-zinc-400 text-sm text-center">
						💡 Dica: Você pode compartilhar casas com outros gerentes para colaborar no gerenciamento
					</Text>
				</View>
			</ScrollView>
		</View>
	);
};
