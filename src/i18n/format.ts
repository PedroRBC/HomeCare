/* eslint-disable import/no-named-as-default-member -- i18n is the shared i18next instance */
import i18n from "i18next";
import { localizeDescription } from "@/utils/localizeDescription";
import { currentLocale } from "./locale";

export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString(currentLocale(), options);

export const formatTime = (date: Date, options?: Intl.DateTimeFormatOptions) =>
  date.toLocaleTimeString(currentLocale(), options);

export const formatDateTime = (date: Date) => date.toLocaleString(currentLocale());

export const formatMonthYear = (date: Date) =>
  date.toLocaleDateString(currentLocale(), { month: "long", year: "numeric" });

// Amounts are always in Brazilian reais; only the number formatting follows the language.
export const formatMoney = (value: number) =>
  `R$ ${value.toLocaleString(currentLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 20 })}`;

export const frequencyLabel = (frequency: string) =>
  i18n.t(`common.frequency.${frequency}`, { defaultValue: frequency });

export const localizedDescription = (description: string) =>
  localizeDescription(description, i18n.t.bind(i18n), currentLocale());

// Number as typed in an input: locale decimal separator, no grouping, full stored precision. Parsing accepts "," or ".".
export const formatInputNumber = (value: number) =>
  value.toLocaleString(currentLocale(), { useGrouping: false, maximumFractionDigits: 20 });
