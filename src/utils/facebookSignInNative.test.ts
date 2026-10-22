import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

const runtime = { extra: {} as Record<string, unknown> };
const platform = { OS: "android" };
const calls: string[] = [];
let login = async () => ({ isCancelled: false });
mock.module("expo-constants", () => ({ default: { expoConfig: runtime } }));
mock.module("react-native", () => ({ Platform: platform }));
mock.module("react-native-fbsdk-next", () => ({
  LoginManager: {
    logOut: () => {
      calls.push("logout");
    },
    logInWithPermissions: () => login(),
  },
  AccessToken: { getCurrentAccessToken: async () => ({ accessToken: "android-token" }) },
  AuthenticationToken: {
    getAuthenticationTokenIOS: async () => ({
      authenticationToken: "ios-token",
      nonce: "hashed-nonce",
    }),
  },
  Settings: {
    setAutoLogAppEventsEnabled: (enabled: boolean) => calls.push(`events:${enabled}`),
    setAdvertiserIDCollectionEnabled: (enabled: boolean) => calls.push(`advertisers:${enabled}`),
    initializeSDK: () => {
      calls.push("initialize");
    },
  },
}));
mock.module("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "expo-sha256" },
  CryptoEncoding: { HEX: "expo-hex" },
  getRandomBytesAsync: async (count: number) => new Uint8Array(count).fill(1),
  digestStringAsync: async (algorithm: string, value: string, options: { encoding: string }) => {
    assert.equal(algorithm, "expo-sha256");
    assert.equal(options.encoding, "expo-hex");
    assert.equal(value, "01".repeat(32));
    return "hashed-nonce";
  },
}));
const { isFacebookSignInAvailable, getFacebookSignInToken, clearFacebookSession } =
  await import("./facebookSignInNative");

beforeEach(() => {
  calls.length = 0;
  platform.OS = "android";
  runtime.extra = { facebookEnabled: true, facebookAppId: "123456789" };
  login = async () => ({ isCancelled: false });
});

test("unconfigured and unsupported platforms never initialize Facebook", async () => {
  runtime.extra = {};
  assert.equal(isFacebookSignInAvailable("reauth"), false);
  assert.equal(await getFacebookSignInToken("reauth"), null);
  await clearFacebookSession();
  runtime.extra = { facebookEnabled: true, facebookAppId: "123456789" };
  platform.OS = "web";
  assert.equal(isFacebookSignInAvailable("reauth"), false);
  assert.equal(await getFacebookSignInToken("reauth"), null);
  assert.deepEqual(calls, []);
});

// Runs before any login loads the SDK, as after an app restart.
test("cleanup after a restart skips non-Facebook accounts and logs out Facebook ones", async () => {
  await clearFacebookSession();
  assert.deepEqual(calls, []);
  await clearFacebookSession(() => true, true);
  assert.deepEqual(calls, ["events:false", "advertisers:false", "initialize", "logout"]);
});

test("Facebook sign-in and linking stay disabled even with native credentials configured", async () => {
  assert.equal(isFacebookSignInAvailable(), false);
  assert.equal(isFacebookSignInAvailable("link"), false);
  assert.equal(await getFacebookSignInToken(), null);
  assert.equal(await getFacebookSignInToken("link"), null);
  assert.deepEqual(calls, []);
});

test("native Android reauthentication remains available for existing account deletion", async () => {
  assert.equal(isFacebookSignInAvailable("reauth"), true);
  assert.deepEqual(await getFacebookSignInToken("reauth"), {
    type: "access",
    token: "android-token",
  });
  assert.deepEqual(calls, ["events:false", "advertisers:false", "initialize", "logout"]);
});

test("native iOS reauthentication uses Expo crypto enums and returns the original secure nonce", async () => {
  platform.OS = "ios";
  assert.deepEqual(await getFacebookSignInToken("reauth"), {
    type: "limited",
    token: "ios-token",
    rawNonce: "01".repeat(32),
  });
});

test("queued Facebook cleanup rechecks the account guard before logging out", async () => {
  let release!: (value: { isCancelled: boolean }) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const pending = new Promise<{ isCancelled: boolean }>((resolve) => {
    release = resolve;
  });
  login = () => {
    entered();
    return pending;
  };
  const attempt = getFacebookSignInToken("reauth");
  await started;
  let current = true;
  const cleanup = clearFacebookSession(() => current);
  current = false;
  release({ isCancelled: false });
  await attempt;
  await cleanup;
  assert.equal(calls.filter((call) => call === "logout").length, 1);
});
