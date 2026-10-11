import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  getFacebookSignInToken as runFacebookSignIn,
  type FacebookSignInSdk,
  type FacebookSignInToken,
} from "./facebookSignIn";

type FacebookRuntimeExtra = {
  facebookEnabled?: unknown;
  facebookAppId?: unknown;
};

type FacebookNativeDependencies = {
  sdk: FacebookSignInSdk;
  settings: {
    initializeSDK: () => void;
    setAutoLogAppEventsEnabled: (enabled: boolean) => void;
    setAdvertiserIDCollectionEnabled: (enabled: boolean) => void;
  };
  crypto: {
    getRandomBytesAsync: (byteCount: number) => Promise<Uint8Array>;
    digestStringAsync: (
      algorithm: string,
      value: string,
      options: { encoding: string },
    ) => Promise<string>;
  };
};

const getRuntimeExtra = (): FacebookRuntimeExtra =>
  (Constants.expoConfig?.extra ?? {}) as FacebookRuntimeExtra;

const hasConfiguredFacebookApp = (): boolean => {
  const { facebookEnabled, facebookAppId } = getRuntimeExtra();
  return (
    (Platform.OS === "android" || Platform.OS === "ios") &&
    facebookEnabled === true &&
    typeof facebookAppId === "string" &&
    /^\d+$/.test(facebookAppId.trim())
  );
};

let nativeQueue: Promise<void> = Promise.resolve();
let loadedNativeDependencies: FacebookNativeDependencies | null = null;

const enqueueNativeAttempt = <T>(operation: () => Promise<T>): Promise<T> => {
  const queued = nativeQueue.then(operation, operation);
  nativeQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
};

const loadNativeDependencies = async (): Promise<FacebookNativeDependencies> => {
  if (loadedNativeDependencies) return loadedNativeDependencies;

  const [{ AccessToken, AuthenticationToken, LoginManager, Settings }, crypto] = await Promise.all([
    import("react-native-fbsdk-next"),
    import("expo-crypto"),
  ]);

  const dependencies: FacebookNativeDependencies = {
    sdk: {
      loginManager: LoginManager,
      accessToken: AccessToken,
      authenticationToken: AuthenticationToken,
    },
    settings: Settings,
    crypto: {
      getRandomBytesAsync: crypto.getRandomBytesAsync,
      digestStringAsync: (_algorithm, value) =>
        crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, value, {
          encoding: crypto.CryptoEncoding.HEX,
        }),
    },
  };
  loadedNativeDependencies = dependencies;
  return dependencies;
};

const initializeFacebookForLogin = (settings: FacebookNativeDependencies["settings"]): void => {
  // Keep the SDK dormant and privacy-preserving until a validated login attempt.
  settings.setAutoLogAppEventsEnabled(false);
  settings.setAdvertiserIDCollectionEnabled(false);
  settings.initializeSDK();
};

export const isFacebookSignInAvailable = (): boolean => hasConfiguredFacebookApp();

export const getFacebookSignInToken = (): Promise<FacebookSignInToken | null> => {
  if (!hasConfiguredFacebookApp()) return Promise.resolve(null);

  return enqueueNativeAttempt(async () => {
    const dependencies = await loadNativeDependencies();
    initializeFacebookForLogin(dependencies.settings);
    return runFacebookSignIn({
      platform: Platform.OS as "android" | "ios",
      sdk: dependencies.sdk,
      crypto: dependencies.crypto,
    });
  });
};

export const clearFacebookSession = (
  isCurrent: () => boolean = () => true,
  accountUsedFacebook = false,
): Promise<void> => {
  // Load the SDK only if this run or the account used Facebook: the SDK keeps
  // a token from an earlier run until it is logged out.
  if (!hasConfiguredFacebookApp() || (!loadedNativeDependencies && !accountUsedFacebook)) {
    return Promise.resolve();
  }

  return enqueueNativeAttempt(async () => {
    if (!isCurrent()) return;
    try {
      const { sdk, settings } = await loadNativeDependencies();
      initializeFacebookForLogin(settings);
      await sdk.loginManager.logOut();
    } catch {
      // Cleanup must not replace a completed sign-out or deletion with an SDK error.
    }
  });
};
