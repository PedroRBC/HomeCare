import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import type { UpdateConfig } from "@/services/appUpdateService";
import { createRenderer, installNativeRuntime } from "../test/native";

installNativeRuntime();
const react = await import("react");
// This provider uses callbacks with empty dependencies; retain their identity across renders.
const useCallback = <T>(callback: T) => react.useRef(callback).current;
mock.module("react", () => ({
  ...react,
  useCallback,
  default: { ...react.default, useCallback },
}));

let config: UpdateConfig;
let maintenance = false;
let refreshes = 0;
let listener: ((state: string) => void) | undefined;
let removed = false;
mock.module("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, callback: typeof listener) => {
      listener = callback;
      return { remove: () => (removed = true) };
    },
  },
}));
mock.module("@/services/appUpdateService", () => ({
  AppUpdateService: {
    refresh: async () => {
      refreshes++;
    },
    checkMaintenanceMode: async () => ({ isMaintenance: maintenance, message: "maintenance" }),
    checkForUpdate: async () => ({
      config,
      hasUpdate: config.updateType !== "none",
      isRequired: config.updateType === "required",
    }),
  },
}));

let renderer: ReturnType<typeof createRenderer>;
const { AppUpdateProvider } = await import("./AppUpdateContext");
type UpdateContext = {
  showUpdateModal: boolean;
  showMaintenanceModal: boolean;
  updateConfig: UpdateConfig;
  setShowUpdateModal: (show: boolean) => void;
  checkForUpdate: () => Promise<void>;
};
const render = () =>
  renderer.render(
    () =>
      (AppUpdateProvider({ children: null }) as unknown as { props: { value: UpdateContext } })
        .props.value,
  );
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const mount = async () => {
  render();
  await flush();
  return () => renderer.unmount();
};
beforeEach(() => {
  renderer = createRenderer();
  listener = undefined;
  removed = false;
  refreshes = 0;
  maintenance = false;
  config = {
    minimumVersion: "3.0.0",
    currentVersion: "3.0.2",
    latestVersion: "3.0.3",
    updateType: "optional",
    updateMessage: "update",
    forceUpdate: false,
  };
});

test("optional updates prompt at startup and are not repeated for the same version in a session", async () => {
  await mount();
  assert.equal(render().showUpdateModal, true);
  render().setShowUpdateModal(false);
  await render().checkForUpdate();
  assert.equal(render().showUpdateModal, false);
  config = { ...config, latestVersion: "3.0.4" };
  await render().checkForUpdate();
  assert.equal(render().showUpdateModal, true);
});

test("returning to the foreground refreshes config and removes its listener on unmount", async () => {
  const unmount = await mount();
  assert.equal(refreshes, 1);
  render().setShowUpdateModal(false);
  config = { ...config, latestVersion: "3.0.4" };
  listener?.("background");
  listener?.("active");
  await flush();
  assert.equal(refreshes, 2);
  assert.equal(render().showUpdateModal, true);
  assert.equal(render().updateConfig.latestVersion, "3.0.4");
  listener?.("active");
  await flush();
  assert.equal(refreshes, 2);
  unmount();
  assert.equal(removed, true);
});

test("required updates reappear after a check, while current versions close stale prompts", async () => {
  config = { ...config, updateType: "required", forceUpdate: true };
  await mount();
  assert.equal(render().showUpdateModal, true);
  render().setShowUpdateModal(false);
  await render().checkForUpdate();
  assert.equal(render().showUpdateModal, true);
  config = { ...config, updateType: "none", forceUpdate: false };
  await render().checkForUpdate();
  assert.equal(render().showUpdateModal, false);
});

test("maintenance takes priority and its modal closes when maintenance ends", async () => {
  maintenance = true;
  await mount();
  assert.equal(render().showMaintenanceModal, true);
  assert.equal(render().showUpdateModal, false);
  maintenance = false;
  await render().checkForUpdate();
  assert.equal(render().showMaintenanceModal, false);
  assert.equal(render().showUpdateModal, true);
});
