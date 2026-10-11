import type { ThemeScheme } from "./palette";

export const THEME_STORAGE_KEY = "@homecare:theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const parseThemePreference = (value: unknown): ThemePreference =>
  value === "light" || value === "dark" || value === "system" ? value : "system";

export const resolveThemeScheme = (
  preference: ThemePreference,
  systemScheme: unknown,
): ThemeScheme =>
  preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;

interface ThemeStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
}

interface ThemeSnapshot {
  preference: ThemePreference;
  scheme: ThemeScheme;
  loaded: boolean;
}

/** Shared by the provider; kept native-free so persistence races can be tested directly. */
export const createThemeStore = (storage: ThemeStorage, initialSystemScheme: unknown) => {
  let systemScheme = initialSystemScheme;
  let snapshot: ThemeSnapshot = {
    preference: "system",
    scheme: resolveThemeScheme("system", systemScheme),
    loaded: false,
  };
  let revision = 0;
  let hydration: Promise<void> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const hydrate = () => {
    if (hydration) return hydration;
    const initialRevision = revision;
    hydration = (async () => {
      let preference: ThemePreference = "system";
      try {
        preference = parseThemePreference(await storage.getItem(THEME_STORAGE_KEY));
      } catch {
        // Unavailable storage should never block startup or disable Auto.
      }
      if (revision !== initialRevision) preference = snapshot.preference;
      snapshot = {
        preference,
        scheme: resolveThemeScheme(preference, systemScheme),
        loaded: true,
      };
      emit();
    })();
    return hydration;
  };

  const setPreference = (value: ThemePreference) => {
    const preference = parseThemePreference(value);
    revision += 1;
    snapshot = {
      ...snapshot,
      preference,
      scheme: resolveThemeScheme(preference, systemScheme),
    };
    emit();
    // Apply immediately, persist serially: a slow earlier write cannot win over a later tap.
    pending = pending.then(() => storage.setItem(THEME_STORAGE_KEY, preference)).catch(() => {});
    return pending;
  };

  const syncSystemScheme = (next: unknown) => {
    systemScheme = next;
    const scheme = resolveThemeScheme(snapshot.preference, systemScheme);
    if (scheme === snapshot.scheme) return;
    snapshot = { ...snapshot, scheme };
    emit();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate,
    setPreference,
    syncSystemScheme,
  };
};
