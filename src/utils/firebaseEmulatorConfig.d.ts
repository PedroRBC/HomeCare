export function resolveFirebaseEmulatorConfig(input?: {
  enabled?: string;
  isDev?: boolean;
  projectId?: string;
  authHost?: string;
  firestoreHost?: string;
}):
  | { enabled: false }
  | {
      enabled: true;
      projectId: string;
      auth: { host: string; port: number };
      firestore: { host: string; port: number };
    };
export function setFirebaseEmulatorMode(enabled: boolean): void;
export function isFirebaseEmulatorMode(): boolean;
