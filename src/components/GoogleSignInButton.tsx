import React, { useEffect, useState } from 'react';
import { TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

interface GoogleSignInButtonProps {
	mode: 'signin' | 'link';
	onSuccess: (idToken: string) => Promise<void>;
	onError: (error: Error) => void;
	disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
	mode,
	onSuccess,
	onError,
	disabled = false,
}) => {
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		configureGoogleSignIn();
	}, []);

	const configureGoogleSignIn = async () => {
		try {
			GoogleSignin.configure({
				webClientId: Constants.expoConfig?.extra?.googleWebClientId,
				iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
				scopes: ['profile', 'email'],
				offlineAccess: true,
			});
		} catch (error) {
			console.error('Error configuring Google Sign In:', error);
		}
	};

	const handleGoogleSignIn = async () => {
		try {
			setIsLoading(true);

			await GoogleSignin.hasPlayServices();
			const userInfo = await GoogleSignin.signIn();

			if (userInfo.data?.idToken) {
				await onSuccess(userInfo.data.idToken);
			} else {
				throw new Error('No ID token received from Google');
			}
		} catch (error: any) {
			if (error.code === statusCodes.SIGN_IN_CANCELLED) {
				// User cancelled the login flow
				return;
			} else if (error.code === statusCodes.IN_PROGRESS) {
				console.warn('Sign in is in progress already');
			} else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
				onError(new Error('Google Play Services not available'));
			} else {
				onError(error instanceof Error ? error : new Error(String(error)));
			}
		} finally {
			setIsLoading(false);
		}
	};

	const buttonLabel = mode === 'signin' ? 'Entrar com Google' : 'Vincular Google';

	return (
		<TouchableOpacity
			onPress={handleGoogleSignIn}
			disabled={disabled || isLoading}
			className="w-full bg-blue-600 rounded-lg py-3 flex-row items-center justify-center"
			style={{ opacity: disabled || isLoading ? 0.6 : 1 }}
		>
			{isLoading ? (
				<ActivityIndicator color="white" size="small" />
			) : (
				<>
					<Ionicons name="logo-google" size={20} color="white" />
					<Text className="text-white font-semibold text-base ml-2">{buttonLabel}</Text>
				</>
			)}
		</TouchableOpacity>
	);
};
