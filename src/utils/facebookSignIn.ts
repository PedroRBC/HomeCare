export type FacebookSignInToken =
  { type: "access"; token: string } | { type: "limited"; token: string; rawNonce: string };

export type FacebookSignInPlatform = "android" | "ios";

export interface FacebookLoginResult {
  isCancelled?: boolean;
  type?: "cancelled" | "success";
}

export interface FacebookSignInSdk {
  loginManager: {
    logInWithPermissions: (
      permissions: string[],
      loginTrackingIOS?: "enabled" | "limited",
      nonceIOS?: string,
    ) => Promise<FacebookLoginResult>;
    logOut: () => void | Promise<void>;
  };
  accessToken?: {
    getCurrentAccessToken: () => Promise<{ accessToken?: unknown } | null>;
  };
  authenticationToken?: {
    getAuthenticationTokenIOS: () => Promise<{
      authenticationToken?: unknown;
      nonce?: unknown;
    } | null>;
  };
}

export interface FacebookSignInCrypto {
  getRandomBytesAsync: (byteCount: number) => Promise<Uint8Array>;
  digestStringAsync: (
    algorithm: string,
    value: string,
    options: { encoding: string },
  ) => Promise<string>;
}

export interface FacebookSignInOptions {
  platform: FacebookSignInPlatform;
  sdk: FacebookSignInSdk;
  crypto: FacebookSignInCrypto;
}

const FACEBOOK_PERMISSIONS = ["public_profile", "email"];
const NONCE_BYTE_COUNT = 32;
const SHA256 = "SHA-256";
const HEX = "hex";

let signInQueue: Promise<void> = Promise.resolve();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const requireToken = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value;
};

const isCancelled = (result: FacebookLoginResult): boolean =>
  result.isCancelled === true || result.type === "cancelled";

const createRawNonce = async (crypto: FacebookSignInCrypto): Promise<string> => {
  const bytes = await crypto.getRandomBytesAsync(NONCE_BYTE_COUNT);
  if (!(bytes instanceof Uint8Array) || bytes.length !== NONCE_BYTE_COUNT) {
    throw new Error("Facebook Sign-In could not create a cryptographically secure nonce.");
  }
  return toHex(bytes);
};

const performFacebookSignIn = async ({ platform, sdk, crypto }: FacebookSignInOptions) => {
  await sdk.loginManager.logOut();

  if (platform === "ios") {
    const rawNonce = await createRawNonce(crypto);
    const hashedNonce = await crypto.digestStringAsync(SHA256, rawNonce, { encoding: HEX });
    const result = await sdk.loginManager.logInWithPermissions(
      FACEBOOK_PERMISSIONS,
      "limited",
      hashedNonce,
    );
    if (isCancelled(result)) return null;

    const authenticationToken = await sdk.authenticationToken?.getAuthenticationTokenIOS();
    const token = requireToken(
      authenticationToken?.authenticationToken,
      "No Facebook authentication token received after limited login.",
    );
    const returnedNonce = requireToken(
      authenticationToken?.nonce,
      "No Facebook authentication nonce received after limited login.",
    );
    if (returnedNonce !== hashedNonce) {
      throw new Error("Facebook limited-login nonce did not match this login attempt.");
    }
    return { type: "limited" as const, token, rawNonce };
  }

  const result = await sdk.loginManager.logInWithPermissions(FACEBOOK_PERMISSIONS);
  if (isCancelled(result)) return null;

  const accessToken = await sdk.accessToken?.getCurrentAccessToken();
  const token = requireToken(
    accessToken?.accessToken,
    "No Facebook access token received after login.",
  );
  return { type: "access" as const, token };
};

/**
 * Run one native Facebook login attempt. Attempts are serialized so two buttons
 * cannot invalidate each other's nonce or native Facebook session.
 */
export const getFacebookSignInToken = async ({
  platform,
  sdk,
  crypto,
}: FacebookSignInOptions): Promise<FacebookSignInToken | null> => {
  const operation = signInQueue.then(
    () => performFacebookSignIn({ platform, sdk, crypto }),
    () => performFacebookSignIn({ platform, sdk, crypto }),
  );
  signInQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
};

export { FACEBOOK_PERMISSIONS, NONCE_BYTE_COUNT, SHA256, HEX };
