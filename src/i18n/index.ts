/* eslint-disable import/no-named-as-default-member -- i18n is the shared i18next instance */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

import en from "./locales/en";
import pt from "./locales/pt";
import es from "./locales/es";
import type { Translations } from "./types";
import {
  FALLBACK_LANGUAGE,
  matchSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type LanguagePreference,
  type SupportedLanguage,
} from "./locale";

export * from "./locale";

export const LANGUAGE_STORAGE_KEY = "@homecare/language";

/** First device language (in the user's preference order) that we support, else English. */
export const detectDeviceLanguage = (): SupportedLanguage => {
  try {
    for (const locale of getLocales()) {
      const match = matchSupportedLanguage(locale.languageCode ?? locale.languageTag);
      if (match) return match;
    }
  } catch {
    // fall through to fallback
  }
  return FALLBACK_LANGUAGE;
};

export const resolveLanguage = (preference: LanguagePreference): SupportedLanguage =>
  preference === "system" ? detectDeviceLanguage() : preference;

export const readLanguagePreference = async (): Promise<LanguagePreference> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && matchSupportedLanguage(stored) && stored.length === 2) {
      return stored as SupportedLanguage;
    }
  } catch {
    // storage unavailable: behave as "system"
  }
  return "system";
};

export const saveLanguagePreference = async (preference: LanguagePreference) => {
  try {
    if (preference === "system") await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);
    else await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  } catch {
    // preference is still applied for this session
  }
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt satisfies Translations },
    es: { translation: es satisfies Translations },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

/** Loads the stored preference (if any) and applies it. Call once on app start. */
export const initLanguage = async () => {
  const preference = await readLanguagePreference();
  await i18n.changeLanguage(resolveLanguage(preference));
  return preference;
};

export const setLanguagePreference = async (preference: LanguagePreference) => {
  await saveLanguagePreference(preference);
  await i18n.changeLanguage(resolveLanguage(preference));
};

export default i18n;
