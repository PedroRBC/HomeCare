import type { Caregiver, DaySchedule } from "@/context/ScheduleContext";
import { dateKey, parseCalendarDate } from "@/utils/date";
import { describePeriod, periodRange, type PaymentFrequency } from "@/utils/paymentDomain";
import {
  collectPaymentObligations,
  moneyInCents,
  type IsShiftPaid,
} from "@/utils/paymentObligations";

export type UpcomingPayment = {
  id: string;
  caregiver: string;
  caregiverId: string;
  date: Date;
  frequency: PaymentFrequency;
  description: string;
  amount: number;
  dayShifts: number;
  nightShifts: number;
  periodKey: string;
  regularAmount?: number;
  additionalAmount?: number;
  additionalCount?: number;
};

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 45;

export function buildUpcomingPayments(
  caregivers: Caregiver[],
  scheduleByDay: Record<string, DaySchedule>,
  isPaid: IsShiftPaid,
  today = new Date(),
): UpcomingPayment[] {
  const items: UpcomingPayment[] = [];
  const offset = (days: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  for (const cg of caregivers) {
    const scanStart = dateKey(periodRange(offset(-LOOKBACK_DAYS), cg.frequency).start);
    const scanEnd = dateKey(periodRange(offset(LOOKAHEAD_DAYS), cg.frequency).end);
    const periods = new Map<string, { payment: UpcomingPayment; shifts: Set<string> }>();
    for (const obligation of collectPaymentObligations(cg, scheduleByDay, isPaid)) {
      const { dayKey, shift, mode, periodKey, frequency, amount } = obligation;
      if (dayKey < scanStart || dayKey > scanEnd) continue;
      const date = parseCalendarDate(dayKey);
      if (!periods.has(periodKey)) {
        periods.set(periodKey, {
          shifts: new Set(),
          payment: {
            id: `${cg.id}-${periodKey}`,
            caregiver: cg.name,
            caregiverId: cg.id,
            date: mode === "daily-extra" ? date : periodRange(date, frequency).start,
            frequency,
            description:
              mode === "daily-extra"
                ? `Extra ${shift === "day" ? "Dia" : "Noite"} - ${date.toLocaleDateString("pt-BR")}`
                : describePeriod(date, frequency),
            amount: 0,
            regularAmount: 0,
            additionalAmount: 0,
            additionalCount: 0,
            dayShifts: 0,
            nightShifts: 0,
            periodKey,
          },
        });
      }
      const { payment, shifts } = periods.get(periodKey)!;
      const field = mode === "additional" ? "additionalAmount" : "regularAmount";
      payment[field] = (moneyInCents(payment[field]!) + moneyInCents(amount)) / 100;
      payment.amount = (moneyInCents(payment.amount) + moneyInCents(amount)) / 100;
      if (mode === "additional") payment.additionalCount!++;
      const identity = `${dayKey}:${shift}`;
      if (!shifts.has(identity)) {
        shifts.add(identity);
        if (shift === "day") payment.dayShifts++;
        else payment.nightShifts++;
      }
    }
    items.push(...[...periods.values()].map(({ payment }) => payment));
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
