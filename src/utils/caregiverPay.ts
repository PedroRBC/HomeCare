import type { Caregiver, DaySchedule } from "@/context/ScheduleContext";
import { dateKey } from "@/utils/date";
import { paidShiftKey, periodRange, type PaymentFrequency } from "@/utils/paymentDomain";
import { buildUpcomingPayments, type UpcomingPayment } from "@/utils/upcomingPayments";

// What a caregiver needs to estimate her own upcoming payments in one house.
// Managers store it encrypted in her link; she never reads the house's caregivers.
export type CaregiverPay = {
  frequency: PaymentFrequency;
  amount: number;
  dayAmount?: number;
  nightAmount?: number;
  additionalAmount?: number;
  paid: string[]; // paidShiftKey() of her recently paid shifts
};

// Older paid shifts can't fall in an upcoming payment (see buildUpcomingPayments)
const PAID_LOOKBACK_DAYS = 62;
const FREQUENCIES: PaymentFrequency[] = ["Semanal", "Quinzenal", "Mensal", "Diário"];

export function buildCaregiverPay(
  caregiver: Caregiver,
  paid: Iterable<string>,
  today = new Date(),
): CaregiverPay {
  const cutoff = dateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - PAID_LOOKBACK_DAYS),
  );
  const { frequency, amount, dayAmount, nightAmount, additionalAmount } = caregiver;
  return {
    frequency,
    amount,
    dayAmount,
    nightAmount,
    additionalAmount,
    paid: [...paid].filter((key) => key.slice(key.lastIndexOf(":") + 1) >= cutoff).sort(),
  };
}

const isAmount = (value: unknown) =>
  value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);

// The decrypted value was written by a manager's app: check it before using it
export function parseCaregiverPay(json: string): CaregiverPay | null {
  try {
    const pay = JSON.parse(json) as CaregiverPay;
    const valid =
      FREQUENCIES.includes(pay.frequency) &&
      typeof pay.amount === "number" &&
      [pay.amount, pay.dayAmount, pay.nightAmount, pay.additionalAmount].every(isAmount) &&
      Array.isArray(pay.paid) &&
      pay.paid.every((key) => typeof key === "string");
    return valid ? pay : null;
  } catch {
    return null;
  }
}

// Unpaid shifts already in the schedule, grouped by payment period. No future shifts are guessed.
export function caregiverUpcomingPayments(
  caregiverId: string,
  { paid, ...rates }: CaregiverPay,
  schedule: Record<string, DaySchedule>,
  today = new Date(),
): UpcomingPayment[] {
  const paidShifts = new Set(paid);
  return buildUpcomingPayments(
    [{ ...rates, id: caregiverId, name: "" }],
    schedule,
    (_, date, shift, mode = "regular") => paidShifts.has(paidShiftKey(dateKey(date), shift, mode)),
    today,
  );
}

// Weeks run Saturday to Friday and count in the month of their Friday, when they close
export function weekOfMonth(date: Date): { week: number; month: Date } {
  const friday = periodRange(date, "Semanal").end;
  return { week: Math.ceil(friday.getDate() / 7), month: friday };
}
