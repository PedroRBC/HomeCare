import type { Caregiver, DaySchedule, ShiftType } from "@/context/ScheduleContext";
import type { ThemeColors } from "@/theme/palette";
import { dateKey } from "@/utils/date";
import { periodRange } from "@/utils/paymentDomain";
import type { UpcomingPayment } from "@/utils/upcomingPayments";

// The snapshot is stored unencrypted and drawn on the home screen: keep only what widgets show.
export const WIDGET_DAYS = 8;

export const WIDGET_LABEL_KEYS = [
  "todayTitle",
  "today",
  "tomorrow",
  "day",
  "night",
  "nobody",
  "paymentsTitle",
  "pending",
  "upcoming",
  "allPaid",
  "next",
  "openApp",
] as const;
export type WidgetLabels = Record<(typeof WIDGET_LABEL_KEYS)[number], string>;

const PALETTE_KEYS = [
  "surface",
  "text",
  "textSecondary",
  "primary",
  "primarySoft",
  "night",
  "nightSoft",
  "danger",
  "dangerSoft",
  "success",
] as const;
export type WidgetPalette = Pick<ThemeColors, (typeof PALETTE_KEYS)[number]>;

export type WidgetShifts = Record<ShiftType, string[]>;
export type WidgetPayment = { caregiver: string; due: string; amount?: number };

export type WidgetSnapshot = {
  locale: string;
  labels: WidgetLabels;
  palettes: Record<"light" | "dark", WidgetPalette>;
  house: null | {
    name: string;
    days: Record<string, WidgetShifts>;
    payments: WidgetPayment[];
  };
};

export const pickWidgetPalette = (colors: ThemeColors): WidgetPalette =>
  Object.fromEntries(PALETTE_KEYS.map((key) => [key, colors[key]])) as WidgetPalette;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);

export function buildWidgetHouse({
  name,
  caregivers,
  scheduleByDay,
  payments,
  showAmounts,
  today = new Date(),
}: {
  name: string;
  caregivers: Caregiver[];
  scheduleByDay: Record<string, DaySchedule>;
  payments: UpcomingPayment[];
  showAmounts: boolean;
  today?: Date;
}): NonNullable<WidgetSnapshot["house"]> {
  const names = new Map(caregivers.map((cg) => [cg.id, firstName(cg.name)]));
  const shiftNames = (ids: string[]) =>
    [...new Set(ids)].flatMap((id) => (names.has(id) ? [names.get(id)!] : []));
  const days: Record<string, WidgetShifts> = {};
  for (let i = 0; i < WIDGET_DAYS; i++) {
    const key = dateKey(addDays(today, i));
    const schedule = scheduleByDay[key];
    days[key] = {
      day: shiftNames([...(schedule?.day ?? []), ...(schedule?.dayExtra ?? [])]),
      night: shiftNames([...(schedule?.night ?? []), ...(schedule?.nightExtra ?? [])]),
    };
  }
  return {
    name,
    days,
    payments: payments.map((payment) => ({
      caregiver: firstName(payment.caregiver),
      due: dateKey(periodRange(payment.date, payment.frequency).end),
      ...(showAmounts ? { amount: payment.amount } : {}),
    })),
  };
}

export function shiftsFor(house: NonNullable<WidgetSnapshot["house"]>, now = new Date()) {
  return {
    today: house.days[dateKey(now)],
    tomorrow: house.days[dateKey(addDays(now, 1))],
  };
}

// Same rule as isPaymentPending: due from the last day of the period on.
export function paymentSummary(house: NonNullable<WidgetSnapshot["house"]>, now = new Date()) {
  const today = dateKey(now);
  const weekEnd = dateKey(addDays(now, 7));
  const pending = house.payments.filter((p) => p.due <= today);
  const upcoming = house.payments.filter((p) => p.due > today && p.due <= weekEnd);
  const next = house.payments
    .filter((p) => p.due > today)
    .sort((a, b) => (a.due < b.due ? -1 : 1))[0];
  const amounts = pending.map((p) => p.amount);
  return {
    pending: pending.length,
    upcoming: upcoming.length,
    pendingAmount: amounts.every((a) => a !== undefined)
      ? amounts.reduce((sum, a) => sum + Math.round(a! * 100), 0) / 100
      : undefined,
    next,
  };
}

export type WidgetLink = { screen: "payments" } | { screen: "day"; date: string };

export function parseWidgetLink(url: string): WidgetLink | null {
  const match = /^homecare:\/\/(?:payments|day\/(\d{4}-\d{2}-\d{2}))\/?$/.exec(url);
  if (!match) return null;
  return match[1] ? { screen: "day", date: match[1] } : { screen: "payments" };
}
