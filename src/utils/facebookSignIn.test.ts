import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFacebookSignInToken,
  type FacebookSignInCrypto,
  type FacebookSignInSdk,
} from "./facebookSignIn";

const makeCrypto = (nonces: Uint8Array[]): FacebookSignInCrypto => {
  let index = 0;
  return {
    getRandomBytesAsync: async () => nonces[index++] ?? nonces[nonces.length - 1],
    digestStringAsync: async (_algorithm, rawNonce) => `hashed:${rawNonce}`,
  };
};

const makeIosSdk = (
  events: string[],
  token = "limited-token",
  returnedNonce?: string | null,
): FacebookSignInSdk => {
  let suppliedNonce: string | undefined;
  return {
    loginManager: {
      logOut: () => {
        events.push("logout");
      },
      logInWithPermissions: async (permissions, tracking, nonce) => {
        suppliedNonce = nonce;
        events.push(`login:${permissions.join(",")}:${tracking}:${nonce}`);
        return { isCancelled: false };
      },
    },
    authenticationToken: {
      getAuthenticationTokenIOS: async () => {
        events.push("authentication-token");
        return {
          authenticationToken: token,
          nonce: returnedNonce === null ? undefined : (returnedNonce ?? suppliedNonce),
        };
      },
    },
  };
};

test("iOS limited login hashes a fresh nonce for Meta and returns the raw nonce for Firebase", async () => {
  const events: string[] = [];
  const rawNonce = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  const sdk = makeIosSdk(events);
  const result = await getFacebookSignInToken({
    platform: "ios",
    sdk,
    crypto: makeCrypto([Uint8Array.from({ length: 32 }, (_, index) => index)]),
  });

  assert.deepEqual(result, { type: "limited", token: "limited-token", rawNonce });
  assert.deepEqual(events, [
    "logout",
    `login:public_profile,email:limited:hashed:${rawNonce}`,
    "authentication-token",
  ]);
});

test("iOS limited login rejects a missing or mismatched returned nonce", async () => {
  for (const returnedNonce of [null, "stale-hash"] as const) {
    await assert.rejects(
      getFacebookSignInToken({
        platform: "ios",
        sdk: makeIosSdk([], "limited-token", returnedNonce),
        crypto: makeCrypto([new Uint8Array(32).fill(3)]),
      }),
      returnedNonce === null ? /No Facebook authentication nonce/ : /nonce did not match/,
    );
  }
});

test("each iOS attempt creates a distinct nonce and never reuses a cached token", async () => {
  const events: string[] = [];
  const sdk = makeIosSdk(events);
  const crypto = makeCrypto([
    Uint8Array.from({ length: 32 }, () => 0x01),
    Uint8Array.from({ length: 32 }, () => 0x02),
  ]);

  const first = await getFacebookSignInToken({ platform: "ios", sdk, crypto });
  const second = await getFacebookSignInToken({ platform: "ios", sdk, crypto });

  assert.ok(first && second && first.type === "limited" && second.type === "limited");
  assert.notEqual(first.rawNonce, second.rawNonce);
  assert.match(events[1], /hashed:010101/);
  assert.match(events[4], /hashed:020202/);
});

test("Android access login requests only public_profile/email and reads a fresh access token", async () => {
  const events: string[] = [];
  const sdk: FacebookSignInSdk = {
    loginManager: {
      logOut: () => {
        events.push("logout");
      },
      logInWithPermissions: async (permissions, tracking, nonce) => {
        events.push(`login:${permissions.join(",")}:${tracking ?? "none"}:${nonce ?? "none"}`);
        return { isCancelled: false };
      },
    },
    accessToken: {
      getCurrentAccessToken: async () => {
        events.push("access-token");
        return { accessToken: "access-token" };
      },
    },
  };

  assert.deepEqual(
    await getFacebookSignInToken({
      platform: "android",
      sdk,
      crypto: makeCrypto([new Uint8Array(32)]),
    }),
    { type: "access", token: "access-token" },
  );
  assert.deepEqual(events, ["logout", "login:public_profile,email:none:none", "access-token"]);
});

test("cancellation returns null without reading a cached token", async () => {
  let accessTokenReads = 0;
  const sdk: FacebookSignInSdk = {
    loginManager: {
      logOut: () => undefined,
      logInWithPermissions: async () => ({ isCancelled: true }),
    },
    accessToken: {
      getCurrentAccessToken: async () => {
        accessTokenReads += 1;
        return { accessToken: "stale-token" };
      },
    },
  };

  assert.equal(
    await getFacebookSignInToken({
      platform: "android",
      sdk,
      crypto: makeCrypto([new Uint8Array(32)]),
    }),
    null,
  );
  assert.equal(accessTokenReads, 0);
});

test("missing tokens fail instead of returning a cached or invalid Firebase credential", async () => {
  const sdk: FacebookSignInSdk = {
    loginManager: {
      logOut: () => undefined,
      logInWithPermissions: async () => ({ type: "success" }),
    },
    accessToken: {
      getCurrentAccessToken: async () => null,
    },
  };

  await assert.rejects(
    getFacebookSignInToken({
      platform: "android",
      sdk,
      crypto: makeCrypto([new Uint8Array(32)]),
    }),
    /No Facebook access token received/,
  );
});

test("concurrent native attempts are serialized", async () => {
  const events: string[] = [];
  let releaseFirstLogin: (() => void) | undefined;
  const firstLoginFinished = new Promise<void>((resolve) => {
    releaseFirstLogin = resolve;
  });
  let attempt = 0;
  const sdk: FacebookSignInSdk = {
    loginManager: {
      logOut: () => {
        events.push("logout");
      },
      logInWithPermissions: async () => {
        const current = attempt++;
        events.push(`login:${current}`);
        if (current === 0) await firstLoginFinished;
        return { isCancelled: false };
      },
    },
    accessToken: {
      getCurrentAccessToken: async () => ({ accessToken: `token-${attempt}` }),
    },
  };
  const crypto = makeCrypto([new Uint8Array(32).fill(1), new Uint8Array(32).fill(2)]);
  const first = getFacebookSignInToken({ platform: "android", sdk, crypto });
  const second = getFacebookSignInToken({ platform: "android", sdk, crypto });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ["logout", "login:0"]);
  releaseFirstLogin?.();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["logout", "login:0", "logout", "login:1"]);
});
