import type { TFunction } from "i18next";

// Payment descriptions are stored (and parsed back, see paymentHistory.ts) in their original
// Portuguese form. This re-renders one in the active language for display only.

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const toDate = (dd: string, mm: string, yyyy: string) =>
  new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12);

export function localizeDescription(description: string, t: TFunction, locale: string): string {
  // Optional trailing shift counts, e.g. " (2 Dias, 1 Noite)"
  const counts = description.match(/^(.*?)(?: \(((?:\d+ (?:Dias?|Noites?)(?:, )?)+)\))?$/);
  const base = counts?.[1] ?? description;
  const shiftPart = counts?.[2];

  const date = (d: Date) => d.toLocaleDateString(locale);
  const monthName = (index: number, year: number) =>
    new Date(year, index, 1).toLocaleDateString(locale, { month: "long" });

  let localized: string | null = null;

  const extra = base.match(/^Extra (Dia|Noite) - (\d{2})\/(\d{2})\/(\d{4})$/);
  const week = base.match(/^Semana de (\d{2})\/(\d{2})\/(\d{4}) a (\d{2})\/(\d{2})\/(\d{4})$/);
  const half = base.match(/^([12])ª Quinzena de ([a-zà-ú]+) de (\d{4})$/i);
  const month = base.match(/^([a-zà-ú]+) de (\d{4})$/i);

  if (extra) {
    const shift = t(extra[1] === "Dia" ? "common.day" : "common.night");
    localized = t("common.period.extra", {
      shift,
      date: date(toDate(extra[2], extra[3], extra[4])),
    });
  } else if (week) {
    localized = t("common.period.week", {
      start: date(toDate(week[1], week[2], week[3])),
      end: date(toDate(week[4], week[5], week[6])),
    });
  } else if (half && MONTHS_PT.includes(half[2].toLowerCase())) {
    const year = Number(half[3]);
    localized = t(half[1] === "1" ? "common.period.firstHalf" : "common.period.secondHalf", {
      month: monthName(MONTHS_PT.indexOf(half[2].toLowerCase()), year),
      year,
    });
  } else if (month && MONTHS_PT.includes(month[1].toLowerCase())) {
    const year = Number(month[2]);
    localized = t("common.period.month", {
      month: monthName(MONTHS_PT.indexOf(month[1].toLowerCase()), year),
      year,
    });
  }

  if (localized === null) return description; // unknown format: keep what was stored

  if (shiftPart) {
    const parts = shiftPart.split(", ").map((part) => {
      const [n, word] = part.split(" ");
      const count = Number(n);
      return t(word.startsWith("Dia") ? "common.daysCount" : "common.nightsCount", { count });
    });
    localized += ` (${parts.join(", ")})`;
  }
  return localized;
}
