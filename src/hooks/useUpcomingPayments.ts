import { useMemo } from "react";
import { useSchedule } from "@/context/ScheduleContext";
import { monthKey, saturdayWeek } from "@/utils/date";

export const useUpcomingPayments = () => {
	const { caregivers, getScheduledCaregivers, isPaidForCaregiverShift } = useSchedule();

	const upcomingPayments = useMemo(() => {
		const today = new Date();
		const items: {
			id: string;
			caregiver: string;
			caregiverId: string;
			date: Date;
			paid: boolean;
			frequency: "Semanal" | "Quinzenal" | "Mensal";
			description: string;
			amount: number;
			daysWorked: number;
			dayShifts: number;
			nightShifts: number;
			periodKey: string;
		}[] = [];

		caregivers.forEach((cg) => {
			// Group by frequency periods
			const periodGroups = new Map<
				string,
				{
					dates: Date[];
					dayShifts: Date[];
					nightShifts: Date[];
					periodStart: Date;
					periodKey: string;
				}
			>();

			// Look back 30 days, forward 60 days
			for (let i = -30; i < 60; i++) {
				const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
				const dayCaregivers = getScheduledCaregivers(d, "day");
				const nightCaregivers = getScheduledCaregivers(d, "night");

				const isDayScheduled = dayCaregivers.some((x: any) => x.id === cg.id);
				const isNightScheduled = nightCaregivers.some((x: any) => x.id === cg.id);

				if (isDayScheduled || isNightScheduled) {
					let periodKey = "";
					let periodStart = new Date();

					if (cg.frequency === "Semanal") {
						// Get the Saturday of the week (start of week)
						periodStart = new Date(d);
						const dayOfWeek = periodStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
						// Calculate days to subtract to get to Saturday
						const daysToSubtract = dayOfWeek === 6 ? 0 : (dayOfWeek === 0 ? 1 : dayOfWeek + 1);
						periodStart.setDate(periodStart.getDate() - daysToSubtract);
						periodKey = saturdayWeek(periodStart);
					} else if (cg.frequency === "Quinzenal") {
						// First 15 days of month vs rest of month
						const dayOfMonth = d.getDate();
						const year = d.getFullYear();
						const month = d.getMonth();

						if (dayOfMonth <= 15) {
							// First half of month (1-15)
							periodStart = new Date(year, month, 1);
							periodKey = `quinzenal-${year}-${month + 1}-1`;
						} else {
							// Second half of month (16-end)
							periodStart = new Date(year, month, 16);
							periodKey = `quinzenal-${year}-${month + 1}-2`;
						}
					} else {
						// Mensal
						periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
						periodKey = monthKey(d.getFullYear(), d.getMonth());
					}

					if (!periodGroups.has(periodKey)) {
						periodGroups.set(periodKey, {
							dates: [],
							dayShifts: [],
							nightShifts: [],
							periodStart,
							periodKey,
						});
					}

					const group = periodGroups.get(periodKey)!;
					group.dates.push(d);
					if (isDayScheduled) group.dayShifts.push(d);
					if (isNightScheduled) group.nightShifts.push(d);
				}
			}

			// Process each period group
			periodGroups.forEach((group, periodKey) => {
				// Check if any day in this period is unpaid
				let hasUnpaidDays = false;
				let totalAmount = 0;
				let daysWorked = 0;
				let dayShifts = 0;
				let nightShifts = 0;
				const workedDates = new Set<string>(); // Track unique dates worked

				group.dates.forEach((date) => {
					const dayCaregivers = getScheduledCaregivers(date, "day");
					const nightCaregivers = getScheduledCaregivers(date, "night");

					const isDayScheduled = dayCaregivers.some((x: any) => x.id === cg.id);
					const isNightScheduled = nightCaregivers.some((x: any) => x.id === cg.id);

					const isDayPaid = isDayScheduled ? isPaidForCaregiverShift(cg, date, "day") : true;
					const isNightPaid = isNightScheduled ? isPaidForCaregiverShift(cg, date, "night") : true;

					// Count this as a worked day if any shift is scheduled and unpaid
					const dateKey = date.toISOString().split("T")[0];
					if ((isDayScheduled && !isDayPaid) || (isNightScheduled && !isNightPaid)) {
						hasUnpaidDays = true;
						workedDates.add(dateKey);

						// Count unpaid shifts
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

				daysWorked = workedDates.size;

				// Only add if there are unpaid days
				if (hasUnpaidDays && daysWorked > 0) {
					let description = "";
					if (cg.frequency === "Semanal") {
						// Show the full week range (Sunday to Saturday)
						const sunday = group.periodStart;
						const saturday = new Date(sunday);
						saturday.setDate(sunday.getDate() + 6);
						description = `Semana de ${sunday.toLocaleDateString("pt-BR")} a ${saturday.toLocaleDateString("pt-BR")}`;
					} else if (cg.frequency === "Quinzenal") {
						const dayOfMonth = group.periodStart.getDate();
						if (dayOfMonth === 1) {
							description = `1ª Quinzena de ${group.periodStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
						} else {
							description = `2ª Quinzena de ${group.periodStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
						}
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
						daysWorked,
						dayShifts,
						nightShifts,
						periodKey,
					});
				}
			});
		});

		// Sort by date (past first, then future)
		return items.sort((a, b) => a.date.getTime() - b.date.getTime());
	}, [caregivers, isPaidForCaregiverShift, getScheduledCaregivers]);

	return upcomingPayments;
};
