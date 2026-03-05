import { useMemo } from "react";
import { useSchedule } from "@/context/ScheduleContext";
import { dateKey } from "@/utils/date";
import {
	buildExtraPeriodKey,
	resolvePeriodKey,
} from "@/utils/paymentDomain";

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 45;

export const useUpcomingPayments = () => {
	const {
		caregivers,
		getScheduledCaregivers,
		getExtraScheduledCaregivers,
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
			const periodGroups = new Map<
				string,
				{
					dates: Date[];
					periodStart: Date;
					periodKey: string;
				}
			>();

			for (let i = -LOOKBACK_DAYS; i < LOOKAHEAD_DAYS; i++) {
				const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
				const dayCaregivers = getScheduledCaregivers(d, "day");
				const nightCaregivers = getScheduledCaregivers(d, "night");

				const isDayScheduled = dayCaregivers.some((x: any) => x.id === cg.id);
				const isNightScheduled = nightCaregivers.some((x: any) => x.id === cg.id);

				if (isDayScheduled || isNightScheduled) {
					const periodKey = resolvePeriodKey(d, cg.frequency);
					if (!periodGroups.has(periodKey)) {
						periodGroups.set(periodKey, {
							dates: [],
							periodStart: new Date(d),
							periodKey,
						});
					}

					periodGroups.get(periodKey)!.dates.push(d);
				}

				const isExtraDayScheduled = getExtraScheduledCaregivers(d, "day").some((x: any) => x.id === cg.id);
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

				const isExtraNightScheduled = getExtraScheduledCaregivers(d, "night").some(
					(x: any) => x.id === cg.id,
				);
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
			}

			periodGroups.forEach((group, periodKey) => {
				let hasUnpaidDays = false;
				let totalAmount = 0;
				let dayShifts = 0;
				let nightShifts = 0;
				const workedDates = new Set<string>();

				group.dates.forEach((date) => {
					const dayCaregivers = getScheduledCaregivers(date, "day");
					const nightCaregivers = getScheduledCaregivers(date, "night");

					const isDayScheduled = dayCaregivers.some((x: any) => x.id === cg.id);
					const isNightScheduled = nightCaregivers.some((x: any) => x.id === cg.id);

					const isDayPaid = isDayScheduled ? isPaidForCaregiverShift(cg, date, "day") : true;
					const isNightPaid = isNightScheduled ? isPaidForCaregiverShift(cg, date, "night") : true;

					if ((isDayScheduled && !isDayPaid) || (isNightScheduled && !isNightPaid)) {
						hasUnpaidDays = true;
						workedDates.add(dateKey(date));

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
	}, [caregivers, getExtraScheduledCaregivers, getScheduledCaregivers, isPaidForCaregiverShift]);

	return upcomingPayments;
};
