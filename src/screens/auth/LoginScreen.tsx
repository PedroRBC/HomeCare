import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { useScreenTracking } from '@/hooks/useFirebase';
import { useFormValidation } from '@/hooks/useFormValidation';
import { loginSchema, LoginFormData } from '@/schemas/auth.schemas';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { FirestoreService } from '@/services/firestore';

interface LoginScreenProps {
	navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const { signIn, signInWithGoogle, resetPassword } = useAuth();
	const { showAlert } = useAlert();
	const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

	// Form validation
	const {
		values,
		errors,
		setValue,
		validate,
		clearErrors,
	} = useFormValidation<LoginFormData>({
		schema: loginSchema,
		initialValues: {
			email: '',
			password: '',
		},
	});

	// Track screen view
	useScreenTracking('Login', 'LoginScreen');

	const handleLogin = async () => {
		// Clear previous errors
		clearErrors();

		// Validate form
		if (!validate()) {
			return;
		}

		try {
			setIsLoading(true);
			await signIn(values.email, values.password);
			// Navigation will be handled by the auth state change
		} catch (error: any) {
			let errorMessage = 'Erro ao fazer login. Tente novamente.';

			switch (error.code) {
				case 'auth/user-not-found':
					errorMessage = 'Usuário não encontrado.';
					break;
				case 'auth/wrong-password':
					errorMessage = 'Senha incorreta.';
					break;
				case 'auth/invalid-email':
					errorMessage = 'Email inválido.';
					break;
				case 'auth/user-disabled':
					errorMessage = 'Esta conta foi desabilitada.';
					break;
				case 'auth/too-many-requests':
					errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
					break;
				case 'auth/network-request-failed':
					errorMessage = 'Erro de conexão. Verifique sua internet.';
					break;
			}

			showAlert({
				title: 'Erro',
				message: errorMessage,
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

	const handleForgotPassword = () => {
		if (!values.email.trim()) {
			showAlert({
				title: 'Erro',
				message: 'Digite seu email primeiro',
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

		showAlert({
			title: 'Recuperar Senha',
			message: `Enviar email de recuperação para ${values.email}?`,
			icon: 'mail',
			iconColor: '#3b82f6',
			buttons: [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Enviar',
					style: 'default',
					onPress: async () => {
						try {
							await resetPassword(values.email);
							showAlert({
								title: 'Sucesso',
								message: 'Email de recuperação enviado!',
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
							console.error('Password reset error:', error);
							showAlert({
								title: 'Erro',
								message: 'Erro ao enviar email de recuperação',
								icon: 'alert-circle',
								iconColor: '#ef4444',
								buttons: [
									{
										text: 'OK',
										style: 'default',
									},
								],
							});
						}
					},
				},
			],
		});
	};

	const handleGoogleSignIn = async (idToken: string) => {
		try {
			setIsLoading(true);
			await signInWithGoogle(idToken);
			// Navegação automática via AuthContext
		} catch (error: any) {
			let errorMessage = 'Erro ao fazer login com Google';

			if (error.message === 'ACCOUNT_EXISTS_LINK_REQUIRED') {
				errorMessage = 'Uma conta com este email já existe. Por favor, faça login com email/senha e vincule sua conta Google nas configurações de perfil.';
			} else if (error.code === 'auth/account-exists-with-different-credential') {
				errorMessage = 'Este email já está registrado com outro método. Faça login com email/senha.';
			}

			showAlert({
				title: 'Erro',
				message: errorMessage,
				icon: 'alert-circle',
				iconColor: '#ef4444',
				buttons: [{ text: 'OK', style: 'default' }],
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleGoogleError = (error: Error) => {
		console.error('Google Sign-In error:', error);
		showAlert({
			title: 'Erro',
			message: 'Não foi possível conectar com Google. Tente novamente.',
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
				contentContainerStyle={{ flexGrow: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View className="flex-1 px-6 py-8 justify-center">
					{/* Header */}
					<View className="items-center mb-8">
						<View className="w-20 h-20 bg-emerald-600 rounded-full items-center justify-center mb-4">
							<Ionicons name="home" size={40} color="white" />
						</View>
						<Text className="text-2xl font-bold text-white mb-2">HomeCare</Text>
						<Text className="text-zinc-400 text-center">
							Faça login para acessar sua conta
						</Text>
					</View>

					{/* Form */}
					<View className="space-y-4">
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
									placeholder="Sua senha"
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

						{/* Forgot Password */}
						<TouchableOpacity
							onPress={handleForgotPassword}
							disabled={isLoading}
							className="self-end"
						>
							<Text className="text-emerald-500 text-sm">Esqueceu sua senha?</Text>
						</TouchableOpacity>

						{/* Login Button */}
						<TouchableOpacity
							onPress={handleLogin}
							disabled={isLoading}
							className="bg-emerald-600 rounded-lg py-4 items-center mt-6"
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							{isLoading ? (
								<ActivityIndicator color="white" />
							) : (
								<Text className="text-white font-semibold text-lg">Entrar</Text>
							)}
						</TouchableOpacity>

						{/* Divisor */}
						<View className="flex-row items-center my-6">
							<View className="flex-1 h-px bg-zinc-700" />
							<Text className="text-zinc-500 px-4 text-sm">ou</Text>
							<View className="flex-1 h-px bg-zinc-700" />
						</View>

						{/* Google Sign-In Button */}
						<GoogleSignInButton
							onSuccess={handleGoogleSignIn}
							onError={handleGoogleError}
							disabled={isLoading}
							mode="signin"
						/>

						{/* Register Link */}
						<View className="flex-row justify-center items-center mt-6">
							<Text className="text-zinc-400">Não tem uma conta? </Text>
							<TouchableOpacity
								onPress={() => navigation.navigate('Register')}
								disabled={isLoading}
							>
								<Text className="text-emerald-500 font-medium">Cadastre-se</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};
