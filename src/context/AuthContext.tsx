import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail } from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { AnalyticsService, CrashlyticsService } from '@/services/firebase';

interface User {
	uid: string;
	email: string | null;
	displayName: string | null;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string, displayName?: string) => Promise<void>;
	signOut: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		try {
			const authInstance = getAuth();
			const unsubscribe = onAuthStateChanged(authInstance, (firebaseUser: FirebaseAuthTypes.User | null) => {

				if (firebaseUser) {
					const userData: User = {
						uid: firebaseUser.uid,
						email: firebaseUser.email,
						displayName: firebaseUser.displayName,
					};
					setUser(userData);

					// Set user ID for analytics and crashlytics
					AnalyticsService.setUserId(firebaseUser.uid);
					CrashlyticsService.setUserId(firebaseUser.uid);
					CrashlyticsService.setAttribute('user_email', firebaseUser.email || 'unknown');

					// Track login event
					AnalyticsService.trackEvent('user_login', {
						method: 'email',
						user_id: firebaseUser.uid,
					});
				} else {
					setUser(null);
					// Clear analytics and crashlytics user data on logout
					AnalyticsService.setUserId('');
					CrashlyticsService.setUserId('');
				}
				setLoading(false);
			});

			return unsubscribe;
		} catch (error) {
			console.error('AuthContext: Error setting up auth listener:', error);
			setLoading(false);
			return () => { };
		}
	}, []);

	const signIn = async (email: string, password: string): Promise<void> => {
		try {
			setLoading(true);
			const authInstance = getAuth();
			await signInWithEmailAndPassword(authInstance, email, password);

			// Track successful login
			AnalyticsService.trackEvent('login_success', {
				method: 'email',
				email: email,
			});
		} catch (error: any) {
			// Track failed login
			AnalyticsService.trackEvent('login_failed', {
				method: 'email',
				error_code: error.code,
				error_message: error.message,
			});

			CrashlyticsService.logError(error, 'Login failed');
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const signUp = async (email: string, password: string, displayName?: string): Promise<void> => {
		try {
			setLoading(true);
			const authInstance = getAuth();
			const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);

			// Update display name if provided
			if (displayName && userCredential.user) {
				await userCredential.user.updateProfile({ displayName });
			}

			// Track successful registration
			AnalyticsService.trackEvent('registration_success', {
				method: 'email',
				email: email,
				has_display_name: !!displayName,
			});
		} catch (error: any) {
			// Track failed registration
			AnalyticsService.trackEvent('registration_failed', {
				method: 'email',
				error_code: error.code,
				error_message: error.message,
			});

			CrashlyticsService.logError(error, 'Registration failed');
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const signOut = async (): Promise<void> => {
		try {
			setLoading(true);
			const authInstance = getAuth();
			await firebaseSignOut(authInstance);

			// Track logout
			AnalyticsService.trackEvent('user_logout', {
				method: 'manual',
			});
		} catch (error: any) {
			CrashlyticsService.logError(error, 'Logout failed');
			setLoading(false);
			throw error;
		}
	};

	const resetPassword = async (email: string): Promise<void> => {
		try {
			const authInstance = getAuth();
			await sendPasswordResetEmail(authInstance, email);

			// Track password reset request
			AnalyticsService.trackEvent('password_reset_requested', {
				email: email,
			});
		} catch (error: any) {
			CrashlyticsService.logError(error, 'Password reset failed');
			throw error;
		}
	};

	const value: AuthContextType = {
		user,
		loading,
		signIn,
		signUp,
		signOut,
		resetPassword,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
