import type en from "./locales/en";

/** Shape every locale must satisfy: same keys as English, string leaves. */
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };
export type Translations = DeepStrings<typeof en>;
