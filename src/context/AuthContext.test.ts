import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import {
  acceptPolicies,
  needsConsent,
  telemetryConsents,
  type UserConsents,
  type TelemetryPreferences,
} from "@/utils/privacy";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const storage = new Map<string, string>();
const originalConsoleError = console.error;
let errors: unknown[][] = [];
let failLocalWrite = false;
let applied: TelemetryPreferences = { analytics: false, crashReports: false };
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (failLocalWrite) {
        failLocalWrite = false;
        throw new Error("Local write failed");
      }
      storage.set(key, value);
    },
    clear: async () => storage.clear(),
  },
}));
const account = {
  uid: "owner",
  email: "owner@example.com",
  emailVerified: true,
  displayName: "Owner",
  photoURL: null,
  providerData: [{ providerId: "password" }],
};
let currentAccount = account;
let onAuth!: (user: typeof account | null) => Promise<void>;
const noop = async () => {};
const authExports = Object.fromEntries(
  [
    "signInWithEmailAndPassword",
    "createUserWithEmailAndPassword",
    "signOut",
    "sendPasswordResetEmail",
    "deleteUser",
    "reauthenticateWithCredential",
    "signInWithCredential",
    "linkWithCredential",
    "unlink",
    "updatePassword",
    "updateProfile",
    "getIdToken",
    "reload",
    "sendEmailVerification",
  ].map((name) => [name, noop]),
);
mock.module("@react-native-firebase/auth", () => ({
  ...authExports,
  EmailAuthProvider: {},
  GoogleAuthProvider: {},
  FacebookAuthProvider: {},
  getAuth: () => ({ currentUser: currentAccount }),
  onAuthStateChanged: (_auth: unknown, listener: typeof onAuth) => {
    onAuth = listener;
    return () => {};
  },
  getIdTokenResult: async () => ({ signInProvider: "password" }),
}));
mock.module("@react-native-firebase/firestore", () => ({
  getFirestore: () => ({}),
  terminate: noop,
  clearPersistence: noop,
}));
let recorded: UserConsents | undefined;
let profileUnavailable = false;
let pending: { analytics: boolean; crashReports: boolean } | null = null;
mock.module("@/services/firestore", () => ({
  FirestoreService: {
    getUserProfile: async () => {
      if (profileUnavailable) throw new Error("Profile offline");
      return { ...account, providers: ["password"], hasPassword: true, consents: recorded };
    },
    updateUserConsents: async (_uid: string, changes: UserConsents) => {
      recorded = { ...recorded, ...changes };
    },
  },
}));
mock.module("@/services/firebase", () => ({
  AnalyticsService: { setUserId: noop, trackEvent: () => {} },
  CrashlyticsService: { setUserId: () => {} },
  TelemetryService: {
    apply: async (preferences: TelemetryPreferences) => {
      applied = preferences;
      return true;
    },
    addPendingRevocation: async (_uid: string, allowed: TelemetryPreferences) => {
      pending = allowed;
      return {};
    },
    pendingRevocation: async () => pending,
    pendingRevocationTicket: async () => ({}),
    clearPendingRevocation: async () => {
      pending = null;
    },
  },
}));
mock.module("@/services/pushNotificationService", () => ({
  PushNotificationService: { clearAll: noop },
}));
mock.module("@/utils/facebookSignInNative", () => ({ clearFacebookSession: noop }));
mock.module("i18next", () => ({ t: (key: string) => key }));

// Execute the provider's real auth listener across fresh mounts without a native renderer.
let slots: unknown[] = [];
let cursor = 0;
let mounted = false;
let effects: (() => unknown)[] = [];
const react = {
  createContext: () => ({ Provider: "provider" }),
  useContext: () => undefined,
  useState: (initial: unknown) => {
    const index = cursor++;
    if (!mounted) slots[index] = initial;
    return [
      slots[index],
      (value: unknown) => {
        slots[index] = typeof value === "function" ? value(slots[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = cursor++;
    if (!mounted) slots[index] = { current: initial };
    return slots[index];
  },
  useEffect: (effect: () => unknown, dependencies: unknown[]) => {
    const index = cursor++;
    const previous = slots[index] as unknown[] | undefined;
    if (!mounted || dependencies.some((value, i) => !Object.is(value, previous?.[i]))) {
      effects.push(effect);
    }
    slots[index] = dependencies;
  },
  createElement: (_type: unknown, props: unknown) => ({ props }),
};
mock.module("react", () => ({ ...react, default: react }));
mock.module("react/jsx-dev-runtime", () => ({ jsxDEV: react.createElement }));
mock.module("react/jsx-runtime", () => ({ jsx: react.createElement, jsxs: react.createElement }));
const { AuthContextProvider } = await import("./AuthContext");
const render = () => {
  cursor = 0;
  effects = [];
  const value = (
    AuthContextProvider({ children: null }) as unknown as {
      props: {
        value: {
          user: { consents?: UserConsents } | null;
          updateConsents: (changes: UserConsents) => Promise<void>;
        };
      };
    }
  ).props.value;
  if (mounted) effects.forEach((effect) => effect());
  return value;
};
const restart = async () => {
  slots = [];
  effects = [];
  mounted = false;
  render();
  mounted = true;
  effects.forEach((effect) => effect());
  await onAuth(currentAccount);
  return render();
};
const accepted = {
  ...acceptPolicies(),
  ...telemetryConsents({ analytics: false, crashReports: false }),
};
beforeEach(() => {
  errors = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  storage.clear();
  recorded = undefined;
  profileUnavailable = false;
  pending = null;
  currentAccount = account;
  failLocalWrite = false;
  applied = { analytics: false, crashReports: false };
});
afterEach(() => {
  console.error = originalConsoleError;
  for (const [message, error] of errors) {
    assert.equal(message, "Error loading user profile from Firestore:");
    assert.equal((error as Error).message, "Profile offline");
  }
});

test("accepting once survives a restart when the account profile cannot be loaded", async () => {
  const first = await restart();
  await first.updateConsents(accepted);
  profileUnavailable = true;
  const afterUpdate = await restart();
  assert.deepEqual(afterUpdate.user?.consents, accepted);
  assert.equal(needsConsent(afterUpdate.user?.consents), false);
});

test("existing account acceptance is migrated to device storage without accepting again", async () => {
  recorded = accepted;
  await restart();
  profileUnavailable = true;
  assert.equal(needsConsent((await restart()).user?.consents), false);
});

test("an account without recorded consent still needs to accept", async () => {
  profileUnavailable = true;
  assert.equal(needsConsent((await restart()).user?.consents), true);
});

test("cached acceptance is never reused for a different account", async () => {
  recorded = accepted;
  await restart();
  currentAccount = { ...account, uid: "other" };
  profileUnavailable = true;
  assert.equal(needsConsent((await restart()).user?.consents), true);
});

test("remote revocations override previously cached telemetry grants", async () => {
  recorded = { ...accepted, ...telemetryConsents({ analytics: true, crashReports: true }) };
  await restart();
  recorded = accepted;
  const reloaded = await restart();
  assert.equal(reloaded.user?.consents?.analytics?.granted, false);
  assert.equal(reloaded.user?.consents?.crashReports?.granted, false);
});

test("a failed cache write cannot restore a revoked purpose when another preference changes offline", async () => {
  recorded = { ...accepted, ...telemetryConsents({ analytics: true, crashReports: true }) };
  const first = await restart();
  failLocalWrite = true;
  await first.updateConsents({
    analytics: { granted: false, updatedAt: "2026-10-22T00:00:00.000Z" },
  });
  assert.equal(recorded?.analytics?.granted, false);
  profileUnavailable = true;
  const offline = await restart();
  assert.equal(needsConsent(offline.user?.consents), false);
  await offline.updateConsents({
    crashReports: { granted: false, updatedAt: "2026-10-22T00:00:01.000Z" },
  });
  assert.equal(applied.analytics, false);
});

test("pending device revocations still override cached grants when offline", async () => {
  recorded = { ...accepted, ...telemetryConsents({ analytics: true, crashReports: true }) };
  await restart();
  profileUnavailable = true;
  pending = { analytics: false, crashReports: false };
  const reloaded = await restart();
  assert.equal(needsConsent(reloaded.user?.consents), false);
  assert.equal(reloaded.user?.consents?.analytics?.granted, false);
  assert.equal(reloaded.user?.consents?.crashReports?.granted, false);
});
