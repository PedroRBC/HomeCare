import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHouse } from '@/context/HouseContext';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { useScreenTracking } from '@/hooks/useFirebase';
import { HouseInvitation } from '@/types/house.types';

interface HouseInviteScreenProps {
	navigation: any;
}

export const HouseInviteScreen: React.FC<HouseInviteScreenProps> = ({ navigation }) => {
	const [email, setEmail] = useState('');
	const [selectedHouseId, setSelectedHouseId] = useState<string>('');
	const [isLoading, setIsLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<'send' | 'view'>('send');

	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
	const { userHouses, sendInvitation, invitations, acceptInvitation, declineInvitation, refreshHouses } = useHouse();
	const { user } = useAuth();
	const { showAlert } = useAlert();

	// Filter houses where the current user is the owner
	const ownedHouses = userHouses.filter(house =>
		house.managers.some(manager =>
			manager.userId === user?.uid && manager.role === 'owner'
		)
	);

	useEffect(() => {
		// Refresh invitations when component mounts
		refreshHouses();
	}, [refreshHouses]);

	useScreenTracking('HouseInvite', 'HouseInviteScreen');

	const handleSendInvitation = async () => {
		if (!email.trim()) {
			showAlert({
				title: 'Erro',
				message: 'Por favor, insira um email válido.',
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

		if (!selectedHouseId) {
			showAlert({
				title: 'Erro',
				message: 'Por favor, selecione uma casa.',
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

		if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
			showAlert({
				title: 'Erro',
				message: 'Você não pode convidar a si mesmo.',
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

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email.trim())) {
			showAlert({
				title: 'Erro',
				message: 'Por favor, insira um email válido.',
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

		const selectedHouse = ownedHouses.find(house => house.id === selectedHouseId);
		if (!selectedHouse) {
			showAlert({
				title: 'Erro',
				message: 'Casa selecionada não encontrada ou você não é o proprietário.',
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [
					{
						text: 'OK',
						style: 'default',
					},
				],
			});
			return;
		}

		setIsLoading(true);
		try {
			await sendInvitation(selectedHouseId, email.trim());
			showAlert({
				title: 'Convite Enviado',
				message: `Um convite foi enviado para ${email.trim()} para a casa "${selectedHouse.name}". Eles receberão uma notificação e poderão aceitar o convite.`,
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [
					{
						text: 'OK',
						style: 'default',
						onPress: () => {
							setEmail('');
							setSelectedHouseId('');
							navigation.goBack();
						},
					},
				],
			});
		} catch (error: any) {
			showAlert({
				title: 'Erro',
				message: error.message || 'Erro ao enviar convite. Tente novamente.',
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

	const handleAcceptInvitation = async (invitation: HouseInvitation) => {
		setIsLoading(true);
		try {
			await acceptInvitation(invitation.id);
			showAlert({
				title: 'Convite Aceito',
				message: `Você agora tem acesso à casa "${invitation.houseName}".`,
				icon: 'checkmark-circle',
				iconColor: '#10b981',
				buttons: [
					{
						text: 'OK',
						style: 'default',
						onPress: () => {
							// The router will automatically navigate to the house selection screen
							// where the user can select the newly accessible house
						},
					},
				],
			});
		} catch (error: any) {
			showAlert({
				title: 'Erro',
				message: error.message || 'Erro ao aceitar convite. Tente novamente.',
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

	const handleDeclineInvitation = async (invitation: HouseInvitation) => {
		showAlert({
			title: 'Recusar Convite',
			message: `Tem certeza que deseja recusar o convite para a casa "${invitation.houseName}"?`,
			icon: 'warning',
			iconColor: '#f59e0b',
			buttons: [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Recusar',
					style: 'destructive',
					onPress: async () => {
						setIsLoading(true);
						try {
							await declineInvitation(invitation.id);
							showAlert({
								title: 'Convite Recusado',
								message: 'O convite foi recusado com sucesso.',
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
							showAlert({
								title: 'Erro',
								message: error.message || 'Erro ao recusar convite. Tente novamente.',
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

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pending':
				return '#f59e0b'; // amber-500
			case 'accepted':
				return '#10b981'; // emerald-500
			case 'declined':
				return '#ef4444'; // red-500
			case 'expired':
				return '#6b7280'; // gray-500
			default:
				return '#6b7280';
		}
	};

	const getStatusText = (status: string) => {
		switch (status) {
			case 'pending':
				return 'Pendente';
			case 'accepted':
				return 'Aceito';
			case 'declined':
				return 'Recusado';
			case 'expired':
				return 'Expirado';
			default:
				return status;
		}
	};

	const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
	const otherInvitations = invitations.filter(inv => inv.status !== 'pending');

	return (
		<View
			className="flex-1 bg-zinc-900"
			style={{
				paddingTop: topInset,
				paddingBottom: bottomInset,
			}}
		>
			<ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
				<View className="items-center mb-8">
					<Ionicons name="mail-outline" size={60} color="#10b981" className="mb-4" />
					<Text className="text-3xl font-bold text-white mb-2">Convites</Text>
					<Text className="text-zinc-400 text-center">
						Envie convites e gerencie seus convites recebidos
					</Text>
				</View>

				{/* Tab Navigation */}
				<View className="flex-row bg-zinc-800 rounded-lg p-1 mb-6">
					<TouchableOpacity
						onPress={() => setActiveTab('send')}
						className={`flex-1 py-3 rounded-md items-center ${activeTab === 'send' ? 'bg-emerald-600' : ''}`}
					>
						<Text className={`font-semibold ${activeTab === 'send' ? 'text-white' : 'text-zinc-400'}`}>
							Enviar Convite
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => setActiveTab('view')}
						className={`flex-1 py-3 rounded-md items-center ${activeTab === 'view' ? 'bg-emerald-600' : ''}`}
					>
						<Text className={`font-semibold ${activeTab === 'view' ? 'text-white' : 'text-zinc-400'}`}>
							Ver Convites ({invitations.length})
						</Text>
					</TouchableOpacity>
				</View>

				{/* Send Invite Tab */}
				{activeTab === 'send' && (
					<View className="space-y-6 gap-3">
						<View>
							<Text className="text-white text-sm font-medium mb-2">Selecionar Casa</Text>
							{ownedHouses.length === 0 ? (
								<View className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
									<View className="flex-row items-center">
										<Ionicons name="home-outline" size={24} color="#71717a" className="mr-3" />
										<View className="flex-1">
											<Text className="text-zinc-400 text-center">
												Você não possui nenhuma casa como proprietário
											</Text>
											<Text className="text-zinc-500 text-sm text-center mt-1">
												Apenas proprietários podem convidar usuários
											</Text>
											<TouchableOpacity
												onPress={() => navigation.navigate('CreateHouse')}
												className="mt-2"
											>
												<Text className="text-emerald-500 text-center font-medium">
													Criar primeira casa
												</Text>
											</TouchableOpacity>
										</View>
									</View>
								</View>
							) : (
								<>
									<View className="gap-2">
										{ownedHouses.map((house) => (
											<TouchableOpacity
												key={house.id}
												onPress={() => setSelectedHouseId(house.id)}
												className={`rounded-lg p-4 border ${selectedHouseId === house.id
													? 'bg-emerald-900/20 border-emerald-600'
													: 'bg-zinc-800 border-zinc-700'
													}`}
												disabled={isLoading}
											>
												<View className="flex-row items-center justify-between">
													<View className="flex-1">
														<Text className={`font-semibold ${selectedHouseId === house.id ? 'text-emerald-300' : 'text-white'
															}`}>
															{house.name}
														</Text>
														{house.description && (
															<Text className="text-zinc-400 text-sm mt-1">
																{house.description}
															</Text>
														)}
													</View>
													{selectedHouseId === house.id && (
														<Ionicons name="checkmark-circle" size={24} color="#10b981" />
													)}
												</View>
											</TouchableOpacity>
										))}
									</View>
									<Text className="text-zinc-500 text-xs mt-2">
										Escolha a casa para a qual deseja enviar o convite
									</Text>
								</>
							)}
						</View>

						<View>
							<Text className="text-white text-sm font-medium mb-2">Email do Usuário</Text>
							<TextInput
								className="bg-zinc-800 rounded-lg border border-zinc-700 text-white py-4 px-4"
								placeholder="usuario@exemplo.com"
								placeholderTextColor="#71717a"
								value={email}
								onChangeText={setEmail}
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								editable={!isLoading}
							/>
							<Text className="text-zinc-500 text-xs mt-1">
								O usuário receberá um convite para gerenciar a casa selecionada
							</Text>
						</View>

						<TouchableOpacity
							onPress={handleSendInvitation}
							disabled={isLoading || !selectedHouseId || ownedHouses.length === 0}
							className={`rounded-lg py-4 items-center mt-6 ${isLoading || !selectedHouseId || ownedHouses.length === 0
								? 'bg-zinc-700'
								: 'bg-emerald-600'
								}`}
							style={{ opacity: isLoading || !selectedHouseId || ownedHouses.length === 0 ? 0.7 : 1 }}
						>
							{isLoading ? (
								<ActivityIndicator color="white" />
							) : (
								<Text className="text-white font-semibold text-lg">
									{ownedHouses.length === 0 ? 'Crie uma casa como proprietário' :
										!selectedHouseId ? 'Selecione uma casa' : 'Enviar Convite'}
								</Text>
							)}
						</TouchableOpacity>
					</View>
				)}

				{/* View Invitations Tab */}
				{activeTab === 'view' && (
					<View className="space-y-6">
						{invitations.length === 0 ? (
							<View className="flex-1 justify-center items-center py-12">
								<Ionicons name="mail-open-outline" size={50} color="#a1a1aa" className="mb-4" />
								<Text className="text-zinc-400 text-lg text-center mb-6">
									Você não tem nenhum convite.
								</Text>
							</View>
						) : (
							<>
								{/* Pending Invitations */}
								{pendingInvitations.length > 0 && (
									<View>
										<Text className="text-white text-lg font-semibold mb-4">
											Convites Pendentes ({pendingInvitations.length})
										</Text>
										<View className="gap-3">
											{pendingInvitations.map((invitation) => (
												<View
													key={invitation.id}
													className="bg-zinc-800 rounded-lg p-4 border border-zinc-700"
												>
													<View className="flex-row items-start justify-between mb-3">
														<View className="flex-1">
															<Text className="text-white font-semibold text-lg">
																{invitation.houseName}
															</Text>
															<Text className="text-zinc-400 text-sm">
																Convidado por: {invitation.invitedByName}
															</Text>
															<Text className="text-zinc-500 text-xs mt-1">
																Enviado em: {formatDate(invitation.createdAt)}
															</Text>
														</View>
														<View className="bg-amber-500/20 rounded-full px-3 py-1">
															<Text className="text-amber-400 text-xs font-medium">
																{getStatusText(invitation.status)}
															</Text>
														</View>
													</View>

													<Text className="text-zinc-300 text-sm mb-4">
														Você foi convidado para gerenciar esta casa como{' '}
														<Text className="font-semibold">
															{invitation.role === 'owner' ? 'proprietário' : 'gerente'}
														</Text>
														.
													</Text>

													<View className="flex-row space-x-3">
														<TouchableOpacity
															onPress={() => handleAcceptInvitation(invitation)}
															disabled={isLoading}
															className="flex-1 bg-emerald-600 rounded-lg py-3 items-center"
															style={{ opacity: isLoading ? 0.7 : 1 }}
														>
															<Text className="text-white font-semibold">Aceitar</Text>
														</TouchableOpacity>
														<TouchableOpacity
															onPress={() => handleDeclineInvitation(invitation)}
															disabled={isLoading}
															className="flex-1 bg-zinc-700 rounded-lg py-3 items-center"
															style={{ opacity: isLoading ? 0.7 : 1 }}
														>
															<Text className="text-white font-semibold">Recusar</Text>
														</TouchableOpacity>
													</View>
												</View>
											))}
										</View>
									</View>
								)}

								{/* Other Invitations */}
								{otherInvitations.length > 0 && (
									<View>
										<Text className="text-white text-lg font-semibold mb-4">
											Histórico de Convites ({otherInvitations.length})
										</Text>
										<View className="space-y-3">
											{otherInvitations.map((invitation) => (
												<View
													key={invitation.id}
													className="bg-zinc-800 rounded-lg p-4 border border-zinc-700"
												>
													<View className="flex-row items-start justify-between mb-3">
														<View className="flex-1">
															<Text className="text-white font-semibold text-lg">
																{invitation.houseName}
															</Text>
															<Text className="text-zinc-400 text-sm">
																Convidado por: {invitation.invitedByName}
															</Text>
															<Text className="text-zinc-500 text-xs mt-1">
																Enviado em: {formatDate(invitation.createdAt)}
															</Text>
														</View>
														<View
															className="rounded-full px-3 py-1"
															style={{
																backgroundColor: `${getStatusColor(invitation.status)}20`,
															}}
														>
															<Text
																className="text-xs font-medium"
																style={{ color: getStatusColor(invitation.status) }}
															>
																{getStatusText(invitation.status)}
															</Text>
														</View>
													</View>

													<Text className="text-zinc-300 text-sm">
														Convite para ser{' '}
														<Text className="font-semibold">
															{invitation.role === 'owner' ? 'proprietário' : 'gerente'}
														</Text>
														.
													</Text>
												</View>
											))}
										</View>
									</View>
								)}
							</>
						)}
					</View>
				)}

				<TouchableOpacity
					onPress={() => navigation.goBack()}
					disabled={isLoading}
					className="py-3 items-center mt-6"
				>
					<Text className="text-zinc-400 text-base">Voltar</Text>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};
