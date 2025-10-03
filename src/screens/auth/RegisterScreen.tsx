import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Alert,
	ScrollView,
	ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useScreenTracking } from '@/hooks/useFirebase';
import { useFormValidation } from '@/hooks/useFormValidation';
import { registerSchema, RegisterFormData } from '@/schemas/auth.schemas';

interface RegisterScreenProps {
	navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [acceptTerms, setAcceptTerms] = useState(false);

	const { signUp } = useAuth();
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	// Form validation
	const {
		values,
		errors,
		setValue,
		validate,
		clearErrors,
	} = useFormValidation<RegisterFormData>({
		schema: registerSchema,
		initialValues: {
			name: '',
			email: '',
			password: '',
			confirmPassword: '',
		},
	});

	// Track screen view
	useScreenTracking('Register', 'RegisterScreen');

	const openPrivacyPolicy = () => {
		navigation.navigate('PrivacyPolicy');
	};

	const openTermsOfService = () => {
		navigation.navigate('TermsOfService');
	};

	const handleRegister = async () => {
		// Clear previous errors
		clearErrors();

		// Check if terms are accepted
		if (!acceptTerms) {
			Alert.alert(
				'Termos e Condições',
				'Você deve aceitar os Termos de Uso e Política de Privacidade para continuar.',
				[{ text: 'OK' }]
			);
			return;
		}

		// Validate form
		if (!validate()) {
			return;
		}

		try {
			setIsLoading(true);
			await signUp(values.email, values.password, values.name);

			Alert.alert(
				'Sucesso!',
				'Conta criada com sucesso! Você já pode fazer login.',
				[
					{
						text: 'OK',
						onPress: () => navigation.navigate('Login'),
					},
				]
			);
		} catch (error: any) {
			let errorMessage = 'Erro ao criar conta. Tente novamente.';

			switch (error.code) {
				case 'auth/email-already-in-use':
					errorMessage = 'Este email já está em uso.';
					break;
				case 'auth/invalid-email':
					errorMessage = 'Email inválido.';
					break;
				case 'auth/weak-password':
					errorMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
					break;
				case 'auth/network-request-failed':
					errorMessage = 'Erro de conexão. Verifique sua internet.';
					break;
				case 'auth/too-many-requests':
					errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
					break;
			}

			Alert.alert('Erro', errorMessage);
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
							<Ionicons name="person-add" size={40} color="white" />
						</View>
						<Text className="text-2xl font-bold text-white mb-2">Criar Conta</Text>
						<Text className="text-zinc-400 text-center">
							Preencha os dados abaixo para criar sua conta
						</Text>
					</View>

					{/* Form */}
					<View className="space-y-4">
						{/* Name Input */}
						<View>
							<Text className="text-white text-sm font-medium mb-2">Nome Completo</Text>
							<View className={`bg-zinc-800 rounded-lg border flex-row items-center px-4 ${errors.find(e => e.field === 'name') ? 'border-red-500' : 'border-zinc-700'
								}`}>
								<Ionicons name="person-outline" size={20} color="#a1a1aa" />
								<TextInput
									className="flex-1 text-white py-4 px-3"
									placeholder="Seu nome completo"
									placeholderTextColor="#71717a"
									value={values.name}
									onChangeText={(text) => setValue('name', text)}
									autoCapitalize="words"
									autoCorrect={false}
									editable={!isLoading}
								/>
							</View>
							{errors.find(e => e.field === 'name') && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.find(e => e.field === 'name')?.message}
								</Text>
							)}
						</View>

						{/* Email Input */}
						<View>
							<Text className="text-white text-sm font-medium mb-2">Email</Text>
							<View className={`bg-zinc-800 rounded-lg border flex-row items-center px-4 ${errors.find(e => e.field === 'email') ? 'border-red-500' : 'border-zinc-700'
								}`}>
								<Ionicons name="mail-outline" size={20} color="#a1a1aa" />
								<TextInput
									className="flex-1 text-white py-4 px-3"
									placeholder="seu@email.com"
									placeholderTextColor="#71717a"
									value={values.email}
									onChangeText={(text) => setValue('email', text)}
									keyboardType="email-address"
									autoCapitalize="none"
									autoCorrect={false}
									editable={!isLoading}
								/>
							</View>
							{errors.find(e => e.field === 'email') && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.find(e => e.field === 'email')?.message}
								</Text>
							)}
						</View>

						{/* Password Input */}
						<View>
							<Text className="text-white text-sm font-medium mb-2">Senha</Text>
							<View className={`bg-zinc-800 rounded-lg border flex-row items-center px-4 ${errors.find(e => e.field === 'password') ? 'border-red-500' : 'border-zinc-700'
								}`}>
								<Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" />
								<TextInput
									className="flex-1 text-white py-4 px-3"
									placeholder="Mínimo 6 caracteres"
									placeholderTextColor="#71717a"
									value={values.password}
									onChangeText={(text) => setValue('password', text)}
									secureTextEntry={!showPassword}
									autoCapitalize="none"
									autoCorrect={false}
									editable={!isLoading}
								/>
								<TouchableOpacity
									onPress={() => setShowPassword(!showPassword)}
									disabled={isLoading}
								>
									<Ionicons
										name={showPassword ? 'eye-off-outline' : 'eye-outline'}
										size={20}
										color="#a1a1aa"
									/>
								</TouchableOpacity>
							</View>
							{errors.find(e => e.field === 'password') && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.find(e => e.field === 'password')?.message}
								</Text>
							)}
						</View>

						{/* Confirm Password Input */}
						<View>
							<Text className="text-white text-sm font-medium mb-2">Confirmar Senha</Text>
							<View className={`bg-zinc-800 rounded-lg border flex-row items-center px-4 ${errors.find(e => e.field === 'confirmPassword') ? 'border-red-500' : 'border-zinc-700'
								}`}>
								<Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" />
								<TextInput
									className="flex-1 text-white py-4 px-3"
									placeholder="Digite a senha novamente"
									placeholderTextColor="#71717a"
									value={values.confirmPassword}
									onChangeText={(text) => setValue('confirmPassword', text)}
									secureTextEntry={!showConfirmPassword}
									autoCapitalize="none"
									autoCorrect={false}
									editable={!isLoading}
								/>
								<TouchableOpacity
									onPress={() => setShowConfirmPassword(!showConfirmPassword)}
									disabled={isLoading}
								>
									<Ionicons
										name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
										size={20}
										color="#a1a1aa"
									/>
								</TouchableOpacity>
							</View>
							{errors.find(e => e.field === 'confirmPassword') && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.find(e => e.field === 'confirmPassword')?.message}
								</Text>
							)}
						</View>

						{/* Terms and Privacy Policy */}
						<View className="mt-4">
							<TouchableOpacity
								onPress={() => setAcceptTerms(!acceptTerms)}
								disabled={isLoading}
								className="flex-row items-start"
							>
								<View className={`w-5 h-5 rounded border-2 mr-3 mt-0.5 items-center justify-center ${acceptTerms ? 'bg-emerald-600 border-emerald-600' : 'border-zinc-600'
									}`}>
									{acceptTerms && (
										<Ionicons name="checkmark" size={14} color="white" />
									)}
								</View>
								<View className="flex-1">
									<Text className="text-zinc-300 text-sm leading-5">
										Eu concordo com os{' '}
										<TouchableOpacity
											onPress={openTermsOfService}
											disabled={isLoading}
										>
											<Text className="text-emerald-500 font-medium underline">
												Termos de Uso
											</Text>
										</TouchableOpacity>
										{' '}e{' '}
										<TouchableOpacity
											onPress={openPrivacyPolicy}
											disabled={isLoading}
										>
											<Text className="text-emerald-500 font-medium underline">
												Política de Privacidade
											</Text>
										</TouchableOpacity>
										{' '}do HomeCare.
									</Text>
								</View>
							</TouchableOpacity>
						</View>

						{/* Register Button */}
						<TouchableOpacity
							onPress={handleRegister}
							disabled={isLoading || !acceptTerms}
							className={`rounded-lg py-4 items-center mt-6 ${acceptTerms ? 'bg-emerald-600' : 'bg-zinc-700'
								}`}
							style={{ opacity: (isLoading || !acceptTerms) ? 0.7 : 1 }}
						>
							{isLoading ? (
								<ActivityIndicator color="white" />
							) : (
								<Text className="text-white font-semibold text-lg">Criar Conta</Text>
							)}
						</TouchableOpacity>

						{/* Login Link */}
						<View className="flex-row justify-center items-center mt-6">
							<Text className="text-zinc-400">Já tem uma conta? </Text>
							<TouchableOpacity
								onPress={() => navigation.navigate('Login')}
								disabled={isLoading}
							>
								<Text className="text-emerald-500 font-medium">Faça login</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};
