import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHouse } from '@/context/HouseContext';
import { useScreenTracking } from '@/hooks/useFirebase';

interface CreateHouseScreenProps {
	navigation: any;
}

export const CreateHouseScreen: React.FC<CreateHouseScreenProps> = ({ navigation }) => {
	const [houseName, setHouseName] = useState('');
	const [description, setDescription] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const { createHouse } = useHouse();
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	// Track screen view
	useScreenTracking('CreateHouse', 'CreateHouseScreen');

	const handleCreateHouse = async () => {
		if (!houseName.trim()) {
			Alert.alert('Erro', 'O nome da casa é obrigatório');
			return;
		}

		try {
			setIsLoading(true);
			await createHouse(houseName.trim(), description.trim() || undefined);

			Alert.alert(
				'Sucesso!',
				'Casa criada com sucesso!',
				[
					{
						text: 'OK',
						onPress: () => {
							// The house is created and selected, so the router will automatically
							// navigate to the main app. No manual navigation needed.
						},
					},
				]
			);
		} catch (error: any) {
			console.error('Error creating house:', error);
			Alert.alert('Erro', 'Erro ao criar casa. Tente novamente.');
		} finally {
			setIsLoading(false);
		}
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
				contentContainerStyle={{ flexGrow: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View className="flex-1 px-6 py-8">
					{/* Header */}
					<View className="items-center mb-8">
						<View className="w-20 h-20 bg-emerald-600 rounded-full items-center justify-center mb-4">
							<Ionicons name="add-circle" size={40} color="white" />
						</View>
						<Text className="text-2xl font-bold text-white mb-2">Criar Nova Casa</Text>
						<Text className="text-zinc-400 text-center">
							Preencha os dados abaixo para criar sua casa
						</Text>
					</View>

					{/* Form */}
					<View className="space-y-6 gap-3">
						{/* House Name Input */}
						<View>
							<Text className="text-white text-sm font-medium mb-2">Nome da Casa *</Text>
							<View className="bg-zinc-800 rounded-lg border border-zinc-700 flex-row items-center gap-2 px-4">
								<Ionicons name="home-outline" size={20} color="#a1a1aa" />
								<TextInput
									className="flex-1 text-white py-4 px-3"
									placeholder="Ex: Casa da Família Silva"
									placeholderTextColor="#71717a"
									value={houseName}
									onChangeText={setHouseName}
									autoCapitalize="words"
									autoCorrect={false}
									editable={!isLoading}
									maxLength={50}
								/>
							</View>
						</View>

						{/* Description Input */}
						<View>
							<Text className="text-white text-sm font-medium mb-2">Descrição (Opcional)</Text>
							<View className="bg-zinc-800 rounded-lg border border-zinc-700 flex-row items-start gap-2 px-4 py-3">
								<Ionicons name="document-text-outline" size={20} color="#a1a1aa" style={{ marginTop: 4 }} />
								<TextInput
									className="flex-1 text-white py-2 px-3"
									placeholder="Descreva sua casa ou adicione observações..."
									placeholderTextColor="#71717a"
									value={description}
									onChangeText={setDescription}
									multiline
									numberOfLines={3}
									textAlignVertical="top"
									autoCapitalize="sentences"
									autoCorrect={true}
									editable={!isLoading}
									maxLength={200}
								/>
							</View>
							<Text className="text-zinc-500 text-xs mt-1">
								{description.length}/200 caracteres
							</Text>
						</View>

						{/* Create Button */}
						<TouchableOpacity
							onPress={handleCreateHouse}
							disabled={isLoading || !houseName.trim()}
							className="bg-emerald-600 rounded-lg py-4 items-center mt-6"
							style={{ opacity: (isLoading || !houseName.trim()) ? 0.7 : 1 }}
						>
							{isLoading ? (
								<ActivityIndicator color="white" />
							) : (
								<View className="flex-row items-center">
									<Ionicons name="checkmark" size={20} color="white" />
									<Text className="text-white font-semibold text-lg ml-2">
										Criar Casa
									</Text>
								</View>
							)}
						</TouchableOpacity>

						{/* Cancel Button */}
						<TouchableOpacity
							onPress={() => {
								// Try to go back, but handle the case where there's no previous screen
								if (navigation.canGoBack()) {
									navigation.goBack();
								} else {
									// If there's no previous screen, just reset the form
									setHouseName('');
									setDescription('');
								}
							}}
							disabled={isLoading}
							className="bg-zinc-700 rounded-lg py-4 items-center"
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							<Text className="text-white font-semibold text-lg">Cancelar</Text>
						</TouchableOpacity>
					</View>

					{/* Info Section */}
					<View className="mt-8 p-4 bg-zinc-800 rounded-lg">
						<View className="flex-row items-start">
							<Ionicons name="information-circle" size={20} color="#10b981" style={{ marginTop: 2 }} />
							<View className="flex-1 ml-3">
								<Text className="text-emerald-500 font-semibold text-sm mb-1">
									Informações Importantes
								</Text>
								<Text className="text-zinc-400 text-sm">
									• Você será o proprietário da casa{'\n'}
									• Poderá adicionar outros gerentes depois{'\n'}
									• Todos os dados serão privados para esta casa{'\n'}
									• Você pode criar quantas casas quiser
								</Text>
							</View>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};
