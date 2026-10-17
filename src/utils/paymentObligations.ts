import type { Caregiver, DaySchedule, ShiftType } from "@/context/ScheduleContext";
import { dateKey, parseCalendarDate } from "@/utils/date";
import {
  buildExtraPeriodKey,
  buildPaymentKey,
  resolvePeriodKey,
  type PaymentFrequency,
  type PaymentMode,
} from "@/utils/paymentDomain";

export type IsShiftPaid = (
  caregiver: Caregiver,
  date: Date,
  shift: ShiftType,
  mode?: PaymentMode,
) => boolean;

export type PaymentObligation = {
  dayKey: string;
  shift: ShiftType;
  mode: PaymentMode;
  amount: number;
  paymentKey: string;
  periodKey: string;
  frequency: PaymentFrequency;
};

export function moneyInCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

export function sumAmounts(values: number[]): number {
  return values.reduce((sum, value) => sum + moneyInCents(value), 0) / 100;
}

export function shiftAmount(caregiver: Caregiver, shift: ShiftType): number {
  return (shift === "day" ? caregiver.dayAmount : caregiver.nightAmount) ?? caregiver.amount;
}

export function additionalAmount(caregiver: Caregiver): number {
  const value = caregiver.additionalAmount ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function additionalList(shift: ShiftType): "dayAdditional" | "nightAdditional" {
  return shift === "day" ? "dayAdditional" : "nightAdditional";
}

// Financial components are independent; a paid base must not hide a later bonus.
// Legacy Extras remain full-rate daily obligations, never converted into bonuses.
export function collectPaymentObligations(
  caregiver: Caregiver,
  scheduleByDay: Record<string, DaySchedule>,
  isPaid: IsShiftPaid = () => false,
): PaymentObligation[] {
  if (caregiver.locked) return [];
  const obligations: PaymentObligation[] = [];
  for (const [dayKey, schedule] of Object.entries(scheduleByDay)) {
    const date = parseCalendarDate(dayKey);
    if (dateKey(date) !== dayKey) continue;
    for (const shift of ["day", "night"] as const) {
      const add = (mode: PaymentMode, amount: number) => {
        if (isPaid(caregiver, date, shift, mode)) return;
        const frequency = mode === "daily-extra" ? "Diário" : caregiver.frequency;
        obligations.push({
          dayKey,
          shift,
          mode,
          amount: moneyInCents(amount) / 100,
          frequency,
          periodKey:
            mode === "daily-extra"
              ? buildExtraPeriodKey(date, shift)
              : resolvePeriodKey(date, frequency),
          paymentKey: buildPaymentKey({ date, shift, frequency, mode }),
        });
      };
      if ((shift === "day" ? schedule.dayExtra : schedule.nightExtra)?.includes(caregiver.id)) {
        add("daily-extra", shiftAmount(caregiver, shift));
      }
      if (!schedule[shift].includes(caregiver.id)) continue;
      add("regular", shiftAmount(caregiver, shift));
      if (
        schedule[additionalList(shift)]?.includes(caregiver.id) &&
        additionalAmount(caregiver) > 0
      ) {
        add("additional", additionalAmount(caregiver));
      }
    }
  }
  return obligations;
}
