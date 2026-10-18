import { getApp } from "@react-native-firebase/app";
import { getAuth, connectAuthEmulator } from "@react-native-firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "@react-native-firebase/firestore";
import {
  resolveFirebaseEmulatorConfig,
  setFirebaseEmulatorMode,
} from "@/utils/firebaseEmulatorConfig";

let configured = false;
let emulatorMode = false;

/** Must run once before rendering any provider that may call getAuth/getFirestore. */
export function configureFirebaseEmulators(): boolean {
  if (configured) return emulatorMode;

  const config = resolveFirebaseEmulatorConfig({
    enabled: process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS,
    isDev: __DEV__,
    projectId: getApp().options.projectId,
  });
  if (config.enabled) {
    connectAuthEmulator(getAuth(), `http://${config.auth.host}:${config.auth.port}`);
    connectFirestoreEmulator(getFirestore(), config.firestore.host, config.firestore.port);
  }

  emulatorMode = config.enabled;
  setFirebaseEmulatorMode(emulatorMode);
  configured = true;
  return emulatorMode;
}

export function isFirebaseEmulatorConfigured(): boolean {
  return configured && emulatorMode;
}
