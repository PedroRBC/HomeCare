import { dateKey, monthKey, saturdayWeek } from "@/utils/date";

export type PaymentFrequency = "Semanal" | "Quinzenal" | "Mensal" | "Diário";
export type PaymentShift = "day" | "night";
export type PaymentMode = "regular" | "daily-extra";

export const EXTRA_PERIOD_PREFIX = "extra";

export function resolvePeriodKey(date: Date, frequency: PaymentFrequency): string {
  if (frequency === "Semanal") {
    return saturdayWeek(date);
  }

  if (frequency === "Quinzenal") {
    const dayOfMonth = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const half = dayOfMonth <= 15 ? 1 : 2;
    return `quinzenal-${year}-${month}-${half}`;
  }

  if (frequency === "Mensal") {
    return monthKey(date.getFullYear(), date.getMonth());
  }

  return dateKey(date);
}

// First and last day of the period containing `date`. Weeks run Saturday to Friday.
export function periodRange(date: Date, frequency: PaymentFrequency): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const at = (d: number, m = month) => new Date(year, m, d, 12);

  if (frequency === "Semanal") {
    const saturday = day - ((date.getDay() + 1) % 7);
    return { start: at(saturday), end: at(saturday + 6) };
  }
  if (frequency === "Quinzenal") {
    return day <= 15 ? { start: at(1), end: at(15) } : { start: at(16), end: at(0, month + 1) };
  }
  if (frequency === "Mensal") {
    return { start: at(1), end: at(0, month + 1) };
  }
  return { start: at(day), end: at(day) };
}

// e.g. "Semana de 03/10/2026 a 09/10/2026", "1ª Quinzena de outubro de 2026", "outubro de 2026"
export function describePeriod(date: Date, frequency: PaymentFrequency): string {
  const { start, end } = periodRange(date, frequency);
  const monthYear = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  if (frequency === "Semanal") {
    return `Semana de ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
  }
  if (frequency === "Quinzenal") {
    return `${start.getDate() === 1 ? "1ª" : "2ª"} Quinzena de ${monthYear}`;
  }
  return monthYear;
}

export function buildPaymentKey({
  date,
  shift,
  frequency,
  mode = "regular",
}: {
  date: Date;
  shift: PaymentShift;
  frequency: PaymentFrequency;
  mode?: PaymentMode;
}): string {
  const dayKey = dateKey(date);

  if (mode === "daily-extra") {
    return `${shift}-${dayKey}-extra-daily`;
  }

  const periodKey = resolvePeriodKey(date, frequency);
  return `${shift}-${dayKey}-${periodKey}`;
}

export function buildExtraPeriodKey(date: Date, shift: PaymentShift): string {
  return `${EXTRA_PERIOD_PREFIX}-${shift}-${dateKey(date)}`;
}

export function parseExtraPeriodKey(
  periodKey: string,
): { shift: PaymentShift; dayKey: string } | null {
  const match = periodKey.match(/^extra-(day|night)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { shift: match[1] as PaymentShift, dayKey: match[2] };
}

export function buildHistoryKey({
  caregiverId,
  periodKey,
  frequency,
  mode = "regular",
}: {
  caregiverId: string;
  periodKey: string;
  frequency: PaymentFrequency;
  mode?: PaymentMode;
}): string {
  return `${caregiverId}::${frequency}::${mode}::${periodKey}`;
}
