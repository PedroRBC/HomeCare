import i18n from "i18next";

export const SUPPORTED_LANGUAGES = ["en", "pt", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = SupportedLanguage | "system";

export const FALLBACK_LANGUAGE: SupportedLanguage = "en";

// BCP 47 locale used for dates/numbers per language
export const LOCALE_TAGS: Record<SupportedLanguage, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
};

/** Maps any language code/tag ("pt-PT", "es_MX", "EN") to a supported language, or null. */
export const matchSupportedLanguage = (code?: string | null): SupportedLanguage | null => {
  if (!code) return null;
  const base = code.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : null;
};

/** Active app language, always one of the supported ones. */
export const currentLanguage = (): SupportedLanguage =>
  matchSupportedLanguage(i18n.language) ?? FALLBACK_LANGUAGE;

/** BCP 47 tag for the active language, for toLocaleDateString & friends. */
export const currentLocale = () => LOCALE_TAGS[currentLanguage()];
