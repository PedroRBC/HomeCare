import { test } from "node:test";
import assert from "node:assert/strict";
import type { ConfigureParams, SignInResponse } from "@react-native-google-signin/google-signin";
import { getGoogleIdToken, type GoogleSignInClient } from "./googleSignIn";

const webClientId = "123456-webclient.apps.googleusercontent.com";
const successResponse = (idToken: string | null = "test-id-token"): SignInResponse => ({
  type: "success",
  data: {
    idToken,
    serverAuthCode: null,
    scopes: ["email", "profile"],
    user: {
      id: "test-user",
      email: "test@example.com",
      name: "Test User",
      photo: null,
      familyName: null,
      givenName: null,
    },
  },
});
const fakeClient = (
  response: SignInResponse = successResponse(),
  overrides: Partial<GoogleSignInClient> = {},
) => {
  const calls: string[] = [];
  let configuration: ConfigureParams | undefined;
  const client: GoogleSignInClient = {
    configure: (options) => {
      calls.push("configure");
      configuration = options;
    },
    hasPlayServices: async (options) => {
      calls.push("play-services");
      assert.equal(options?.showPlayServicesUpdateDialog, true);
      return true;
    },
    signIn: async () => {
      calls.push("sign-in");
      return response;
    },
    ...overrides,
  };
  return { client, calls, getConfiguration: () => configuration };
};

test("requests an ID token for Firebase without requesting offline access", async () => {
  const sdk = fakeClient();
  assert.equal(await getGoogleIdToken(sdk.client, { webClientId }), "test-id-token");
  assert.deepEqual(sdk.calls, ["play-services", "configure", "sign-in"]);
  assert.deepEqual(sdk.getConfiguration(), {
    webClientId,
    iosClientId: undefined,
    scopes: ["profile", "email"],
    offlineAccess: false,
  });
});

test("preserves the optional iOS client ID", async () => {
  const sdk = fakeClient();
  await getGoogleIdToken(sdk.client, { webClientId, iosClientId: "ios-client-id" });
  const configuration = sdk.getConfiguration();
  assert.ok(configuration && "iosClientId" in configuration);
  assert.equal(configuration.iosClientId, "ios-client-id");
});

test("cancelled responses return no token without turning cancellation into an error", async () => {
  const sdk = fakeClient({ type: "cancelled", data: null });
  assert.equal(await getGoogleIdToken(sdk.client, { webClientId }), null);
});

test("invalid configuration fails before calling the SDK or opening account selection", async () => {
  for (const value of [undefined, null, "", "$GOOGLE_WEB_CLIENT_ID", "invalid"]) {
    const sdk = fakeClient();
    await assert.rejects(
      getGoogleIdToken(sdk.client, { webClientId: value }),
      /requires a valid Web OAuth client ID/,
    );
    assert.deepEqual(sdk.calls, []);
  }
});

test("a success response without an ID token fails instead of passing an invalid Firebase credential", async () => {
  for (const idToken of [null, "", "  "]) {
    const sdk = fakeClient(successResponse(idToken));
    await assert.rejects(getGoogleIdToken(sdk.client, { webClientId }), /No ID token received/);
  }
});

test("a Play Services error prevents configuration and account selection", async () => {
  const failure = Object.assign(new Error("Play Services unavailable"), {
    code: "PLAY_SERVICES_NOT_AVAILABLE",
  });
  const sdk = fakeClient(successResponse(), {
    hasPlayServices: async () => {
      throw failure;
    },
  });
  await assert.rejects(getGoogleIdToken(sdk.client, { webClientId }), (error) => error === failure);
  assert.deepEqual(sdk.calls, []);
});

test("SDK configuration and native sign-in errors are propagated, preserving their codes", async () => {
  const failure = Object.assign(new Error("Google configuration error"), { code: "10" });
  const configurationFailure = fakeClient(successResponse(), {
    configure: () => {
      throw failure;
    },
  });
  await assert.rejects(
    getGoogleIdToken(configurationFailure.client, { webClientId }),
    (error) => error === failure,
  );
  assert.deepEqual(configurationFailure.calls, ["play-services"]);

  const signInFailure = fakeClient(successResponse(), {
    signIn: async () => {
      throw failure;
    },
  });
  await assert.rejects(
    getGoogleIdToken(signInFailure.client, { webClientId }),
    (error) => error === failure,
  );
});
