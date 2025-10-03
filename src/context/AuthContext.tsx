import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from '@react-native-firebase/auth';
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
	updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
	deleteAccount: (password: string) => Promise<void>;
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
			const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser: FirebaseAuthTypes.User | null) => {

				if (firebaseUser) {
					try {
						// Try to load user profile from Firestore
						const { FirestoreService } = await import('@/services/firestore');
						const firestoreUser = await FirestoreService.getUserProfile(firebaseUser.uid);

						let userData: User;

						if (firestoreUser) {
							// Use Firestore data as primary source
							userData = {
								uid: firebaseUser.uid,
								email: firestoreUser.email,
								displayName: firestoreUser.displayName,
							};
						} else {
							// Fallback to Firebase Auth data if Firestore document doesn't exist
							// This can happen for existing users who registered before we added Firestore profiles
							userData = {
								uid: firebaseUser.uid,
								email: firebaseUser.email,
								displayName: firebaseUser.displayName,
							};

							// Create Firestore profile for existing users
							try {
								await FirestoreService.createUserProfile(
									firebaseUser.uid,
									firebaseUser.email || '',
									firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
									firebaseUser.photoURL || undefined // Will be filtered out in FirestoreService
								);
								console.log('Created Firestore profile for existing user:', firebaseUser.uid);
							} catch (createError) {
								console.warn('Failed to create Firestore profile for existing user:', createError);
							}
						}

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
					} catch (error) {
						console.error('Error loading user profile from Firestore:', error);
						// Fallback to Firebase Auth data only
						const userData: User = {
							uid: firebaseUser.uid,
							email: firebaseUser.email,
							displayName: firebaseUser.displayName,
						};
						setUser(userData);
					}
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

			// Create user profile in Firestore
			if (userCredential.user) {
				const { FirestoreService } = await import('@/services/firestore');
				await FirestoreService.createUserProfile(
					userCredential.user.uid,
					email,
					displayName || email.split('@')[0], // Use email prefix as fallback
					userCredential.user.photoURL || undefined // Will be filtered out in FirestoreService
				);
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

	const updateProfile = async (updates: { displayName?: string; photoURL?: string }): Promise<void> => {
		if (!user) {
			throw new Error('No user logged in');
		}

		try {
			setLoading(true);

			// Update Firebase Auth profile
			const authInstance = getAuth();
			if (authInstance.currentUser) {
				await authInstance.currentUser.updateProfile(updates);
			}

			// Update Firestore profile
			const { FirestoreService } = await import('@/services/firestore');
			await FirestoreService.updateUserProfile(user.uid, updates);

			// Refresh user data from Firestore
			const updatedFirestoreUser = await FirestoreService.getUserProfile(user.uid);
			if (updatedFirestoreUser) {
				const updatedUserData: User = {
					uid: user.uid,
					email: updatedFirestoreUser.email,
					displayName: updatedFirestoreUser.displayName,
				};
				setUser(updatedUserData);
			}

			// Track profile update
			AnalyticsService.trackEvent('profile_updated', {
				user_id: user.uid,
				updated_fields: Object.keys(updates),
			});
		} catch (error: any) {
			CrashlyticsService.logError(error, 'Profile update failed');
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const deleteAccount = async (password: string): Promise<void> => {
		if (!user) {
			throw new Error('No user logged in');
		}

		try {
			setLoading(true);

			const authInstance = getAuth();
			const currentUser = authInstance.currentUser;

			if (!currentUser || !user.email) {
				throw new Error('No authenticated user found');
			}

			// Re-authenticate user before deleting account
			const credential = EmailAuthProvider.credential(user.email, password);
			await reauthenticateWithCredential(currentUser, credential);

			// Delete user data from Firestore first
			const { FirestoreService } = await import('@/services/firestore');
			await FirestoreService.deleteUserAccount(user.uid);

			// Delete Firebase Auth account
			await deleteUser(currentUser);

			// Track account deletion
			AnalyticsService.trackEvent('account_deleted', {
				user_id: user.uid,
			});

			console.log('User account deleted successfully');
		} catch (error: any) {
			CrashlyticsService.logError(error, 'Account deletion failed');

			// Provide more specific error messages
			if (error.code === 'auth/wrong-password') {
				throw new Error('Senha incorreta. Por favor, verifique sua senha e tente novamente.');
			} else if (error.code === 'auth/too-many-requests') {
				throw new Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
			} else if (error.code === 'auth/requires-recent-login') {
				throw new Error('Esta operação requer autenticação recente. Por favor, faça login novamente.');
			}

			throw error;
		} finally {
			setLoading(false);
		}
	};

	const value: AuthContextType = {
		user,
		loading,
		signIn,
		signUp,
		signOut,
		resetPassword,
		updateProfile,
		deleteAccount,
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
