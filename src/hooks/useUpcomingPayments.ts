import { useMemo } from "react";
import { useSchedule, type Caregiver, type ShiftType } from "@/context/ScheduleContext";
import { dateKey, parseCalendarDate } from "@/utils/date";
import {
  buildExtraPeriodKey,
  describePeriod,
  periodRange,
  resolvePeriodKey,
  type PaymentFrequency,
} from "@/utils/paymentDomain";

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 45;

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
};

const shiftAmount = (cg: Caregiver, shift: ShiftType) =>
  shift === "day" ? cg.dayAmount || cg.amount : cg.nightAmount || cg.amount;

const daysFromToday = (days: number) => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
};

// Unpaid shifts around today: regular shifts grouped by the caregiver's payment
// period, extra shifts one by one.
export const useUpcomingPayments = () => {
  const { caregivers, scheduleByDay, isPaidForCaregiverShift } = useSchedule();

  return useMemo(() => {
    const items: UpcomingPayment[] = [];

    caregivers.forEach((cg) => {
      // Scan whole periods so a period is never cut by the window
      const scanStart = dateKey(periodRange(daysFromToday(-LOOKBACK_DAYS), cg.frequency).start);
      const scanEnd = dateKey(periodRange(daysFromToday(LOOKAHEAD_DAYS), cg.frequency).end);
      const periods = new Map<string, UpcomingPayment>();

      Object.entries(scheduleByDay).forEach(([day, schedule]) => {
        if (day < scanStart || day > scanEnd) return;
        const date = parseCalendarDate(day);

        (["day", "night"] as const).forEach((shift) => {
          const label = shift === "day" ? "Dia" : "Noite";
          const extras = shift === "day" ? schedule.dayExtra : schedule.nightExtra;

          if (extras?.includes(cg.id) && !isPaidForCaregiverShift(cg, date, shift, "daily-extra")) {
            items.push({
              id: `${cg.id}-extra-${shift}-${day}`,
              caregiver: cg.name,
              caregiverId: cg.id,
              date,
              frequency: "Diário",
              description: `Extra ${label} - ${date.toLocaleDateString("pt-BR")}`,
              amount: shiftAmount(cg, shift),
              dayShifts: shift === "day" ? 1 : 0,
              nightShifts: shift === "night" ? 1 : 0,
              periodKey: buildExtraPeriodKey(date, shift),
            });
          }

          if (!schedule[shift].includes(cg.id) || isPaidForCaregiverShift(cg, date, shift)) return;

          const periodKey = resolvePeriodKey(date, cg.frequency);
          if (!periods.has(periodKey)) {
            periods.set(periodKey, {
              id: `${cg.id}-${periodKey}`,
              caregiver: cg.name,
              caregiverId: cg.id,
              date: periodRange(date, cg.frequency).start,
              frequency: cg.frequency,
              description: describePeriod(date, cg.frequency),
              amount: 0,
              dayShifts: 0,
              nightShifts: 0,
              periodKey,
            });
          }

          const period = periods.get(periodKey)!;
          period.amount += shiftAmount(cg, shift);
          if (shift === "day") period.dayShifts++;
          else period.nightShifts++;
        });
      });

      items.push(...periods.values());
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [caregivers, isPaidForCaregiverShift, scheduleByDay]);
};
