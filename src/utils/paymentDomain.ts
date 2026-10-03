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

// Payment keys look like `${shift}-${YYYY-MM-DD}-${periodKey | "extra-daily"}`.
export function parsePaymentKey(
  paymentKey: string,
): { shift: PaymentShift; dayKey: string; mode: PaymentMode } | null {
  const match = paymentKey.match(/^(day|night)-(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (!match) return null;
  return {
    shift: match[1] as PaymentShift,
    dayKey: match[2],
    mode: match[3] === "extra-daily" ? "daily-extra" : "regular",
  };
}

// A paid shift is identified by its day, shift and mode only. Payment keys also
// embed the period they were paid under, which follows the caregiver's frequency
// at that time, so it is left out: changing the frequency must keep shifts paid.
export function paidShiftKey(dayKey: string, shift: PaymentShift, mode: PaymentMode = "regular") {
  return `${mode}:${shift}:${dayKey}`;
}

export function toPaidShifts(paymentKeys: Iterable<string>): Set<string> {
  const paid = new Set<string>();
  for (const key of paymentKeys) {
    const parsed = parsePaymentKey(key);
    if (parsed) paid.add(paidShiftKey(parsed.dayKey, parsed.shift, parsed.mode));
  }
  return paid;
}
