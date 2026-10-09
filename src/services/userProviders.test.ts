import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const profiles = new Map<string, Record<string, unknown>>();
const writes: { path: string; data: Record<string, unknown>; merge?: boolean }[] = [];
type Ref = { path: string };

mock.module("@react-native-firebase/firestore", () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  doc: (_db: unknown, ...segments: string[]): Ref => ({ path: segments.join("/") }),
  setDoc: async ({ path }: Ref, data: Record<string, unknown>, options?: { merge?: boolean }) => {
    writes.push({ path, data, merge: options?.merge });
    profiles.set(path, options?.merge ? { ...profiles.get(path), ...data } : data);
  },
  updateDoc: async ({ path }: Ref, data: Record<string, unknown>) => {
    writes.push({ path, data });
    profiles.set(path, { ...profiles.get(path), ...data });
  },
  getDoc: async () => ({}),
  getDocs: async () => ({}),
  deleteDoc: async () => {},
  query: () => ({}),
  orderBy: () => ({}),
  where: () => ({}),
  onSnapshot: () => () => {},
  writeBatch: () => ({}),
  runTransaction: async () => {},
  Timestamp: {},
  arrayUnion: () => [],
}));
mock.module("@/services/houseKeys", () => ({ HouseKeyService: { clear: () => {} } }));
mock.module("@/services/firebase", () => ({ CrashlyticsService: { logError: () => {} } }));
const { FirestoreService } = await import("./firestore");

beforeEach(() => {
  profiles.clear();
  writes.length = 0;
});

test("overlapping Facebook profile creation merges without overwriting recorded consents", async () => {
  const consents = { privacyPolicy: { version: "accepted", acceptedAt: "date" } };
  profiles.set("users/facebook-user", { id: "facebook-user", consents });
  for (let attempt = 0; attempt < 2; attempt++) {
    await FirestoreService.createUserProfile(
      "facebook-user",
      "",
      "User",
      undefined,
      ["facebook.com"],
      false,
    );
  }
  assert.equal(profiles.get("users/facebook-user")?.consents, consents);
  assert.equal(profiles.get("users/facebook-user")?.email, "");
  assert.deepEqual(profiles.get("users/facebook-user")?.providers, ["facebook.com"]);
  assert.equal(profiles.get("users/facebook-user")?.hasPassword, false);
  assert.ok(writes.every(({ merge, data }) => merge && !("consents" in data)));
});

test("provider metadata refresh preserves profile/consents and follows the Firebase email", async () => {
  const consents = { analytics: { granted: false, updatedAt: "date" } };
  profiles.set("users/facebook-user", { id: "facebook-user", displayName: "User", consents });
  await FirestoreService.updateUserProviders("facebook-user", {
    providers: ["facebook.com", "google.com", "password"],
    hasPassword: true,
    email: "Person@Example.com",
  });
  const profile = profiles.get("users/facebook-user")!;
  assert.equal(profile.displayName, "User");
  assert.equal(profile.consents, consents);
  assert.equal(profile.email, "person@example.com");
  assert.equal(profile.hasPassword, true);
  assert.deepEqual(profile.providers, ["facebook.com", "google.com", "password"]);
  assert.ok(!("emailVerified" in writes[0].data));
});

test("a missing Firebase email remains an absence sentinel, never a synthetic email", async () => {
  await FirestoreService.updateUserProviders("facebook-user", {
    providers: ["facebook.com"],
    hasPassword: false,
    email: null,
  });
  assert.equal(profiles.get("users/facebook-user")?.email, "");
  assert.ok(!("emailVerified" in writes[0].data));
});
