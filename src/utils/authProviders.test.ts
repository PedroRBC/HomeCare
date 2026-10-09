import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertCanUnlink,
  createProviderMutationRunner,
  createAuthCleanupGate,
  runScopedCleanup,
  facebookCredential,
  getProviderState,
  reauthenticateAndDelete,
  signInWithSocialCredential,
  synchronizeProviders,
  type ProviderUser,
} from "./authProviders";

const facebookUser = (overrides: Partial<ProviderUser> = {}): ProviderUser => ({
  uid: "facebook-user",
  email: null,
  emailVerified: false,
  providerData: [{ providerId: "facebook.com" }],
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

test("Facebook without an email is authenticated without fabricating or verifying an email", () => {
  assert.deepEqual(getProviderState(facebookUser()), {
    providers: ["facebook.com"],
    hasPassword: false,
    email: null,
    emailVerified: false,
  });
  assert.equal(
    getProviderState(facebookUser({ email: "person@example.com" })).emailVerified,
    false,
  );
});

test("Google and password provider state is preserved and unknown providers are not counted", () => {
  assert.deepEqual(
    getProviderState(
      facebookUser({
        email: "person@example.com",
        emailVerified: true,
        providerData: [
          { providerId: "google.com" },
          { providerId: "password" },
          { providerId: "facebook.com" },
          { providerId: "unknown" },
        ],
      }),
    ),
    {
      providers: ["google.com", "password", "facebook.com"],
      hasPassword: true,
      email: "person@example.com",
      emailVerified: true,
    },
  );
});

test("Android Firebase credentials receive only the Facebook access token", () => {
  const result = facebookCredential({ type: "access", token: "access-token" }, (...args) => args);
  assert.deepEqual(result, ["access-token"]);
});

test("Limited Login passes its authentication token and original raw nonce to Firebase", () => {
  const result = facebookCredential(
    { type: "limited", token: "authentication-token", rawNonce: "original-nonce" },
    (...args) => args,
  );
  assert.deepEqual(result, ["authentication-token", "original-nonce"]);
});

test("invalid tokens and missing Limited Login nonces never reach Firebase", () => {
  let calls = 0;
  const createCredential = () => calls++;
  for (const token of ["", "  "]) {
    assert.throws(() => facebookCredential({ type: "access", token }, createCredential));
  }
  for (const rawNonce of ["", "with space"]) {
    assert.throws(() =>
      facebookCredential({ type: "limited", token: "token", rawNonce }, createCredential),
    );
  }
  assert.equal(calls, 0);
});

for (const isNewUser of [true, false]) {
  test(`${isNewUser ? "first" : "repeat"} social login creates a profile only when needed`, async () => {
    const user = facebookUser();
    const calls: string[] = [];
    await signInWithSocialCredential({
      signIn: async () => ({ user }),
      isNewUser: () => isNewUser,
      isCurrent: () => true,
      createProfile: async (profileUser) => {
        assert.equal(profileUser, user);
        calls.push("profile");
      },
      onNewUser: () => calls.push("onboarding"),
    });
    assert.deepEqual(calls, isNewUser ? ["profile", "onboarding"] : []);
  });
}

test("an account collision requires authenticated linking and never creates or merges a profile", async () => {
  const calls: string[] = [];
  await assert.rejects(
    signInWithSocialCredential({
      signIn: async (): Promise<{ user: ProviderUser }> => {
        throw { code: "auth/account-exists-with-different-credential" };
      },
      isNewUser: () => true,
      isCurrent: () => true,
      createProfile: async () => {
        calls.push("profile");
      },
      onNewUser: () => calls.push("onboarding"),
    }),
    /ACCOUNT_EXISTS_LINK_REQUIRED/,
  );
  assert.deepEqual(calls, []);
});

test("social login preserves SDK error identity and code", async () => {
  const error = Object.assign(new Error("invalid"), { code: "auth/invalid-credential" });
  await assert.rejects(
    signInWithSocialCredential({
      signIn: async (): Promise<{ user: ProviderUser }> => {
        throw error;
      },
      isNewUser: () => true,
      isCurrent: () => true,
      createProfile: async () => {},
      onNewUser: () => {},
    }),
    (received) => received === error,
  );
});

test("a login result for an ended session cannot create a profile or affect onboarding", async () => {
  const calls: string[] = [];
  await signInWithSocialCredential({
    signIn: async () => ({ user: facebookUser() }),
    isNewUser: () => true,
    isCurrent: () => false,
    createProfile: async () => {
      calls.push("profile");
    },
    onNewUser: () => calls.push("onboarding"),
  });
  assert.deepEqual(calls, []);
});

test("account switching during profile creation does not mark the new session as a new user", async () => {
  let current = true;
  let marked = false;
  await signInWithSocialCredential({
    signIn: async () => ({ user: facebookUser() }),
    isNewUser: () => true,
    isCurrent: () => current,
    createProfile: async () => {
      current = false;
    },
    onNewUser: () => {
      marked = true;
    },
  });
  assert.equal(marked, false);
});

test("provider synchronization updates identity locally before persisting metadata, preserving consent", async () => {
  const consents = { privacyPolicy: { version: "accepted", acceptedAt: "date" } };
  let local = { ...getProviderState(facebookUser()), consents };
  const calls: string[] = [];
  await synchronizeProviders({
    user: facebookUser({
      email: "person@example.com",
      providerData: [{ providerId: "facebook.com" }, { providerId: "password" }],
    }),
    isCurrent: () => true,
    updateLocal: (state) => {
      local = { ...local, ...state };
      calls.push("local");
    },
    persist: async (state) => {
      assert.equal(local.hasPassword, true);
      assert.equal(state.email, "person@example.com");
      calls.push("persist");
    },
    onPersistenceError: () => assert.fail("metadata should save"),
  });
  assert.deepEqual(calls, ["local", "persist"]);
  assert.equal(local.consents, consents);
  assert.equal(local.emailVerified, false);
});

test("failed metadata persistence reports a separate warning without undoing the linked provider", async () => {
  let local = getProviderState(facebookUser());
  let warning: unknown;
  const error = new Error("offline");
  await synchronizeProviders({
    user: facebookUser({
      providerData: [{ providerId: "facebook.com" }, { providerId: "google.com" }],
    }),
    isCurrent: () => true,
    updateLocal: (state) => {
      local = state;
    },
    persist: async () => {
      throw error;
    },
    onPersistenceError: (received) => {
      warning = received;
    },
  });
  assert.deepEqual(local.providers, ["facebook.com", "google.com"]);
  assert.equal(warning, error);
});

test("an ended session cannot refresh another user's UI or write provider metadata", async () => {
  const calls: string[] = [];
  await synchronizeProviders({
    user: facebookUser(),
    isCurrent: () => false,
    updateLocal: () => calls.push("local"),
    persist: async () => {
      calls.push("persist");
    },
    onPersistenceError: () => calls.push("error"),
  });
  assert.deepEqual(calls, []);
});

test("a late metadata failure does not leak its warning into a new session", async () => {
  let current = true;
  let warned = false;
  await synchronizeProviders({
    user: facebookUser(),
    isCurrent: () => current,
    updateLocal: () => {},
    persist: async () => {
      current = false;
      throw new Error("old write");
    },
    onPersistenceError: () => {
      warned = true;
    },
  });
  assert.equal(warned, false);
});

for (const providerId of ["facebook.com", "google.com", "password"] as const) {
  test(`the only ${providerId} method cannot be unlinked`, () => {
    assert.throws(
      () => assertCanUnlink(facebookUser({ providerData: [{ providerId }] }), providerId),
      /CANNOT_UNLINK_ONLY_PROVIDER/,
    );
  });
}

test("unlinking requires a linked provider and permits removal only with another method", () => {
  assert.throws(() => assertCanUnlink(facebookUser(), "google.com"), /PROVIDER_NOT_LINKED/);
  assert.doesNotThrow(() =>
    assertCanUnlink(
      facebookUser({
        providerData: [{ providerId: "facebook.com" }, { providerId: "google.com" }],
      }),
      "facebook.com",
    ),
  );
});

test("competing provider mutations cannot both pass the last-provider check", async () => {
  const run = createProviderMutationRunner();
  const pending = deferred<void>();
  const user = facebookUser({
    providerData: [{ providerId: "google.com" }, { providerId: "facebook.com" }],
  });
  const first = run(async () => {
    assertCanUnlink(user, "google.com");
    await pending.promise;
    user.providerData = [{ providerId: "facebook.com" }];
  });
  await assert.rejects(
    run(async () => assertCanUnlink(user, "facebook.com")),
    /IN_PROGRESS/,
  );
  pending.resolve();
  await first;
  await assert.rejects(
    run(async () => assertCanUnlink(user, "facebook.com")),
    /CANNOT_UNLINK_ONLY/,
  );
});

test("a failed provider mutation releases its lock", async () => {
  const run = createProviderMutationRunner();
  await assert.rejects(
    run(async () => {
      throw new Error("failed");
    }),
  );
  assert.equal(await run(async () => "next"), "next");
});

function deletionHarness() {
  const calls: string[] = [];
  const options = {
    reauthenticate: async () => {
      calls.push("reauthenticate");
    },
    isCurrent: () => true,
    deleteData: async () => {
      calls.push("data");
    },
    deleteIdentity: async () => {
      calls.push("identity");
    },
    canCleanup: () => true,
    cleanup: async () => {
      calls.push("cleanup");
    },
  };
  return { calls, options };
}

test("account deletion always reauthenticates before deleting data, identity, and local state", async () => {
  const { calls, options } = deletionHarness();
  await reauthenticateAndDelete(options);
  assert.deepEqual(calls, ["reauthenticate", "data", "identity", "cleanup"]);
});

for (const code of [
  "auth/user-mismatch",
  "auth/invalid-credential",
  "auth/requires-recent-login",
]) {
  test(`${code} reauthentication performs no deletion`, async () => {
    const { calls, options } = deletionHarness();
    options.reauthenticate = async () => {
      calls.push("reauthenticate");
      throw Object.assign(new Error(code), { code });
    };
    await assert.rejects(reauthenticateAndDelete(options));
    assert.deepEqual(calls, ["reauthenticate"]);
  });
}

test("switching accounts during reauthentication performs no deletion", async () => {
  const { calls, options } = deletionHarness();
  options.isCurrent = () => false;
  await assert.rejects(reauthenticateAndDelete(options), /account changed/);
  assert.deepEqual(calls, ["reauthenticate"]);
});

test("a failed Firestore deletion preserves the identity and local state", async () => {
  const { calls, options } = deletionHarness();
  options.deleteData = async () => {
    calls.push("data");
    throw new Error("unreachable data");
  };
  await assert.rejects(reauthenticateAndDelete(options));
  assert.deepEqual(calls, ["reauthenticate", "data"]);
});

test("switching accounts during data deletion never deletes the new session's identity", async () => {
  const { calls, options } = deletionHarness();
  let current = true;
  options.isCurrent = () => current;
  options.deleteData = async () => {
    calls.push("data");
    current = false;
  };
  await assert.rejects(reauthenticateAndDelete(options), /account changed/);
  assert.deepEqual(calls, ["reauthenticate", "data"]);
});

test("another account signing in during identity deletion prevents all old-session cleanup", async () => {
  const { calls, options } = deletionHarness();
  let signedOut = true;
  options.canCleanup = () => signedOut;
  options.deleteIdentity = async () => {
    calls.push("identity");
    signedOut = false;
  };
  await reauthenticateAndDelete(options);
  assert.deepEqual(calls, ["reauthenticate", "data", "identity"]);
});

for (const boundary of [0, 1, 2, 3, 4]) {
  test(`a session change during cleanup stage ${boundary} prevents subsequent global cleanup`, async () => {
    const calls: number[] = [];
    let current = true;
    const pause = deferred<void>();
    const entered = deferred<void>();
    const cleanup = runScopedCleanup(
      () => current,
      Array.from({ length: 5 }, (_, stage) => async () => {
        calls.push(stage);
        if (stage === boundary) {
          entered.resolve();
          await pause.promise;
        }
      }),
    );
    await entered.promise;
    current = false;
    pause.resolve();
    await cleanup;
    assert.deepEqual(
      calls,
      Array.from({ length: boundary + 1 }, (_, stage) => stage),
    );
  });
}

test("cleanup does not log out Facebook or clear storage for an already changed session", async () => {
  const calls: string[] = [];
  await runScopedCleanup(
    () => false,
    [
      async () => {
        calls.push("facebook logout");
      },
      async () => {
        calls.push("storage clear");
      },
    ],
  );
  assert.deepEqual(calls, []);
});

test("new authentication and competing deletion stay blocked until the last cleanup await", async () => {
  const gate = createAuthCleanupGate();
  const { options } = deletionHarness();
  const pause = deferred<void>();
  const entered = deferred<void>();
  for (const stage of ["reauthenticate", "deleteData", "deleteIdentity"] as const) {
    options[stage] = async () => {
      assert.throws(gate.assertCanAuthenticate, /IN_PROGRESS/);
    };
  }
  options.cleanup = async () => {
    entered.resolve();
    await pause.promise;
    assert.throws(gate.assertCanAuthenticate, /IN_PROGRESS/);
  };
  const deleting = gate.run(() => reauthenticateAndDelete(options));
  await entered.promise;
  assert.throws(gate.assertCanAuthenticate, /IN_PROGRESS/);
  await assert.rejects(
    gate.run(async () => {}),
    /IN_PROGRESS/,
  );
  pause.resolve();
  await deleting;
  assert.doesNotThrow(gate.assertCanAuthenticate);
});

test("failed reauthentication releases the authentication gate without deleting data", async () => {
  const gate = createAuthCleanupGate();
  const { calls, options } = deletionHarness();
  options.reauthenticate = async () => {
    throw new Error("auth/user-mismatch");
  };
  await assert.rejects(
    gate.run(() => reauthenticateAndDelete(options)),
    /user-mismatch/,
  );
  assert.deepEqual(calls, []);
  assert.doesNotThrow(gate.assertCanAuthenticate);
});
