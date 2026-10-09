import type { AuthProviderType } from "../types/auth";
import type { FacebookSignInToken } from "./facebookSignIn";

export interface ProviderUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  providerData: readonly { providerId: string }[];
}

export function getProviderState(user: ProviderUser) {
  const providers = user.providerData
    .map(({ providerId }) => providerId)
    .filter(
      (provider): provider is AuthProviderType =>
        provider === "password" || provider === "google.com" || provider === "facebook.com",
    );
  return {
    providers,
    hasPassword: providers.includes("password"),
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

export function facebookCredential<T>(
  result: FacebookSignInToken,
  createCredential: (token: string, nonce?: string) => T,
): T {
  if (!result.token?.trim()) throw new Error("No Facebook token received");
  if (result.type === "limited") {
    if (!result.rawNonce || /\s/.test(result.rawNonce)) {
      throw new Error("Facebook Limited Login requires the original nonce");
    }
    return createCredential(result.token, result.rawNonce);
  }
  if (result.type !== "access") throw new Error("Unsupported Facebook credential");
  return createCredential(result.token);
}

export async function signInWithSocialCredential<T extends { user: ProviderUser }>(options: {
  signIn: () => Promise<T>;
  isNewUser: (result: T) => boolean;
  createProfile: (user: T["user"]) => Promise<void>;
  isCurrent: (user: T["user"]) => boolean;
  onNewUser: () => void;
}): Promise<T> {
  let result: T;
  try {
    result = await options.signIn();
  } catch (error) {
    if ((error as { code?: string }).code === "auth/account-exists-with-different-credential") {
      throw new Error("ACCOUNT_EXISTS_LINK_REQUIRED");
    }
    throw error;
  }
  if (options.isCurrent(result.user) && options.isNewUser(result)) {
    await options.createProfile(result.user);
    if (options.isCurrent(result.user)) options.onNewUser();
  }
  return result;
}

// Provider-only changes do not reliably emit an auth-state event. Update the UI
// from Firebase first; a failed metadata write must not undo a successful link.
export async function synchronizeProviders<T extends ProviderUser>(options: {
  user: T;
  isCurrent: () => boolean;
  updateLocal: (state: ReturnType<typeof getProviderState>) => void;
  persist: (state: ReturnType<typeof getProviderState>) => Promise<void>;
  onPersistenceError: (error: unknown) => void;
}): Promise<void> {
  if (!options.isCurrent()) return;
  const state = getProviderState(options.user);
  options.updateLocal(state);
  if (!options.isCurrent()) return;
  try {
    await options.persist(state);
  } catch (error) {
    if (options.isCurrent()) options.onPersistenceError(error);
  }
}

export function createProviderMutationRunner() {
  let inProgress = false;
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    if (inProgress) throw new Error("PROVIDER_OPERATION_IN_PROGRESS");
    inProgress = true;
    try {
      return await operation();
    } finally {
      inProgress = false;
    }
  };
}

// Keep new authentication out until sign-out/deletion's device cleanup finishes.
export function createAuthCleanupGate() {
  let deleting = false;
  const assertCanAuthenticate = () => {
    if (deleting) throw new Error("PROVIDER_OPERATION_IN_PROGRESS");
  };
  return {
    assertCanAuthenticate,
    run: async <T>(operation: () => Promise<T>): Promise<T> => {
      assertCanAuthenticate();
      deleting = true;
      try {
        return await operation();
      } finally {
        deleting = false;
      }
    },
  };
}

export async function runScopedCleanup(
  isCurrent: () => boolean,
  steps: (() => Promise<unknown>)[],
): Promise<void> {
  for (const step of steps) {
    if (!isCurrent()) return;
    await step();
  }
}

export function assertCanUnlink(user: ProviderUser, provider: AuthProviderType): void {
  const { providers } = getProviderState(user);
  if (!providers.includes(provider)) throw new Error("PROVIDER_NOT_LINKED");
  if (providers.length <= 1) throw new Error("CANNOT_UNLINK_ONLY_PROVIDER");
}

export async function reauthenticateAndDelete(options: {
  reauthenticate: () => Promise<unknown>;
  isCurrent: () => boolean;
  deleteData: () => Promise<void>;
  deleteIdentity: () => Promise<void>;
  canCleanup: () => boolean;
  cleanup: () => Promise<void>;
}): Promise<void> {
  await options.reauthenticate();
  if (!options.isCurrent()) throw new Error("The authenticated account changed");
  await options.deleteData();
  if (!options.isCurrent()) throw new Error("The authenticated account changed");
  await options.deleteIdentity();
  // Successful deletion signs Firebase out, so the pre-deletion UID guard no
  // longer applies. A separate guard prevents cleanup touching another session.
  if (options.canCleanup()) await options.cleanup();
}
