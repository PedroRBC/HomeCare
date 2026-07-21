import { useMemo } from "react";
import { useSchedule } from "@/context/ScheduleContext";
import { dateKey, parseCalendarDate } from "@/utils/date";
import { buildExtraPeriodKey, resolvePeriodKey } from "@/utils/paymentDomain";

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 45;

export const useUpcomingPayments = () => {
  const {
    caregivers,
    scheduleByDay,
    isPaidForCaregiverShift,
  } = useSchedule();

  const upcomingPayments = useMemo(() => {
    const today = new Date();
    const items: {
      id: string;
      caregiver: string;
      caregiverId: string;
      date: Date;
      paid: boolean;
      frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário";
      description: string;
      amount: number;
      daysWorked: number;
      dayShifts: number;
      nightShifts: number;
      periodKey: string;
    }[] = [];

    caregivers.forEach((cg) => {
      const scanWindowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - LOOKBACK_DAYS);
      const scanWindowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + LOOKAHEAD_DAYS);

      const periodStart = new Date(scanWindowStart);
      const periodEnd = new Date(scanWindowEnd);

      if (cg.frequency === "Semanal") {
        const startDay = periodStart.getDay();
        const daysToSubtract = startDay === 6 ? 0 : startDay === 0 ? 1 : startDay + 1;
        periodStart.setDate(periodStart.getDate() - daysToSubtract);

        const endDay = periodEnd.getDay();
        const daysToAdd = endDay === 5 ? 0 : endDay === 6 ? 6 : 5 - endDay;
        periodEnd.setDate(periodEnd.getDate() + daysToAdd);
      } else if (cg.frequency === "Quinzenal") {
        periodStart.setDate(periodStart.getDate() <= 15 ? 1 : 16);
        periodEnd.setDate(1);
        periodEnd.setMonth(periodEnd.getMonth() + 1, 0);
      } else if (cg.frequency === "Mensal") {
        periodStart.setDate(1);
        periodEnd.setMonth(periodEnd.getMonth() + 1, 0);
      }

      const periodGroups = new Map<
        string,
        {
          dates: Date[];
          periodStart: Date;
          periodKey: string;
        }
      >();

      Object.keys(scheduleByDay).forEach((dateStr) => {
        const d = parseCalendarDate(dateStr);

        if (d < periodStart || d > periodEnd) {
          return;
        }

        const daySchedule = scheduleByDay[dateStr];
        if (!daySchedule) return;

        const isDayScheduled = (daySchedule.day ?? []).includes(cg.id);
        const isNightScheduled = (daySchedule.night ?? []).includes(cg.id);

        if (isDayScheduled || isNightScheduled) {
          const periodKey = resolvePeriodKey(d, cg.frequency);
          if (!periodGroups.has(periodKey)) {
            let periodStartForKey: Date;
            if (cg.frequency === "Semanal") {
              const [y, m, day] = periodKey.split("-").map(Number);
              periodStartForKey = new Date(y, m - 1, day, 12);
            } else if (cg.frequency === "Quinzenal") {
              const parts = periodKey.split("-");
              const y = Number(parts[1]);
              const m = Number(parts[2]);
              const half = Number(parts[3]);
              periodStartForKey = new Date(y, m - 1, half === 1 ? 1 : 16, 12);
            } else if (cg.frequency === "Mensal") {
              const [y, m] = periodKey.split("-").map(Number);
              periodStartForKey = new Date(y, m - 1, 1, 12);
            } else {
              periodStartForKey = new Date(d);
            }

            periodGroups.set(periodKey, {
              dates: [],
              periodStart: periodStartForKey,
              periodKey,
            });
          }

          periodGroups.get(periodKey)!.dates.push(d);
        }

        const isExtraDayScheduled = (daySchedule.dayExtra ?? []).includes(cg.id);
        if (isExtraDayScheduled && !isPaidForCaregiverShift(cg, d, "day", "daily-extra")) {
          items.push({
            id: `${cg.id}-extra-day-${dateKey(d)}`,
            caregiver: cg.name,
            caregiverId: cg.id,
            date: new Date(d),
            paid: false,
            frequency: "Diário",
            description: `Extra Dia - ${d.toLocaleDateString("pt-BR")}`,
            amount: cg.dayAmount || cg.amount,
            daysWorked: 1,
            dayShifts: 1,
            nightShifts: 0,
            periodKey: buildExtraPeriodKey(d, "day"),
          });
        }

        const isExtraNightScheduled = (daySchedule.nightExtra ?? []).includes(cg.id);
        if (isExtraNightScheduled && !isPaidForCaregiverShift(cg, d, "night", "daily-extra")) {
          items.push({
            id: `${cg.id}-extra-night-${dateKey(d)}`,
            caregiver: cg.name,
            caregiverId: cg.id,
            date: new Date(d),
            paid: false,
            frequency: "Diário",
            description: `Extra Noite - ${d.toLocaleDateString("pt-BR")}`,
            amount: cg.nightAmount || cg.amount,
            daysWorked: 1,
            dayShifts: 0,
            nightShifts: 1,
            periodKey: buildExtraPeriodKey(d, "night"),
          });
        }
      });

      periodGroups.forEach((group, periodKey) => {
        let hasUnpaidDays = false;
        let totalAmount = 0;
        let dayShifts = 0;
        let nightShifts = 0;
        const workedDates = new Set<string>();

        group.dates.forEach((date) => {
          const daySchedule = scheduleByDay[dateKey(date)];
          if (!daySchedule) return;

          const isDayScheduled = (daySchedule.day ?? []).includes(cg.id);
          const isNightScheduled = (daySchedule.night ?? []).includes(cg.id);

          if (isDayScheduled || isNightScheduled) {
            workedDates.add(dateKey(date));
          }

          const isDayPaid = isDayScheduled ? isPaidForCaregiverShift(cg, date, "day") : true;
          const isNightPaid = isNightScheduled ? isPaidForCaregiverShift(cg, date, "night") : true;

          if ((isDayScheduled && !isDayPaid) || (isNightScheduled && !isNightPaid)) {
            hasUnpaidDays = true;

            if (isDayScheduled && !isDayPaid) {
              dayShifts++;
              totalAmount += cg.dayAmount || cg.amount;
            }
            if (isNightScheduled && !isNightPaid) {
              nightShifts++;
              totalAmount += cg.nightAmount || cg.amount;
            }
          }
        });

        if (hasUnpaidDays && workedDates.size > 0) {
          let description = "";
          if (cg.frequency === "Semanal") {
            const start = new Date(group.periodStart);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            description = `Semana de ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
          } else if (cg.frequency === "Quinzenal") {
            description = `${group.periodStart.getDate() <= 15 ? "1ª" : "2ª"} Quinzena de ${group.periodStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
          } else {
            description = group.periodStart.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            });
          }

          items.push({
            id: `${cg.id}-${periodKey}`,
            caregiver: cg.name,
            caregiverId: cg.id,
            date: group.periodStart,
            paid: false,
            frequency: cg.frequency,
            description,
            amount: totalAmount,
            daysWorked: workedDates.size,
            dayShifts,
            nightShifts,
            periodKey,
          });
        }
      });
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [caregivers, isPaidForCaregiverShift, scheduleByDay]);

  return upcomingPayments;
};
