import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import clientTemplate from "../../docs/google-play/remote-config-client.template.json";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
let settings = { fetchTimeoutMillis: 60_000, minimumFetchIntervalMillis: 43_200_000 };
const remoteConfig = {
  get settings() {
    return { ...settings, fetchTimeMillis: settings.fetchTimeoutMillis };
  },
  set settings(value: {
    fetchTimeoutMillis: number;
    minimumFetchIntervalMillis: number;
    fetchTimeMillis?: number;
  }) {
    // RNFirebase's native conversion gives the legacy property precedence.
    settings = {
      fetchTimeoutMillis: value.fetchTimeMillis ?? value.fetchTimeoutMillis,
      minimumFetchIntervalMillis: value.minimumFetchIntervalMillis,
    };
  },
  defaultConfig: {} as Record<string, unknown>,
};
let values: Record<string, unknown> = {};
let offline = false;
let emulator = false;
const errors: unknown[][] = [];
const originalConsoleError = console.error;
mock.module("@react-native-firebase/remote-config", () => ({
  getRemoteConfig: () => remoteConfig,
  fetchConfig: async () => {
    if (offline) throw new Error("offline");
  },
  activate: async () => true,
  getValue: (_config: unknown, key: string) => ({
    asString: () => String(values[key] ?? remoteConfig.defaultConfig[key] ?? ""),
    asBoolean: () => {
      const value = values[key] ?? remoteConfig.defaultConfig[key] ?? false;
      return value === true || value === "true";
    },
  }),
}));
mock.module("expo-constants", () => ({ default: { expoConfig: { version: "9.9.9" } } }));
mock.module("expo-application", () => ({ nativeApplicationVersion: "3.0.2" }));
mock.module("react-native", () => ({ Platform: { OS: "android" } }));
mock.module("i18next", () => ({ t: (key: string) => key }));
mock.module("@/utils/firebaseEmulatorConfig", () => ({ isFirebaseEmulatorMode: () => emulator }));
const { AppUpdateService } = await import("./appUpdateService");
beforeEach(() => {
  values = { latest_android_version: "3.0.3", minimum_android_version: "3.0.0" };
  offline = false;
  emulator = false;
  errors.length = 0;
  console.error = (...args: unknown[]) => errors.push(args);
});
afterEach(() => {
  console.error = originalConsoleError;
  for (const [, error] of errors) assert.equal((error as Error).message, "offline");
});

test("startup refresh installs defaults and compares against the installed native version", async () => {
  await AppUpdateService.refresh();
  assert.equal(remoteConfig.settings.fetchTimeoutMillis, 10_000);
  assert.equal(remoteConfig.settings.minimumFetchIntervalMillis, 3_600_000);
  assert.equal(remoteConfig.defaultConfig.maintenance_mode, false);
  assert.equal(AppUpdateService.getCurrentVersion(), "3.0.2");
  const update = await AppUpdateService.checkForUpdate();
  assert.equal(update.hasUpdate, true);
  assert.equal(update.isRequired, false);
  assert.equal(update.config.latestVersion, "3.0.3");
});

test("required updates depend on the minimum version and explicit force-update setting", async () => {
  values.minimum_android_version = "3.0.3";
  values.force_update_android = true;
  const update = await AppUpdateService.checkForUpdate();
  assert.equal(update.hasUpdate, true);
  assert.equal(update.isRequired, true);
});

test("versions equal to or newer than the published version do not prompt", async () => {
  for (const latest of ["3.0.2", "3.0.1"]) {
    values.latest_android_version = latest;
    assert.equal((await AppUpdateService.checkForUpdate()).hasUpdate, false);
  }
});

test("failed refresh still uses activated cached values without blocking the app", async () => {
  offline = true;
  assert.equal((await AppUpdateService.refresh()).success, false);
  assert.equal((await AppUpdateService.checkForUpdate()).hasUpdate, true);
});

test("the import template starts neutral and announces only an explicitly published newer version", async () => {
  values = {};
  for (const [key, parameter] of Object.entries(clientTemplate.parameters)) {
    if ("value" in parameter.defaultValue) values[key] = parameter.defaultValue.value;
  }
  assert.equal((await AppUpdateService.checkMaintenanceMode()).isMaintenance, false);
  assert.equal((await AppUpdateService.checkForUpdate()).hasUpdate, false);
  values.latest_android_version = "3.0.3";
  const update = await AppUpdateService.checkForUpdate();
  assert.equal(update.hasUpdate, true);
  assert.equal(update.isRequired, false);
  assert.equal(
    await AppUpdateService.getUpdateUrl(),
    "https://play.google.com/store/apps/details?id=com.pedrorbc.HomeCare",
  );
});

test("emulator mode skips remote update prompts", async () => {
  emulator = true;
  offline = true;
  assert.equal((await AppUpdateService.refresh()).success, true);
  assert.equal((await AppUpdateService.checkForUpdate()).hasUpdate, false);
});
