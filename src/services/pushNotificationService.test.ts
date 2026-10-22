import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

let permissionStatus = "denied";
let permissionRequests = 0;
const storage = new Map<string, string>();
const noop = () => {};
mock.module("react-native", () => ({ Platform: { OS: "android" } }));
mock.module("i18next", () => ({ default: { on: noop, off: noop }, t: (key: string) => key }));
mock.module("@/utils/firebaseEmulatorConfig", () => ({ isFirebaseEmulatorMode: () => false }));
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => storage.set(key, value),
  },
}));
mock.module("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  setNotificationHandler: noop,
  setNotificationChannelAsync: async () => {},
  getPermissionsAsync: async () => ({ status: permissionStatus, canAskAgain: false }),
  requestPermissionsAsync: async () => {
    permissionRequests++;
    permissionStatus = "granted";
    return { status: permissionStatus };
  },
}));
mock.module("@react-native-firebase/messaging", () => ({
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  getMessaging: () => ({}),
  // Firebase reports authorized on Android even when POST_NOTIFICATIONS was denied.
  requestPermission: async () => 1,
  hasPermission: async () => 1,
  getToken: async () => "synthetic-token",
  onMessage: () => noop,
  onNotificationOpenedApp: noop,
  onTokenRefresh: noop,
  setBackgroundMessageHandler: noop,
  getInitialNotification: async () => null,
}));
const { PushNotificationService } = await import("./pushNotificationService");

test("automatic push startup respects denial while explicit Enable can still request permission", async () => {
  const initialized = await PushNotificationService.initialize();
  assert.equal(initialized.hasPermission, false);
  assert.equal(permissionRequests, 0);
  assert.equal(await PushNotificationService.requestPermission(), true);
  assert.equal(permissionRequests, 1);
  assert.equal(await PushNotificationService.checkPermission(), true);
});
