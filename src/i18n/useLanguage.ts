import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import i18n, { detectDeviceLanguage, initLanguage, setLanguagePreference } from "./index";
import { currentLanguage, type LanguagePreference } from "./locale";

let preference: LanguagePreference = "system";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadLanguagePreference = async () => {
  preference = await initLanguage();
  emit();
};

const applyPreference = async (next: LanguagePreference) => {
  preference = next;
  emit();
  await setLanguagePreference(next);
};

/** Re-resolves the language when following the device setting (e.g. changed in system settings). */
const syncWithDevice = () => {
  if (preference !== "system") return;
  const detected = detectDeviceLanguage();
  if (detected !== i18n.language) i18n.changeLanguage(detected);
};

export const useLanguage = () => {
  useTranslation(); // re-render on language change
  const current = useSyncExternalStore(subscribe, () => preference);
  const language = currentLanguage();

  const setPreference = useCallback((next: LanguagePreference) => applyPreference(next), []);

  return { preference: current, language, setPreference };
};

/** Keeps "device language" mode in sync when the app returns to the foreground. */
export const useDeviceLanguageSync = () => {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncWithDevice();
    });
    return () => subscription.remove();
  }, []);
};
