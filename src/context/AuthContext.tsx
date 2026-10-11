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
  FacebookAuthProvider,
  getIdTokenResult,
  linkWithCredential,
  unlink,
  updatePassword as firebaseUpdatePassword,
  updateProfile as firebaseUpdateProfile,
  getIdToken,
  reload,
  sendEmailVerification,
} from "@react-native-firebase/auth";
import type { User as FirebaseUser } from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPersistence, getFirestore, terminate } from "@react-native-firebase/firestore";
import { AnalyticsService, CrashlyticsService, TelemetryService } from "@/services/firebase";
import { PushNotificationService } from "@/services/pushNotificationService";
import { FirestoreService } from "@/services/firestore";
import { ConsentRecordService } from "@/services/consentRecords";
import { logger } from "@/utils/logger";
import {
  restrictTelemetry,
  sameTelemetry,
  telemetryPreferences,
  withPendingRevocation,
  type UserConsents,
} from "@/utils/privacy";
import { t as translate } from "i18next";

import type { AuthProviderType } from "@/types/auth";
import type { FacebookSignInToken } from "@/utils/facebookSignIn";
import { clearFacebookSession } from "@/utils/facebookSignInNative";
import {
  assertCanUnlink,
  facebookCredential,
  createProviderMutationRunner,
  createAuthCleanupGate,
  getProviderState,
  reauthenticateAndDelete,
  runScopedCleanup,
  signInWithSocialCredential,
  synchronizeProviders,
} from "@/utils/authProviders";

export type { AuthProviderType } from "@/types/auth";
type AuthProvider = AuthProviderType;

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  providers: AuthProvider[];
  hasPassword: boolean;
  // Invitations and caregiver links are granted by email, so they need a verified one
  emailVerified: boolean;
  consents?: UserConsents;
}

// Identity confirmation required before deleting the account
export type DeleteAccountCredentials =
  { password: string } | { googleIdToken: string } | { facebookToken: FacebookSignInToken };

// A translated auth failure that can be shown as-is; other errors stay internal
export class UserFacingAuthError extends Error {
  name = "UserFacingAuthError";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initializationError: string | null;
  providerSyncError: string | null;
  retryInitialization: () => Promise<void>;
  isNewUser: boolean;
  setIsNewUser: (value: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithFacebook: (token: FacebookSignInToken) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
    consents?: UserConsents,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  linkWithGoogle: (idToken: string) => Promise<void>;
  linkWithFacebook: (token: FacebookSignInToken) => Promise<void>;
  unlinkProvider: (providerId: AuthProvider) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setPasswordForSocialAccount: (password: string) => Promise<void>;
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  deleteAccount: (credentials: DeleteAccountCredentials) => Promise<void>;
  updateConsents: (consents: UserConsents) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  // Reloads the account and, once verified, the token security rules check
  refreshEmailVerification: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContextProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const retryAuthRef = useRef<() => Promise<void>>(async () => {});
  const [isNewUser, setIsNewUser] = useState(false);
  const consentsRef = useRef<UserConsents | undefined>(undefined);
  const authSession = useRef(0);
  const authAttempt = useRef(0);
  const authenticatedSession = useRef(0);
  const authCleanup = useRef(createAuthCleanupGate());
  const [endingSession, setEndingSession] = useState(false);
  const providerMutation = useRef(createProviderMutationRunner());
  const [providerSyncError, setProviderSyncError] = useState<string | null>(null);
  // Only the latest metadata write may report a failure; a newer write supersedes older ones
  const providerSyncWrite = useRef(0);
  const renderSession = authSession.current;
  const pendingSignup = useRef<{
    email: string;
    displayName?: string;
    consents?: UserConsents;
  } | null>(null);

  useEffect(() => {
    consentsRef.current = user?.consents;
  }, [user?.consents]);

  // Helper para extrair providers do usuário
  const getUserProviders = (firebaseUser: FirebaseUser): AuthProvider[] => {
    return getProviderState(firebaseUser).providers;
  };

  // Helper para verificar se tem senha
  const checkHasPassword = (providers: AuthProvider[]): boolean => {
    return providers.includes("password");
  };

  // Reminders include caregiver names and amounts, so neither scheduled nor already
  // shown ones outlive the session
  const clearSessionData = async () => {
    FirestoreService.cleanup();
    await PushNotificationService.clearAll();
  };

  // Everything the app keeps on this device about the user, for account deletion
  const clearLocalPersonalData = async (isCurrent: () => boolean, usedFacebook: boolean) => {
    await runScopedCleanup(isCurrent, [
      () => clearFacebookSession(isCurrent, usedFacebook),
      clearSessionData,
      () => TelemetryService.reset(),
      () => AsyncStorage.clear().catch(() => {}),
      // Firestore's on-device cache can only be cleared on a stopped instance.
      async () => {
        try {
          await terminate(getFirestore());
          if (isCurrent()) await clearPersistence(getFirestore());
        } catch {
          logger.warn("Clearing the Firestore cache failed");
        }
      },
    ]);
  };

  const assertCanAuthenticate = () => {
    try {
      authCleanup.current.assertCanAuthenticate();
    } catch {
      throw new UserFacingAuthError(translate("errors.providerOperationInProgress"));
    }
  };

  // Records revocations that failed to reach the account earlier
  const recordPendingRevocation = async (
    uid: string,
    consents: UserConsents,
    isCurrent: () => boolean,
  ) => {
    try {
      const recorded = { analytics: consents.analytics, crashReports: consents.crashReports };
      await ConsentRecordService.record(uid, recorded, isCurrent);
    } catch (error) {
      logger.warn("Recording a pending telemetry revocation failed:", error);
    }
  };

  useEffect(() => {
    // Each auth state change starts a session: work for an older one is dropped
    const sessionState = authSession;
    try {
      const authInstance = getAuth();
      const handleAuthState = async (firebaseUser: FirebaseUser | null) => {
        setInitializationError(null);
        setProviderSyncError(null);
        const signup = pendingSignup.current;
        const signupConsents =
          signup && signup.email === firebaseUser?.email?.trim().toLowerCase()
            ? signup.consents
            : undefined;
        setLoading(true);
        setUser((previous) => (previous?.uid === firebaseUser?.uid ? previous : null));
        const current = ++sessionState.current;
        if (firebaseUser) ++authenticatedSession.current;
        const isCurrent = () => current === sessionState.current;
        // Telemetry follows the consent recorded for this user; none recorded means none
        const applyTelemetry = (consents?: UserConsents) =>
          TelemetryService.apply(telemetryPreferences(consents), isCurrent);

        // Disable collection immediately at the session boundary, before any
        // profile/network await. No previous account's choice carries across.
        try {
          await TelemetryService.apply(telemetryPreferences(undefined), isCurrent);
        } catch (error) {
          console.error("Could not disable telemetry for the new session:", error);
          if (isCurrent()) {
            setUser(null);
            setInitializationError(translate("auth.verifyEmail.error"));
            setLoading(false);
          }
          return;
        }
        if (!isCurrent()) return;

        if (firebaseUser) {
          try {
            const providers = getUserProviders(firebaseUser);
            const hasPassword = checkHasPassword(providers);

            // Try to load user profile from Firestore
            const firestoreUser = await FirestoreService.getUserProfile(firebaseUser.uid);
            const pendingRevocation = await TelemetryService.pendingRevocation(firebaseUser.uid);
            // Signed out, or another user signed in, while loading
            if (!isCurrent()) return;

            let userData: User;

            if (firestoreUser) {
              const consents = withPendingRevocation(
                firestoreUser.consents ?? signupConsents,
                pendingRevocation,
              );
              // Use Firestore data as primary source
              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firestoreUser.displayName,
                photoURL: (firestoreUser as any).photoURL || firebaseUser.photoURL,
                providers,
                hasPassword,
                emailVerified: firebaseUser.emailVerified,
                consents,
              };

              // Applied before anything is tracked for this user
              await applyTelemetry(consents);
              if (!isCurrent()) return;
              if (pendingRevocation && consents) {
                recordPendingRevocation(firebaseUser.uid, consents, isCurrent);
              }

              // Atualizar Firestore se providers mudaram
              if (
                JSON.stringify((firestoreUser as any).providers) !== JSON.stringify(providers) ||
                (firestoreUser as any).hasPassword !== hasPassword ||
                // Profiles store emails lowercased
                firestoreUser.email !== (firebaseUser.email ?? "").toLowerCase()
              ) {
                // Best-effort and not awaited: offline writes settle only when the server
                // acknowledges them, and a failure must not discard the loaded profile
                const write = ++providerSyncWrite.current;
                void FirestoreService.updateUserProviders(firebaseUser.uid, {
                  providers,
                  hasPassword,
                  email: firebaseUser.email,
                }).catch((syncError) => {
                  logger.warn("Provider metadata could not be synchronized:", syncError);
                  if (isCurrent() && write === providerSyncWrite.current) {
                    setProviderSyncError(translate("errors.providerSyncFailed"));
                  }
                });
              }
            } else {
              // Fallback to Firebase Auth data if Firestore document doesn't exist
              // This can happen for existing users who registered before we added Firestore profiles
              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: signup?.displayName ?? firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                providers,
                hasPassword,
                emailVerified: firebaseUser.emailVerified,
                consents: signupConsents,
              };
              await applyTelemetry(signupConsents);
              if (!isCurrent()) return;

              // Create Firestore profile for existing users
              try {
                await FirestoreService.createUserProfile(
                  firebaseUser.uid,
                  firebaseUser.email || "",
                  signup?.displayName ||
                    firebaseUser.displayName ||
                    firebaseUser.email?.split("@")[0] ||
                    translate("notifications.user"),
                  firebaseUser.photoURL || undefined, // Will be filtered out in FirestoreService
                  providers,
                  hasPassword,
                  signupConsents,
                );
                logger.log("Created Firestore profile for existing user:", firebaseUser.uid);
              } catch (createError) {
                logger.warn("Failed to create Firestore profile for existing user:", createError);
              }
            }

            if (!isCurrent()) return;
            setUser(userData);

            // Pseudonymous id only: emails and names never go to analytics or crash reports
            await AnalyticsService.setUserId(firebaseUser.uid);
            if (!isCurrent()) return;
            CrashlyticsService.setUserId(firebaseUser.uid);

            // Track login event (apenas trackeia uma vez por sessão).
            // Best-effort: an offline token refresh must not discard the loaded profile.
            try {
              const { signInProvider } = await getIdTokenResult(firebaseUser);
              if (!isCurrent()) return;
              const loginMethod =
                signInProvider === "facebook.com"
                  ? "facebook"
                  : signInProvider === "google.com"
                    ? "google"
                    : "email";
              AnalyticsService.trackEvent("user_login", { method: loginMethod });
            } catch (tokenError) {
              logger.warn("Skipping login event, sign-in provider unavailable:", tokenError);
            }
          } catch (error) {
            console.error("Error loading user profile from Firestore:", error);
            if (!isCurrent()) return;
            // Consent unknown: no telemetry
            await applyTelemetry(undefined).catch((telemetryError) =>
              console.warn("Disabling telemetry failed:", telemetryError),
            );
            if (!isCurrent()) return;
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
              emailVerified: firebaseUser.emailVerified,
            };
            setUser(userData);
          }
        } else {
          ++authAttempt.current;
          setIsNewUser(false);
          setUser(null);
          // Also covers sign-outs not started by the app (expired or revoked session)
          await clearSessionData().catch((error) =>
            console.warn("Clearing session notifications failed:", error),
          );
          // Clear analytics and crashlytics user data on logout
          AnalyticsService.setUserId("");
          CrashlyticsService.setUserId("");
        }
        if (!isCurrent()) return;
        setLoading(false);
      };
      retryAuthRef.current = () => handleAuthState(getAuth().currentUser);
      const unsubscribe = onAuthStateChanged(authInstance, handleAuthState);

      return () => {
        ++sessionState.current;
        unsubscribe();
      };
    } catch (error) {
      console.error("AuthContext: Error setting up auth listener:", error);
      setLoading(false);
      return () => {};
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    assertCanAuthenticate();
    ++authAttempt.current;
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
    assertCanAuthenticate();
    ++authAttempt.current;
    try {
      pendingSignup.current = { email: email.trim().toLowerCase(), displayName, consents };
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
        // Invitations to this email only work once the user proves owning it
        sendEmailVerification(userCredential.user).catch((error) =>
          logger.warn("Sending the verification email failed:", error),
        );
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
      pendingSignup.current = null;
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    assertCanAuthenticate();
    ++authAttempt.current;
    try {
      await authCleanup.current.run(async () => {
        setEndingSession(true);
        setLoading(true);
        const session = authenticatedSession.current;
        const isCurrent = () => authenticatedSession.current === session && !getAuth().currentUser;
        try {
          AnalyticsService.trackEvent("user_logout", { method: "manual" });
          const signedOutUser = getAuth().currentUser;
          const usedFacebook =
            !!signedOutUser && getUserProviders(signedOutUser).includes("facebook.com");
          await firebaseSignOut(getAuth());
          await runScopedCleanup(isCurrent, [
            () => clearFacebookSession(isCurrent, usedFacebook),
            clearSessionData,
          ]);
        } finally {
          setEndingSession(false);
          setLoading(false);
        }
      });
    } catch (error: any) {
      CrashlyticsService.logError(error, "Logout failed");
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

  const makeFacebookCredential = (token: FacebookSignInToken) =>
    facebookCredential(token, (value, nonce) =>
      nonce
        ? FacebookAuthProvider.credential(value, nonce)
        : FacebookAuthProvider.credential(value),
    );

  const signInWithSocial = async (
    credential: ReturnType<typeof GoogleAuthProvider.credential>,
    method: "google" | "facebook",
  ): Promise<void> => {
    assertCanAuthenticate();
    if (getAuth().currentUser || authSession.current !== renderSession) {
      throw new UserFacingAuthError(translate("errors.requiresRecentLogin"));
    }
    const attempt = ++authAttempt.current;
    try {
      setLoading(true);
      const result = await signInWithSocialCredential({
        signIn: () => signInWithCredential(getAuth(), credential),
        isNewUser: (result) => result.additionalUserInfo?.isNewUser === true,
        isCurrent: (firebaseUser) =>
          authAttempt.current === attempt && getAuth().currentUser?.uid === firebaseUser.uid,
        createProfile: async (firebaseUser) => {
          const { providers, hasPassword } = getProviderState(firebaseUser);
          await FirestoreService.createUserProfile(
            firebaseUser.uid,
            firebaseUser.email ?? "",
            firebaseUser.displayName ||
              firebaseUser.email?.split("@")[0] ||
              translate("notifications.user"),
            firebaseUser.photoURL || undefined,
            providers,
            hasPassword,
          );
        },
        onNewUser: () => setIsNewUser(true),
      });
      if (authAttempt.current !== attempt || getAuth().currentUser?.uid !== result.user.uid) return;
      AnalyticsService.trackEvent("login_success", {
        method,
        is_new_user: result.additionalUserInfo?.isNewUser,
      });
    } catch (error: any) {
      if (authAttempt.current !== attempt) throw error;
      AnalyticsService.trackEvent("login_failed", { method, error_code: error.code });
      // Provider errors may carry credential objects; never send those to telemetry.
      CrashlyticsService.logError(
        new Error(error.code || "SOCIAL_SIGN_IN_FAILED"),
        `${method} sign-in failed`,
      );
      throw error;
    } finally {
      if (authAttempt.current === attempt) setLoading(false);
    }
  };

  const signInWithGoogle = (idToken: string): Promise<void> =>
    signInWithSocial(GoogleAuthProvider.credential(idToken), "google");

  const signInWithFacebook = (token: FacebookSignInToken): Promise<void> =>
    signInWithSocial(makeFacebookCredential(token), "facebook");

  const runProviderMutation = async (
    operation: (currentUser: FirebaseUser) => Promise<FirebaseUser>,
    onSuccess?: () => void,
  ): Promise<void> => {
    try {
      await providerMutation.current(async () => {
        const currentUser = getAuth().currentUser;
        if (!currentUser) throw new Error("No user logged in");
        if (currentUser.uid !== user?.uid || authSession.current !== renderSession) {
          throw new UserFacingAuthError(translate("errors.requiresRecentLogin"));
        }
        const session = authSession.current;
        const isCurrent = () =>
          authSession.current === session && getAuth().currentUser?.uid === currentUser.uid;
        setProviderSyncError(null);
        const updatedUser = await operation(currentUser);
        let write = 0;
        // Not awaited: the UI updates synchronously, and the metadata write (which
        // settles offline only once the server acknowledges it) must not hold the lock
        void synchronizeProviders({
          user: updatedUser,
          isCurrent,
          updateLocal: (state) => {
            setUser((previous) =>
              previous?.uid === updatedUser.uid && isCurrent()
                ? { ...previous, ...state }
                : previous,
            );
          },
          persist: (state) => {
            write = ++providerSyncWrite.current;
            return FirestoreService.updateUserProviders(updatedUser.uid, state);
          },
          onPersistenceError: () => {
            logger.warn("Provider metadata could not be synchronized");
            if (write === providerSyncWrite.current) {
              setProviderSyncError(translate("errors.providerSyncFailed"));
            }
          },
        });
        if (isCurrent()) onSuccess?.();
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PROVIDER_OPERATION_IN_PROGRESS") {
        throw new UserFacingAuthError(translate("errors.providerOperationInProgress"));
      }
      throw error;
    }
  };

  const linkWithSocial = async (
    credential: ReturnType<typeof GoogleAuthProvider.credential>,
    provider: "google" | "facebook",
  ): Promise<void> => {
    try {
      await runProviderMutation(
        async (currentUser) => (await linkWithCredential(currentUser, credential)).user,
        () => AnalyticsService.trackEvent("account_linked", { provider }),
      );
    } catch (error: any) {
      if (error.code === "auth/credential-already-in-use") {
        throw new UserFacingAuthError(
          translate(
            provider === "facebook" ? "errors.facebookAlreadyLinked" : "errors.googleAlreadyLinked",
          ),
        );
      }
      if (error.code === "auth/provider-already-linked") {
        throw new UserFacingAuthError(
          translate(
            provider === "facebook" ? "errors.alreadyLinkedFacebook" : "errors.alreadyLinkedGoogle",
          ),
        );
      }
      throw error;
    }
  };

  const linkWithGoogle = (idToken: string): Promise<void> =>
    linkWithSocial(GoogleAuthProvider.credential(idToken), "google");

  const linkWithFacebook = (token: FacebookSignInToken): Promise<void> =>
    linkWithSocial(makeFacebookCredential(token), "facebook");

  // Social accounts can add a password only for their Firebase email.
  const setPasswordForSocialAccount = async (password: string): Promise<void> => {
    try {
      await runProviderMutation(
        async (currentUser) => {
          if (!currentUser.email) {
            throw new UserFacingAuthError(translate("errors.noEmailForPassword"));
          }
          const credential = EmailAuthProvider.credential(currentUser.email, password);
          return (await linkWithCredential(currentUser, credential)).user;
        },
        () => AnalyticsService.trackEvent("password_set", { method: "social_account" }),
      );
    } catch (error: any) {
      if (error.code === "auth/provider-already-linked") {
        throw new UserFacingAuthError(translate("errors.passwordAlreadySet"));
      }
      throw error;
    }
  };

  const unlinkProvider = async (providerId: AuthProvider): Promise<void> => {
    try {
      await runProviderMutation(
        async (currentUser) => {
          assertCanUnlink(currentUser, providerId);
          return unlink(currentUser, providerId);
        },
        () => AnalyticsService.trackEvent("account_unlinked", { provider: providerId }),
      );
    } catch (error: any) {
      if (error.message === "CANNOT_UNLINK_ONLY_PROVIDER") {
        throw new UserFacingAuthError(translate("errors.cannotUnlinkOnly"));
      }
      if (error.message === "PROVIDER_NOT_LINKED") {
        throw new UserFacingAuthError(translate("errors.providerNotLinked"));
      }
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
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        throw new UserFacingAuthError(translate("errors.currentPasswordWrong"));
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
          email: user.email,
          displayName: updatedFirestoreUser.displayName,
          photoURL: (updatedFirestoreUser as any).photoURL,
          providers: user.providers,
          hasPassword: user.hasPassword,
          emailVerified: user.emailVerified,
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

      const isCurrent = () =>
        authSession.current === renderSession && getAuth().currentUser?.uid === user.uid;
      if (!isCurrent()) throw new UserFacingAuthError(translate("errors.requiresRecentLogin"));
      const provider =
        "password" in credentials
          ? "password"
          : "googleIdToken" in credentials
            ? "google.com"
            : "facebook.com";
      if (!getProviderState(currentUser).providers.includes(provider)) {
        throw new UserFacingAuthError(translate("errors.providerNotLinked"));
      }
      let credential: ReturnType<typeof GoogleAuthProvider.credential>;
      if ("password" in credentials) {
        if (!currentUser.email) {
          throw new UserFacingAuthError(translate("errors.noEmailForPassword"));
        }
        credential = EmailAuthProvider.credential(currentUser.email, credentials.password);
      } else if ("googleIdToken" in credentials) {
        credential = GoogleAuthProvider.credential(credentials.googleIdToken);
      } else {
        credential = makeFacebookCredential(credentials.facebookToken);
      }

      await authCleanup.current.run(async () => {
        setEndingSession(true);
        // A normal deletion emits null, not another authenticated identity.
        const session = authenticatedSession.current;
        const canCleanup = () => authenticatedSession.current === session && !getAuth().currentUser;
        try {
          await providerMutation.current(() =>
            reauthenticateAndDelete({
              reauthenticate: () => reauthenticateWithCredential(currentUser, credential),
              isCurrent,
              deleteData: () =>
                FirestoreService.deleteUserAccount(
                  user.uid,
                  currentUser.email,
                  currentUser.emailVerified,
                ),
              deleteIdentity: async () => {
                AnalyticsService.trackEvent("account_deleted");
                await deleteUser(currentUser);
              },
              canCleanup,
              cleanup: () =>
                clearLocalPersonalData(
                  canCleanup,
                  getUserProviders(currentUser).includes("facebook.com"),
                ),
            }),
          );
        } finally {
          setEndingSession(false);
        }
      });

      logger.log("User account deleted successfully");
    } catch (error: any) {
      CrashlyticsService.logError(
        new Error(error.code || "ACCOUNT_DELETION_FAILED"),
        "Account deletion failed",
      );

      // Provide more specific error messages without treating a social token as a password.
      if (error.message === "PROVIDER_OPERATION_IN_PROGRESS") {
        throw new UserFacingAuthError(translate("errors.providerOperationInProgress"));
      } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        throw new UserFacingAuthError(
          translate(
            "password" in credentials
              ? "errors.wrongPasswordRetry"
              : "errors.socialCredentialInvalid",
          ),
        );
      } else if (error.code === "auth/user-mismatch") {
        throw new UserFacingAuthError(translate("errors.socialUserMismatch"));
      } else if (error.code === "auth/too-many-requests") {
        throw new UserFacingAuthError(translate("errors.tooManyAttempts"));
      } else if (error.code === "auth/requires-recent-login") {
        throw new UserFacingAuthError(translate("errors.requiresRecentLogin"));
      }

      throw error;
    }
  };

  // Records consent choices and applies them to analytics and crash reports
  const updateConsents = async (changes: UserConsents): Promise<void> => {
    if (!user) {
      throw new Error("No user logged in");
    }

    const uid = user.uid;
    const session = renderSession;
    // A change made right before signing out must not apply to the next session
    const isCurrent = () => authSession.current === session && getAuth().currentUser?.uid === uid;
    if (!isCurrent()) throw new Error("This consent choice belongs to an ended session");

    // Built on the latest choices, not this render's, so quick successive changes
    // don't undo each other
    const previous = consentsRef.current;
    const consents = { ...previous, ...changes };
    const before = telemetryPreferences(previous);
    // What may be collected if recording this change fails: a revocation holds anyway
    const fallback = restrictTelemetry(before, telemetryPreferences(consents));
    const revokes = !sameTelemetry(fallback, before);
    consentsRef.current = consents;
    const requested = telemetryPreferences(consents);
    let ticket = {};

    try {
      // Kept on the device until recorded, so not even a restart re-enables it
      ticket = revokes
        ? await TelemetryService.addPendingRevocation(uid, {
            analytics: !(before.analytics && !requested.analytics),
            crashReports: !(before.crashReports && !requested.crashReports),
          })
        : await TelemetryService.pendingRevocationTicket(uid);
      // Enforced on the device first: a choice is only recorded once it is applied
      if (!(await TelemetryService.apply(telemetryPreferences(consents), isCurrent))) {
        throw new Error("The session ended before the choice was applied");
      }
      await ConsentRecordService.record(uid, changes, isCurrent, ticket);
    } catch (error) {
      if (!isCurrent()) throw error;
      const kept = withPendingRevocation(previous, revokes ? fallback : null);
      consentsRef.current = kept;
      await TelemetryService.apply(fallback, isCurrent).catch(() => {});
      if (revokes) {
        setUser((current) => (current?.uid === uid ? { ...current, consents: kept } : current));
      }
      throw error;
    }
    setUser((current) =>
      current?.uid === uid && isCurrent()
        ? { ...current, consents: { ...current.consents, ...changes } }
        : current,
    );
  };

  const sendVerificationEmail = async (): Promise<void> => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) throw new Error("No user logged in");
    await sendEmailVerification(currentUser);
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return false;
    await reload(currentUser);
    const refreshed = getAuth().currentUser;
    if (!refreshed || refreshed.uid !== currentUser.uid) return false;
    // Security rules read the claim from the ID token, which only changes when refreshed
    if (refreshed.emailVerified) await getIdToken(refreshed, true);
    const emailVerified = refreshed.emailVerified;
    setUser((current) =>
      current?.uid === refreshed.uid ? { ...current, emailVerified } : current,
    );
    return emailVerified;
  };

  const value: AuthContextType = {
    user,
    // Keep signed-out login routes hidden until deletion's device cleanup ends,
    // without unmounting the signed-in deletion screen during reauthentication.
    loading: loading || (endingSession && user === null),
    initializationError,
    providerSyncError,
    retryInitialization: () => retryAuthRef.current(),
    isNewUser,
    setIsNewUser,
    signIn,
    signInWithGoogle,
    signInWithFacebook,
    signUp,
    signOut,
    linkWithGoogle,
    linkWithFacebook,
    unlinkProvider,
    resetPassword,
    updatePassword,
    setPasswordForSocialAccount,
    updateProfile,
    deleteAccount,
    updateConsents,
    sendVerificationEmail,
    refreshEmailVerification,
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
