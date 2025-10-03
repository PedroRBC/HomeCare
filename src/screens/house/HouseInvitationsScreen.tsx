import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHouse } from '@/context/HouseContext';
import { useScreenTracking } from '@/hooks/useFirebase';
import { HouseInvitation } from '@/types/house.types';

interface HouseInvitationsScreenProps {
	navigation: any;
}

export const HouseInvitationsScreen: React.FC<HouseInvitationsScreenProps> = ({ navigation }) => {
	const [isLoading, setIsLoading] = useState(false);

	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
	const { invitations, acceptInvitation, declineInvitation, refreshHouses } = useHouse();

	useScreenTracking('HouseInvitations', 'HouseInvitationsScreen');

	useEffect(() => {
		// Refresh invitations when component mounts
		refreshHouses();
	}, [refreshHouses]);

	const handleAcceptInvitation = async (invitation: HouseInvitation) => {
		setIsLoading(true);
		try {
			await acceptInvitation(invitation.id);
			Alert.alert(
				'Convite Aceito',
				`Você agora tem acesso à casa &ldquo;${invitation.houseName}&rdquo;.`,
				[
					{
						text: 'OK',
						onPress: () => {
							// The router will automatically navigate to the house selection screen
							// where the user can select the newly accessible house
						},
					},
				]
			);
		} catch (error: any) {
			Alert.alert('Erro', error.message || 'Erro ao aceitar convite. Tente novamente.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeclineInvitation = async (invitation: HouseInvitation) => {
		Alert.alert(
			'Recusar Convite',
			`Tem certeza que deseja recusar o convite para a casa &ldquo;${invitation.houseName}&rdquo;?`,
			[
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Recusar',
					style: 'destructive',
					onPress: async () => {
						setIsLoading(true);
						try {
							await declineInvitation(invitation.id);
							Alert.alert('Convite Recusado', 'O convite foi recusado com sucesso.');
						} catch (error: any) {
							Alert.alert('Erro', error.message || 'Erro ao recusar convite. Tente novamente.');
						} finally {
							setIsLoading(false);
						}
					},
				},
			]
		);
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

	if (isLoading && invitations.length === 0) {
		return (
			<View className="flex-1 bg-zinc-900 justify-center items-center">
				<ActivityIndicator size="large" color="#10b981" />
				<Text className="text-white mt-4 text-lg">Carregando convites...</Text>
			</View>
		);
	}

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
					<Text className="text-3xl font-bold text-white mb-2">Convites de Casa</Text>
					<Text className="text-zinc-400 text-center">
						Gerencie seus convites para casas
					</Text>
				</View>

				{invitations.length === 0 ? (
					<View className="flex-1 justify-center items-center">
						<Ionicons name="mail-open-outline" size={50} color="#a1a1aa" className="mb-4" />
						<Text className="text-zinc-400 text-lg text-center mb-6">
							Você não tem nenhum convite pendente.
						</Text>
						<TouchableOpacity
							onPress={() => navigation.goBack()}
							className="bg-zinc-800 rounded-lg py-3 px-6 items-center"
						>
							<Text className="text-white font-semibold">Voltar</Text>
						</TouchableOpacity>
					</View>
				) : (
					<View className="space-y-6">
						{/* Pending Invitations */}
						{pendingInvitations.length > 0 && (
							<View>
								<Text className="text-white text-lg font-semibold mb-4">
									Convites Pendentes ({pendingInvitations.length})
								</Text>
								<View className="space-y-3">
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
												<View
													className="bg-amber-500/20 rounded-full px-3 py-1"
												>
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

						<TouchableOpacity
							onPress={() => navigation.goBack()}
							className="bg-zinc-800 rounded-lg py-3 items-center mt-6"
						>
							<Text className="text-white font-semibold">Voltar</Text>
						</TouchableOpacity>
					</View>
				)}
			</ScrollView>
		</View>
	);
};
