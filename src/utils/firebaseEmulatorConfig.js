const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isEnabled(value) {
  return value === "1" || value === "true";
}

function resolveFirebaseEmulatorConfig({
  enabled,
  isDev,
  projectId,
  authHost = "127.0.0.1",
  firestoreHost = "127.0.0.1",
} = {}) {
  if (!isEnabled(enabled)) return { enabled: false };
  if (!isDev) {
    throw new Error("Firebase emulators may only be enabled in __DEV__ builds.");
  }
  if (typeof projectId !== "string" || !/^demo-[a-z0-9-]+$/.test(projectId)) {
    throw new Error("Firebase emulators require a demo-* Firebase project.");
  }
  if (!LOOPBACK_HOSTS.has(authHost) || !LOOPBACK_HOSTS.has(firestoreHost)) {
    throw new Error("Firebase emulator hosts must be loopback addresses (adb reverse).");
  }
  return {
    enabled: true,
    projectId,
    auth: { host: authHost, port: 9199 },
    firestore: { host: firestoreHost, port: 8180 },
  };
}

let firebaseEmulatorMode = false;

function setFirebaseEmulatorMode(enabled) {
  firebaseEmulatorMode = enabled === true;
}

function isFirebaseEmulatorMode() {
  return firebaseEmulatorMode;
}

module.exports = {
  resolveFirebaseEmulatorConfig,
  setFirebaseEmulatorMode,
  isFirebaseEmulatorMode,
};
