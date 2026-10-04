import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signInWithCredential,
  GoogleAuthProvider,
  linkWithCredential,
  unlink,
  updatePassword as firebaseUpdatePassword,
  updateProfile as firebaseUpdateProfile,
} from "@react-native-firebase/auth";
import type { User as FirebaseUser } from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPersistence, getFirestore, terminate } from "@react-native-firebase/firestore";
import * as Notifications from "expo-notifications";
import { AnalyticsService, CrashlyticsService, TelemetryService } from "@/services/firebase";
import { FirestoreService } from "@/services/firestore";
import { logger } from "@/utils/logger";
import { telemetryPreferences, type UserConsents } from "@/utils/privacy";

export type AuthProviderType = "password" | "google.com";

type AuthProvider = AuthProviderType;

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  providers: AuthProvider[];
  hasPassword: boolean;
  consents?: UserConsents;
}

// Identity confirmation required before deleting the account
export type DeleteAccountCredentials = { password: string } | { googleIdToken: string };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isNewUser: boolean;
  setIsNewUser: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
    consents?: UserConsents,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  linkWithGoogle: (idToken: string) => Promise<void>;
  unlinkProvider: (providerId: AuthProvider) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setPasswordForGoogleAccount: (password: string) => Promise<void>;
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  deleteAccount: (credentials: DeleteAccountCredentials) => Promise<void>;
  updateConsents: (consents: UserConsents) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContextProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const consentsRef = useRef<UserConsents | undefined>(undefined);

  useEffect(() => {
    consentsRef.current = user?.consents;
  }, [user?.consents]);

  // Helper para extrair providers do usuário
  const getUserProviders = (firebaseUser: FirebaseUser): AuthProvider[] => {
    return firebaseUser.providerData.map((p) => p.providerId as AuthProvider);
  };

  // Helper para verificar se tem senha
  const checkHasPassword = (providers: AuthProvider[]): boolean => {
    return providers.includes("password");
  };

  // Scheduled reminders include caregiver names and amounts, so they don't outlive the session
  const clearSessionData = async () => {
    FirestoreService.cleanup();
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  };

  // Everything the app keeps on this device about the user, for account deletion
  const clearLocalPersonalData = async () => {
    await clearSessionData();
    await TelemetryService.reset();
    await AsyncStorage.clear().catch(() => {});
    // Firestore's on-device cache holds copies of profiles, houses and invitations.
    // It can only be cleared on a stopped instance; a new one starts on next use.
    try {
      await terminate(getFirestore());
      await clearPersistence(getFirestore());
    } catch (error) {
      console.warn("Clearing the Firestore cache failed:", error);
    }
  };

  useEffect(() => {
    try {
      const authInstance = getAuth();
      const unsubscribe = onAuthStateChanged(
        authInstance,
        async (firebaseUser: FirebaseUser | null) => {
          if (firebaseUser) {
            try {
              const providers = getUserProviders(firebaseUser);
              const hasPassword = checkHasPassword(providers);

              // Try to load user profile from Firestore
              const firestoreUser = await FirestoreService.getUserProfile(firebaseUser.uid);

              let userData: User;

              if (firestoreUser) {
                // Use Firestore data as primary source
                userData = {
                  uid: firebaseUser.uid,
                  email: firestoreUser.email,
                  displayName: firestoreUser.displayName,
                  photoURL: (firestoreUser as any).photoURL || firebaseUser.photoURL,
                  providers,
                  hasPassword,
                  consents: firestoreUser.consents,
                };

                // Telemetry follows the consent recorded for this user
                if (firestoreUser.consents) {
                  TelemetryService.apply(telemetryPreferences(firestoreUser.consents)).catch(
                    (error) => console.warn("Applying telemetry consent failed:", error),
                  );
                }

                // Atualizar Firestore se providers mudaram
                if (
                  JSON.stringify((firestoreUser as any).providers) !== JSON.stringify(providers) ||
                  (firestoreUser as any).hasPassword !== hasPassword
                ) {
                  await FirestoreService.updateUserProviders(firebaseUser.uid, {
                    providers,
                    hasPassword,
                  });
                }
              } else {
                // Fallback to Firebase Auth data if Firestore document doesn't exist
                // This can happen for existing users who registered before we added Firestore profiles
                userData = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  providers,
                  hasPassword,
                };

                // Create Firestore profile for existing users
                try {
                  await FirestoreService.createUserProfile(
                    firebaseUser.uid,
                    firebaseUser.email || "",
                    firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuário",
                    firebaseUser.photoURL || undefined, // Will be filtered out in FirestoreService
                    providers,
                    hasPassword,
                  );
                  logger.log("Created Firestore profile for existing user:", firebaseUser.uid);
                } catch (createError) {
                  logger.warn("Failed to create Firestore profile for existing user:", createError);
                }
              }

              setUser(userData);

              // Pseudonymous id only: emails and names never go to analytics or crash reports
              AnalyticsService.setUserId(firebaseUser.uid);
              CrashlyticsService.setUserId(firebaseUser.uid);

              // Track login event (apenas trackeia uma vez por sessão)
              const loginMethod = providers.includes("google.com") ? "google" : "email";
              AnalyticsService.trackEvent("user_login", {
                method: loginMethod,
              });
            } catch (error) {
              console.error("Error loading user profile from Firestore:", error);
              // Fallback to Firebase Auth data only
              const providers = getUserProviders(firebaseUser);
              const hasPassword = checkHasPassword(providers);
              const userData: User = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                providers,
                hasPassword,
              };
              setUser(userData);
            }
          } else {
            setUser(null);
            // Clear analytics and crashlytics user data on logout
            AnalyticsService.setUserId("");
            CrashlyticsService.setUserId("");
            TelemetryService.apply(telemetryPreferences(undefined)).catch((error) =>
              console.warn("Disabling telemetry failed:", error),
            );
          }
          setLoading(false);
        },
      );

      return unsubscribe;
    } catch (error) {
      console.error("AuthContext: Error setting up auth listener:", error);
      setLoading(false);
      return () => {};
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const authInstance = getAuth();
      await signInWithEmailAndPassword(authInstance, email, password);

      // Track successful login
      AnalyticsService.trackEvent("login_success", {
        method: "email",
      });
    } catch (error: any) {
      // Track failed login
      AnalyticsService.trackEvent("login_failed", {
        method: "email",
        error_code: error.code,
      });

      CrashlyticsService.logError(error, "Login failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    consents?: UserConsents,
  ): Promise<void> => {
    try {
      setLoading(true);
      const authInstance = getAuth();
      const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);

      // Update display name if provided
      if (displayName && userCredential.user) {
        await firebaseUpdateProfile(userCredential.user, { displayName });
      }

      // Create user profile in Firestore
      if (userCredential.user) {
        const providers = getUserProviders(userCredential.user);
        const hasPassword = checkHasPassword(providers);
        await FirestoreService.createUserProfile(
          userCredential.user.uid,
          email,
          displayName || email.split("@")[0], // Use email prefix as fallback
          userCredential.user.photoURL || undefined, // Will be filtered out in FirestoreService
          providers,
          hasPassword,
          consents,
        );
        const uid = userCredential.user.uid;
        setUser((current) => (current?.uid === uid ? { ...current, consents } : current));
      }

      setIsNewUser(true);

      // Track successful registration
      AnalyticsService.trackEvent("registration_success", {
        method: "email",
        has_display_name: !!displayName,
      });
    } catch (error: any) {
      // Track failed registration
      AnalyticsService.trackEvent("registration_failed", {
        method: "email",
        error_code: error.code,
      });

      CrashlyticsService.logError(error, "Registration failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      // Track logout
      AnalyticsService.trackEvent("user_logout", {
        method: "manual",
      });

      const authInstance = getAuth();
      await firebaseSignOut(authInstance);
      await clearSessionData();
    } catch (error: any) {
      CrashlyticsService.logError(error, "Logout failed");
      setLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      const authInstance = getAuth();
      await sendPasswordResetEmail(authInstance, email);

      // Track password reset request
      AnalyticsService.trackEvent("password_reset_requested");
    } catch (error: any) {
      CrashlyticsService.logError(error, "Password reset failed");
      throw error;
    }
  };

  // ✅ Google Sign-In
  const signInWithGoogle = async (idToken: string): Promise<void> => {
    try {
      setLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);
      const authInstance = getAuth();

      try {
        const result = await signInWithCredential(authInstance, credential);

        // Se é novo usuário, criar perfil no Firestore
        if (result.additionalUserInfo?.isNewUser) {
          const providers = getUserProviders(result.user);
          const hasPassword = checkHasPassword(providers);
          await FirestoreService.createUserProfile(
            result.user.uid,
            result.user.email || "",
            result.user.displayName || result.user.email?.split("@")[0] || "User",
            result.user.photoURL || undefined,
            providers,
            hasPassword,
          );
          setIsNewUser(true);
        }

        AnalyticsService.trackEvent("login_success", {
          method: "google",
          is_new_user: result.additionalUserInfo?.isNewUser,
        });
      } catch (error: any) {
        // Se conta existe com email/senha, lançar erro específico
        if (error.code === "auth/account-exists-with-different-credential") {
          throw new Error("ACCOUNT_EXISTS_LINK_REQUIRED");
        }
        throw error;
      }
    } catch (error: any) {
      AnalyticsService.trackEvent("login_failed", {
        method: "google",
        error_code: error.code,
      });
      CrashlyticsService.logError(error, "Google sign-in failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ Vincular Google a conta existente (usuário já logado com email/senha)
  const linkWithGoogle = async (idToken: string): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;

    if (!currentUser) {
      throw new Error("No user logged in");
    }

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await linkWithCredential(currentUser, credential);

      AnalyticsService.trackEvent("account_linked", {
        provider: "google",
      });
    } catch (error: any) {
      if (error.code === "auth/credential-already-in-use") {
        throw new Error("Esta conta Google já está vinculada a outro usuário");
      }
      if (error.code === "auth/provider-already-linked") {
        throw new Error("Esta conta já está vinculada ao Google");
      }
      throw error;
    }
  };

  // ✅ Definir senha para conta Google (sem senha ainda)
  const setPasswordForGoogleAccount = async (password: string): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;

    if (!currentUser || !currentUser.email) {
      throw new Error("No user or email available");
    }

    // Usar o email existente
    const credential = EmailAuthProvider.credential(currentUser.email, password);

    try {
      await linkWithCredential(currentUser, credential);

      AnalyticsService.trackEvent("password_set", {
        method: "google_account",
      });
    } catch (error: any) {
      if (error.code === "auth/provider-already-linked") {
        throw new Error("Esta conta já possui senha configurada");
      }
      throw error;
    }
  };

  // ✅ Desvincular provedor
  const unlinkProvider = async (providerId: AuthProvider): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;

    if (!currentUser) {
      throw new Error("No user logged in");
    }

    // Verificar se tem pelo menos 2 provedores (não pode desvincular o único)
    if (currentUser.providerData.length <= 1) {
      throw new Error("Não é possível desvincular o único método de login");
    }

    try {
      await unlink(currentUser, providerId);

      AnalyticsService.trackEvent("account_unlinked", {
        provider: providerId,
      });
    } catch (error: any) {
      CrashlyticsService.logError(error, "Provider unlink failed");
      throw error;
    }
  };

  // ✅ Atualizar senha (para quem já tem senha)
  const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;

    if (!currentUser || !user?.email) {
      throw new Error("No user available");
    }

    try {
      // Reautenticar antes de atualizar senha
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Atualizar senha
      await firebaseUpdatePassword(currentUser, newPassword);

      AnalyticsService.trackEvent("password_updated", {});
    } catch (error: any) {
      if (error.code === "auth/wrong-password") {
        throw new Error("Senha atual incorreta");
      }
      throw error;
    }
  };

  const updateProfile = async (updates: {
    displayName?: string;
    photoURL?: string;
  }): Promise<void> => {
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      setLoading(true);

      // Update Firebase Auth profile
      const authInstance = getAuth();
      if (authInstance.currentUser) {
        await firebaseUpdateProfile(authInstance.currentUser, updates);
      }

      // Update Firestore profile
      await FirestoreService.updateUserProfile(user.uid, updates);

      // Refresh user data from Firestore
      const updatedFirestoreUser = await FirestoreService.getUserProfile(user.uid);
      if (updatedFirestoreUser) {
        const updatedUserData: User = {
          uid: user.uid,
          email: updatedFirestoreUser.email,
          displayName: updatedFirestoreUser.displayName,
          photoURL: (updatedFirestoreUser as any).photoURL,
          providers: user.providers,
          hasPassword: user.hasPassword,
          consents: user.consents,
        };
        setUser(updatedUserData);
      }

      // Track profile update
      AnalyticsService.trackEvent("profile_updated", {
        updated_fields: Object.keys(updates).join(","),
      });
    } catch (error: any) {
      CrashlyticsService.logError(error, "Profile update failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (credentials: DeleteAccountCredentials): Promise<void> => {
    if (!user) {
      throw new Error("No user logged in");
    }

    // No global loading here: it would unmount the navigation and hide errors
    // from the deletion screen, which shows its own progress
    try {
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;

      if (!currentUser) {
        throw new Error("No authenticated user found");
      }

      // Confirm the user's identity before touching any data, so an expired session
      // can't leave an account behind with its data already deleted
      if ("password" in credentials) {
        if (!user.email) throw new Error("Esta conta não possui email para confirmar a senha.");
        const credential = EmailAuthProvider.credential(user.email, credentials.password);
        await reauthenticateWithCredential(currentUser, credential);
      } else {
        const credential = GoogleAuthProvider.credential(credentials.googleIdToken);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Delete user data from Firestore first
      await FirestoreService.deleteUserAccount(user.uid, currentUser.email ?? user.email);

      AnalyticsService.trackEvent("account_deleted");

      // Delete Firebase Auth account
      await deleteUser(currentUser);
      await clearLocalPersonalData();

      logger.log("User account deleted successfully");
    } catch (error: any) {
      CrashlyticsService.logError(error, "Account deletion failed");

      // Provide more specific error messages
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        throw new Error("Senha incorreta. Por favor, verifique sua senha e tente novamente.");
      } else if (error.code === "auth/user-mismatch") {
        throw new Error("Confirme com a mesma conta Google usada neste login.");
      } else if (error.code === "auth/too-many-requests") {
        throw new Error("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
      } else if (error.code === "auth/requires-recent-login") {
        throw new Error(
          "Esta operação requer autenticação recente. Por favor, faça login novamente.",
        );
      }

      throw error;
    }
  };

  // Records consent choices and applies them to analytics and crash reports
  const updateConsents = async (changes: UserConsents): Promise<void> => {
    if (!user) {
      throw new Error("No user logged in");
    }

    // Built on the latest choices, not this render's, so quick successive changes
    // don't undo each other
    const previous = consentsRef.current;
    const consents = { ...previous, ...changes };
    consentsRef.current = consents;

    try {
      // Enforced on the device first: a choice is only recorded once it is applied
      await TelemetryService.apply(telemetryPreferences(consents));
      await FirestoreService.updateUserConsents(user.uid, changes);
    } catch (error) {
      consentsRef.current = previous;
      await TelemetryService.apply(telemetryPreferences(previous)).catch(() => {});
      throw error;
    }
    setUser((current) =>
      current?.uid === user.uid
        ? { ...current, consents: { ...current.consents, ...changes } }
        : current,
    );
  };

  const value: AuthContextType = {
    user,
    loading,
    isNewUser,
    setIsNewUser,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    linkWithGoogle,
    unlinkProvider,
    resetPassword,
    updatePassword,
    setPasswordForGoogleAccount,
    updateProfile,
    deleteAccount,
    updateConsents,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
