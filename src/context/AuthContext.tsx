import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
} from "@react-native-firebase/auth";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { AnalyticsService, CrashlyticsService } from "@/services/firebase";
import { FirestoreService } from "@/services/firestore";
import { logger } from "@/utils/logger";

export type AuthProviderType = "password" | "google.com";

type AuthProvider = AuthProviderType;

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  providers: AuthProvider[];
  hasPassword: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isNewUser: boolean;
  setIsNewUser: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkWithGoogle: (idToken: string) => Promise<void>;
  unlinkProvider: (providerId: AuthProvider) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setPasswordForGoogleAccount: (password: string) => Promise<void>;
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContextProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  // Helper para extrair providers do usuário
  const getUserProviders = (firebaseUser: FirebaseAuthTypes.User): AuthProvider[] => {
    return firebaseUser.providerData.map((p) => p.providerId as AuthProvider);
  };

  // Helper para verificar se tem senha
  const checkHasPassword = (providers: AuthProvider[]): boolean => {
    return providers.includes("password");
  };

  useEffect(() => {
    try {
      const authInstance = getAuth();
      const unsubscribe = onAuthStateChanged(
        authInstance,
        async (firebaseUser: FirebaseAuthTypes.User | null) => {
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
                };

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

              // Set user ID for analytics and crashlytics
              AnalyticsService.setUserId(firebaseUser.uid);
              CrashlyticsService.setUserId(firebaseUser.uid);
              CrashlyticsService.setAttribute("user_email", firebaseUser.email || "unknown");

              // Track login event (apenas trackeia uma vez por sessão)
              const loginMethod = providers.includes("google.com") ? "google" : "email";
              AnalyticsService.trackEvent("user_login", {
                method: loginMethod,
                user_id: firebaseUser.uid,
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
        email: email,
      });
    } catch (error: any) {
      // Track failed login
      AnalyticsService.trackEvent("login_failed", {
        method: "email",
        error_code: error.code,
        error_message: error.message,
      });

      CrashlyticsService.logError(error, "Login failed");
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
        const providers = getUserProviders(userCredential.user);
        const hasPassword = checkHasPassword(providers);
        await FirestoreService.createUserProfile(
          userCredential.user.uid,
          email,
          displayName || email.split("@")[0], // Use email prefix as fallback
          userCredential.user.photoURL || undefined, // Will be filtered out in FirestoreService
          providers,
          hasPassword,
        );
      }

      setIsNewUser(true);

      // Track successful registration
      AnalyticsService.trackEvent("registration_success", {
        method: "email",
        email: email,
        has_display_name: !!displayName,
      });
    } catch (error: any) {
      // Track failed registration
      AnalyticsService.trackEvent("registration_failed", {
        method: "email",
        error_code: error.code,
        error_message: error.message,
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
      const authInstance = getAuth();
      await firebaseSignOut(authInstance);

      // Track logout
      AnalyticsService.trackEvent("user_logout", {
        method: "manual",
      });
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
      AnalyticsService.trackEvent("password_reset_requested", {
        email: email,
      });
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
        await authInstance.currentUser.updateProfile(updates);
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
        };
        setUser(updatedUserData);
      }

      // Track profile update
      AnalyticsService.trackEvent("profile_updated", {
        user_id: user.uid,
        updated_fields: Object.keys(updates),
      });
    } catch (error: any) {
      CrashlyticsService.logError(error, "Profile update failed");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (password?: string): Promise<void> => {
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      setLoading(true);

      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;

      if (!currentUser) {
        throw new Error("No authenticated user found");
      }

      // Re-authenticate user before deleting account (se tem senha)
      if (password && user.email) {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      // Delete user data from Firestore first
      await FirestoreService.deleteUserAccount(user.uid);

      // Delete Firebase Auth account
      await deleteUser(currentUser);

      // Track account deletion
      AnalyticsService.trackEvent("account_deleted", {
        user_id: user.uid,
      });

      logger.log("User account deleted successfully");
    } catch (error: any) {
      CrashlyticsService.logError(error, "Account deletion failed");

      // Provide more specific error messages
      if (error.code === "auth/wrong-password") {
        throw new Error("Senha incorreta. Por favor, verifique sua senha e tente novamente.");
      } else if (error.code === "auth/too-many-requests") {
        throw new Error("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
      } else if (error.code === "auth/requires-recent-login") {
        throw new Error(
          "Esta operação requer autenticação recente. Por favor, faça login novamente.",
        );
      }

      throw error;
    } finally {
      setLoading(false);
    }
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
