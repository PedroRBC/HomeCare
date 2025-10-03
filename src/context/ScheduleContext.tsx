import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { dateKey, monthKey, saturdayWeek } from "@/utils/date";
import { AnalyticsService } from "@/services/firebase";
import { FirestoreService } from "@/services/firestore";
import { getFirestore, doc, deleteDoc } from "@react-native-firebase/firestore";
import { useAuth } from "./AuthContext";
import { useHouse } from "./HouseContext";

// Helper function to convert Portuguese month names to month indices (0-11)
const getPortugueseMonthIndex = (monthName: string): number => {
	const monthMap: Record<string, number> = {
		janeiro: 0,
		fevereiro: 1,
		março: 2,
		abril: 3,
		maio: 4,
		junho: 5,
		julho: 6,
		agosto: 7,
		setembro: 8,
		outubro: 9,
		novembro: 10,
		dezembro: 11,
	};
	return monthMap[monthName.toLowerCase()] ?? -1;
};

export type Frequency = "Semanal" | "Quinzenal" | "Mensal";
export type ShiftType = "day" | "night";
export type Caregiver = {
	id: string;
	name: string;
	frequency: Frequency;
	amount: number;
	dayAmount?: number;
	nightAmount?: number;
	disabled?: boolean;
};

export type DaySchedule = {
	day: string[]; // caregiver IDs for day shift
	night: string[]; // caregiver IDs for night shift
};

export type PaymentsByCaregiver = {
	daily: Record<string, Set<string>>; // caregiverId -> Set<YYYY-MM-DD>
	weekly: Record<string, Set<string>>; // caregiverId -> Set<YYYY-WW>
	monthly: Record<string, Set<string>>; // caregiverId -> Set<YYYY-MM>
};

export type PaymentHistory = {
	id: string;
	caregiverId: string;
	caregiverName: string;
	date: string; // ISO string
	frequency: string;
	description: string;
	amount: number;
	paidAt: string; // ISO string
	managerName?: string; // Name of the manager who marked the payment as paid
};

type ScheduleContextValue = {
	caregivers: Caregiver[];
	scheduleByDay: Record<string, DaySchedule>;
	payments: PaymentsByCaregiver;
	paymentHistory: PaymentHistory[];
	isLoading: boolean;
	isFirestoreConnected: boolean;
	addCaregiver: (caregiver: Omit<Caregiver, "id">) => Promise<void>;
	updateCaregiver: (caregiver: Caregiver) => Promise<void>;
	deleteCaregiver: (caregiverId: string) => Promise<void>;
	assignCaregiverToShift: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
	unassignCaregiverFromShift: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
	toggleShiftAssignment: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
	markPaidForCaregiverShift: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
	markPaidForPeriod: (
		caregiverId: string,
		periodKey: string,
		frequency: Frequency,
	) => Promise<void>;
	getScheduledCaregivers: (date: Date, shift?: ShiftType) => Caregiver[];
	isPaidForCaregiverShift: (caregiver: Caregiver, date: Date, shift: ShiftType) => boolean;
	isDayPaidForAllCaregivers: (date: Date) => boolean;
	deletePaymentHistory: (paymentId: string) => Promise<void>;
	clearAllData: () => Promise<void>;
};

const ScheduleContext = createContext<ScheduleContextValue | undefined>(undefined);

export const ScheduleProvider = ({ children }: { children: React.ReactNode }) => {
	const { user } = useAuth();
	const { currentHouse } = useHouse();
	// Local state (fallback when Firestore is not available)
	const [caregivers, setCaregivers] = useState<Caregiver[]>([]);

	const [scheduleByDay, setScheduleByDay] = useState<Record<string, DaySchedule>>({});

	const [payments, setPayments] = useState<PaymentsByCaregiver>({
		daily: {},
		weekly: {},
		monthly: {},
	});

	const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);

	// Firestore connection state
	const [isLoading, setIsLoading] = useState(true);
	const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);

	// Initialize Firestore and set up real-time listeners
	useEffect(() => {
		let unsubscribeFunctions: (() => void)[] = [];

		const initializeFirestore = async () => {
			if (!user?.uid || !currentHouse?.id) {
				console.log("No user or house selected, clearing data and skipping Firestore initialization");
				// Clear all data when user logs out or house changes
				setCaregivers([]);
				setScheduleByDay({});
				setPayments({ daily: {}, weekly: {}, monthly: {} });
				setPaymentHistory([]);
				setIsFirestoreConnected(false);
				setIsLoading(false);
				return;
			}

			try {
				console.log("Initializing Firestore in ScheduleContext for user:", user.uid, "house:", currentHouse.id);

				// Initialize Firestore service with user ID and house ID
				await FirestoreService.initialize(user.uid, currentHouse.id);

				// Initialize default data if needed
				await FirestoreService.initializeDefaultData();

				// Set up real-time listeners
				const unsubscribeCaregivers = FirestoreService.subscribeToCaregivers(
					(caregivers) => {
						console.log("Caregivers updated from Firestore:", caregivers.length, "caregivers");
						setCaregivers(caregivers);
					},
					(error) => {
						console.error("Error in caregivers listener:", error);
						setIsFirestoreConnected(false);
					},
				);

				const unsubscribeSchedule = FirestoreService.subscribeToSchedule(
					(schedule) => {
						console.log("Schedule updated from Firestore:", Object.keys(schedule).length, "days");
						const scheduleWithShifts: Record<string, DaySchedule> = {};
						Object.entries(schedule).forEach(([date, daySchedule]) => {
							scheduleWithShifts[date] = {
								day: daySchedule.day || [],
								night: daySchedule.night || [],
							};
						});
						setScheduleByDay(scheduleWithShifts);
					},
					(error) => {
						console.error("Error in schedule listener:", error);
						setIsFirestoreConnected(false);
					},
				);

				const unsubscribePayments = FirestoreService.subscribeToPayments(
					(payments) => {
						console.log("Payments updated from Firestore");
						setPayments(payments);
					},
					(error) => {
						console.error("Error in payments listener:", error);
						setIsFirestoreConnected(false);
					},
				);

				const unsubscribePaymentHistory = FirestoreService.subscribeToPaymentHistory(
					(history) => {
						console.log("Payment history updated from Firestore:", history.length, "payments");
						setPaymentHistory(history);
					},
					(error) => {
						console.error("Error in payment history listener:", error);
						setIsFirestoreConnected(false);
					},
				);

				unsubscribeFunctions = [
					unsubscribeCaregivers,
					unsubscribeSchedule,
					unsubscribePayments,
					unsubscribePaymentHistory,
				];

				setIsFirestoreConnected(true);
				setIsLoading(false);
				console.log("Firestore initialization completed successfully");
			} catch (error) {
				console.error("Error initializing Firestore:", error);
				setIsFirestoreConnected(false);
				setIsLoading(false);
			}
		};

		initializeFirestore();

		// Cleanup listeners on unmount or user change
		return () => {
			unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
			FirestoreService.cleanup();
		};
	}, [user?.uid, currentHouse?.id]);

	// Handle user logout - clear all data
	useEffect(() => {
		if (!user) {
			console.log("User logged out, clearing all data");
			setCaregivers([]);
			setScheduleByDay({});
			setPayments({ daily: {}, weekly: {}, monthly: {} });
			setPaymentHistory([]);
			setIsFirestoreConnected(false);
		}
	}, [user]);

	const addCaregiver = useCallback(
		async (caregiver: Omit<Caregiver, "id">) => {
			try {
				if (isFirestoreConnected) {
					// Use Firestore
					const caregiverId = await FirestoreService.addCaregiver(caregiver);

					// Track caregiver creation
					AnalyticsService.trackCaregiverAction("created", caregiverId, caregiver.name);
					AnalyticsService.trackEvent("caregiver_added", {
						frequency: caregiver.frequency,
						amount: caregiver.amount,
					});
				} else {
					// Fallback to local state
					const newCaregiver: Caregiver = {
						...caregiver,
						id: Date.now().toString(),
					};
					setCaregivers((prev) => [...prev, newCaregiver]);

					// Track caregiver creation
					AnalyticsService.trackCaregiverAction("created", newCaregiver.id, newCaregiver.name);
					AnalyticsService.trackEvent("caregiver_added", {
						frequency: newCaregiver.frequency,
						amount: newCaregiver.amount,
					});
				}
			} catch (error) {
				console.error("Error adding caregiver:", error);
				// Fallback to local state on error
				const newCaregiver: Caregiver = {
					...caregiver,
					id: Date.now().toString(),
				};
				setCaregivers((prev) => [...prev, newCaregiver]);
			}
		},
		[isFirestoreConnected],
	);

	const updateCaregiver = useCallback(
		async (caregiver: Caregiver) => {
			try {
				console.log("Updating caregiver:", caregiver.id, "with data:", caregiver);
				if (isFirestoreConnected) {
					// Use Firestore
					const updates = {
						name: caregiver.name,
						frequency: caregiver.frequency,
						amount: caregiver.amount,
						dayAmount: caregiver.dayAmount,
						nightAmount: caregiver.nightAmount,
						disabled: caregiver.disabled,
					};
					console.log("Sending updates to Firestore:", updates);
					await FirestoreService.updateCaregiver(caregiver.id, updates);
					console.log("Caregiver updated in Firestore successfully");
				} else {
					// Fallback to local state
					console.log("Updating caregiver in local state");
					setCaregivers((prev) => prev.map((cg) => (cg.id === caregiver.id ? caregiver : cg)));
				}
			} catch (error) {
				console.error("Error updating caregiver:", error);
				// Fallback to local state on error
				console.log("Falling back to local state update");
				setCaregivers((prev) => prev.map((cg) => (cg.id === caregiver.id ? caregiver : cg)));
			}
		},
		[isFirestoreConnected],
	);

	const deleteCaregiver = useCallback(
		async (caregiverId: string) => {
			try {
				if (isFirestoreConnected) {
					// Use Firestore - disable the caregiver instead of deleting
					await FirestoreService.updateCaregiver(caregiverId, { disabled: true });
				} else {
					// Fallback to local state - mark as disabled
					setCaregivers((prev) =>
						prev.map((cg) => (cg.id === caregiverId ? { ...cg, disabled: true } : cg)),
					);
				}
			} catch (error) {
				console.error("Error disabling caregiver:", error);
				// Fallback to local state on error
				setCaregivers((prev) =>
					prev.map((cg) => (cg.id === caregiverId ? { ...cg, disabled: true } : cg)),
				);
			}
		},
		[isFirestoreConnected],
	);

	const assignCaregiverToShift = useCallback(
		async (caregiverId: string, date: Date, shift: ShiftType) => {
			// Check if caregiver is disabled
			const caregiver = caregivers.find((cg) => cg.id === caregiverId);
			if (caregiver?.disabled) {
				console.warn("Cannot assign disabled caregiver to shift");
				return;
			}

			const key = dateKey(date);

			try {
				if (isFirestoreConnected) {
					// Use Firestore
					const currentSchedule = scheduleByDay[key] || { day: [], night: [] };
					const updatedSchedule = { ...currentSchedule };
					if (!updatedSchedule[shift].includes(caregiverId)) {
						updatedSchedule[shift] = [...updatedSchedule[shift], caregiverId];
					}

					await FirestoreService.updateDaySchedule(key, updatedSchedule);
				} else {
					// Fallback to local state
					setScheduleByDay((prev) => {
						const next = { ...prev };
						const currentDay = next[key] || { day: [], night: [] };
						const updatedDay = { ...currentDay };
						if (!updatedDay[shift].includes(caregiverId)) {
							updatedDay[shift] = [...updatedDay[shift], caregiverId];
						}
						next[key] = updatedDay;
						return next;
					});
				}
			} catch (error) {
				console.error("Error assigning caregiver to shift:", error);
				// Fallback to local state on error
				setScheduleByDay((prev) => {
					const next = { ...prev };
					const currentDay = next[key] || { day: [], night: [] };
					const updatedDay = { ...currentDay };
					if (!updatedDay[shift].includes(caregiverId)) {
						updatedDay[shift] = [...updatedDay[shift], caregiverId];
					}
					next[key] = updatedDay;
					return next;
				});
			}
		},
		[isFirestoreConnected, scheduleByDay, caregivers],
	);

	const unassignCaregiverFromShift = useCallback(
		async (caregiverId: string, date: Date, shift: ShiftType) => {
			const key = dateKey(date);

			try {
				if (isFirestoreConnected) {
					// Use Firestore
					const currentSchedule = scheduleByDay[key] || { day: [], night: [] };
					const updatedSchedule = { ...currentSchedule };
					updatedSchedule[shift] = updatedSchedule[shift].filter((id) => id !== caregiverId);

					await FirestoreService.updateDaySchedule(key, updatedSchedule);
				} else {
					// Fallback to local state
					setScheduleByDay((prev) => {
						const next = { ...prev };
						const currentDay = next[key] || { day: [], night: [] };
						const updatedDay = { ...currentDay };
						updatedDay[shift] = updatedDay[shift].filter((id) => id !== caregiverId);
						next[key] = updatedDay;
						return next;
					});
				}
			} catch (error) {
				console.error("Error unassigning caregiver from shift:", error);
				// Fallback to local state on error
				setScheduleByDay((prev) => {
					const next = { ...prev };
					const currentDay = next[key] || { day: [], night: [] };
					const updatedDay = { ...currentDay };
					updatedDay[shift] = updatedDay[shift].filter((id) => id !== caregiverId);
					next[key] = updatedDay;
					return next;
				});
			}
		},
		[isFirestoreConnected, scheduleByDay],
	);

	const toggleShiftAssignment = useCallback(
		async (caregiverId: string, date: Date, shift: ShiftType) => {
			const key = dateKey(date);
			const caregiver = caregivers.find((c) => c.id === caregiverId);

			// Check if caregiver is disabled
			if (caregiver?.disabled) {
				console.warn("Cannot assign disabled caregiver to shift");
				return;
			}

			try {
				if (isFirestoreConnected) {
					// Use Firestore
					const currentSchedule = scheduleByDay[key] || { day: [], night: [] };
					const updatedSchedule = { ...currentSchedule };
					const wasAssigned = updatedSchedule[shift].includes(caregiverId);

					if (wasAssigned) {
						updatedSchedule[shift] = updatedSchedule[shift].filter((id) => id !== caregiverId);
					} else {
						updatedSchedule[shift] = [...updatedSchedule[shift], caregiverId];
					}

					await FirestoreService.updateDaySchedule(key, updatedSchedule);

					// Track assignment changes
					if (caregiver) {
						AnalyticsService.trackCaregiverAction(
							wasAssigned ? "unassigned" : "assigned",
							caregiverId,
							caregiver.name,
						);
						AnalyticsService.trackCalendarInteraction(
							wasAssigned ? "caregiver_removed" : "caregiver_added",
							date.toISOString(),
						);
					}
				} else {
					// Fallback to local state
					setScheduleByDay((prev) => {
						const next = { ...prev };
						const currentDay = next[key] || { day: [], night: [] };
						const updatedDay = { ...currentDay };
						const wasAssigned = updatedDay[shift].includes(caregiverId);

						if (wasAssigned) {
							updatedDay[shift] = updatedDay[shift].filter((id) => id !== caregiverId);
						} else {
							updatedDay[shift] = [...updatedDay[shift], caregiverId];
						}

						next[key] = updatedDay;

						// Track assignment changes
						if (caregiver) {
							AnalyticsService.trackCaregiverAction(
								wasAssigned ? "unassigned" : "assigned",
								caregiverId,
								caregiver.name,
							);
							AnalyticsService.trackCalendarInteraction(
								wasAssigned ? "caregiver_removed" : "caregiver_added",
								date.toISOString(),
							);
						}

						return next;
					});
				}
			} catch (error) {
				console.error("Error toggling shift assignment:", error);
				// Fallback to local state on error
				setScheduleByDay((prev) => {
					const next = { ...prev };
					const currentDay = next[key] || { day: [], night: [] };
					const updatedDay = { ...currentDay };
					const wasAssigned = updatedDay[shift].includes(caregiverId);

					if (wasAssigned) {
						updatedDay[shift] = updatedDay[shift].filter((id) => id !== caregiverId);
					} else {
						updatedDay[shift] = [...updatedDay[shift], caregiverId];
					}

					next[key] = updatedDay;
					return next;
				});
			}
		},
		[caregivers, isFirestoreConnected, scheduleByDay],
	);

	const getScheduledCaregivers = useCallback(
		(date: Date, shift?: ShiftType): Caregiver[] => {
			const key = dateKey(date);
			const daySchedule = scheduleByDay[key];
			if (!daySchedule) return [];

			if (shift) {
				const caregiverIds = daySchedule[shift];
				return caregivers.filter((cg) => caregiverIds.includes(cg.id));
			} else {
				// Return all caregivers scheduled for any shift on this day
				const allCaregiverIds = [...daySchedule.day, ...daySchedule.night];
				const uniqueIds = [...new Set(allCaregiverIds)];
				return caregivers.filter((cg) => uniqueIds.includes(cg.id));
			}
		},
		[caregivers, scheduleByDay],
	);

	const isPaidForCaregiverShift = useCallback(
		(cg: Caregiver, date: Date, shift: ShiftType) => {
			let paymentKey = "";

			if (cg.frequency === "Semanal") {
				paymentKey = `${shift}-${dateKey(date)}-${saturdayWeek(date)}`;
			} else if (cg.frequency === "Quinzenal") {
				// First 15 days of month vs rest of month
				const dayOfMonth = date.getDate();
				const year = date.getFullYear();
				const month = date.getMonth();

				if (dayOfMonth <= 15) {
					paymentKey = `${shift}-${dateKey(date)}-quinzenal-${year}-${month + 1}-1`;
				} else {
					paymentKey = `${shift}-${dateKey(date)}-quinzenal-${year}-${month + 1}-2`;
				}
			} else {
				paymentKey = `${shift}-${dateKey(date)}-${monthKey(date.getFullYear(), date.getMonth())}`;
			}

			// All frequencies now use daily payments
			const set = payments.daily[cg.id] ?? new Set<string>();
			return set.has(paymentKey);
		},
		[payments],
	);

	const markPaidForCaregiverShift = useCallback(
		async (caregiverId: string, date: Date, shift: ShiftType) => {
			const cg = caregivers.find((c) => c.id === caregiverId);
			if (!cg) return;

			try {
				const now = new Date().toISOString();
				let description = "";
				let paymentKey = "";
				const amount = shift === "day" ? cg.dayAmount || cg.amount : cg.nightAmount || cg.amount;

				if (cg.frequency === "Semanal") {
					paymentKey = `${shift}-${dateKey(date)}-${saturdayWeek(date)}`;
					description = `${shift === "day" ? "Dia" : "Noite"} - ${date.toLocaleDateString("pt-BR")} (Semana ${saturdayWeek(date)})`;
				} else if (cg.frequency === "Quinzenal") {
					// First 15 days of month vs rest of month
					const dayOfMonth = date.getDate();
					const year = date.getFullYear();
					const month = date.getMonth();

					if (dayOfMonth <= 15) {
						paymentKey = `${shift}-${dateKey(date)}-quinzenal-${year}-${month + 1}-1`;
						description = `${shift === "day" ? "Dia" : "Noite"} - ${date.toLocaleDateString("pt-BR")} (1ª Quinzena)`;
					} else {
						paymentKey = `${shift}-${dateKey(date)}-quinzenal-${year}-${month + 1}-2`;
						description = `${shift === "day" ? "Dia" : "Noite"} - ${date.toLocaleDateString("pt-BR")} (2ª Quinzena)`;
					}
				} else {
					paymentKey = `${shift}-${dateKey(date)}-${monthKey(date.getFullYear(), date.getMonth())}`;
					description = `${shift === "day" ? "Dia" : "Noite"} - ${date.toLocaleDateString("pt-BR")} (${date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})`;
				}

				// Check if already paid
				if (isPaidForCaregiverShift(cg, date, shift)) {
					console.log("Payment already exists for", cg.name, "on", paymentKey);
					return;
				}

				const managerName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';

				if (isFirestoreConnected) {
					// Use Firestore - create individual payment document
					await FirestoreService.createPayment(caregiverId, cg.frequency, paymentKey);

					// Add to payment history
					const historyEntry: Omit<PaymentHistory, "id"> = {
						caregiverId,
						caregiverName: cg.name,
						date: date.toISOString(),
						frequency: cg.frequency,
						description,
						amount,
						paidAt: now,
						managerName,
					};

					await FirestoreService.addPaymentHistory(historyEntry);
				} else {
					// Fallback to local state - now all frequencies use daily payments
					setPayments((prev) => {
						const next = { ...prev, daily: { ...prev.daily } };
						const set = new Set(next.daily[caregiverId] ?? []);
						set.add(paymentKey);
						next.daily[caregiverId] = set;
						return next;
					});

					// Add to payment history
					const historyEntry: PaymentHistory = {
						id: `${caregiverId}-${paymentKey}`,
						caregiverId,
						caregiverName: cg.name,
						date: date.toISOString(),
						frequency: cg.frequency,
						description,
						amount,
						paidAt: now,
						managerName,
					};

					setPaymentHistory((prev) => [historyEntry, ...prev]);
				}

				// Track payment completion
				AnalyticsService.trackPaymentAction("completed", amount, cg.frequency, caregiverId);
				AnalyticsService.trackEvent("payment_marked", {
					caregiver_name: cg.name,
					frequency: cg.frequency,
					amount,
					shift,
				});
			} catch (error) {
				console.error("Error marking payment:", error);
				// Could show error message to user here
			}
		},
		[caregivers, isFirestoreConnected, isPaidForCaregiverShift, user],
	);

	const markPaidForPeriod = useCallback(
		async (caregiverId: string, periodKey: string, frequency: Frequency) => {
			const cg = caregivers.find((c) => c.id === caregiverId);
			if (!cg) return;

			try {
				const today = new Date();
				let totalAmount = 0;
				let daysMarked = 0;
				let dayShifts = 0;
				let nightShifts = 0;
				const workedDates = new Set<string>();

				// Find all unpaid days in this period
				for (let i = -30; i < 60; i++) {
					const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
					const dayCaregivers = getScheduledCaregivers(d, "day");
					const nightCaregivers = getScheduledCaregivers(d, "night");

					const isDayScheduled = dayCaregivers.some((x: any) => x.id === cg.id);
					const isNightScheduled = nightCaregivers.some((x: any) => x.id === cg.id);

					if (isDayScheduled || isNightScheduled) {
						// Check if this date belongs to the period
						let datePeriodKey = "";
						if (frequency === "Semanal") {
							// Use the same logic as isPaidForCaregiverShift
							datePeriodKey = saturdayWeek(d);
						} else if (frequency === "Quinzenal") {
							// First 15 days of month vs rest of month
							const dayOfMonth = d.getDate();
							const year = d.getFullYear();
							const month = d.getMonth();

							if (dayOfMonth <= 15) {
								datePeriodKey = `quinzenal-${year}-${month + 1}-1`;
							} else {
								datePeriodKey = `quinzenal-${year}-${month + 1}-2`;
							}
						} else {
							// Mensal
							datePeriodKey = monthKey(d.getFullYear(), d.getMonth());
						}

						if (datePeriodKey === periodKey) {
							// Mark unpaid shifts as paid and collect data for single history entry
							if (isDayScheduled && !isPaidForCaregiverShift(cg, d, "day")) {
								// Generate the same payment key that isPaidForCaregiverShift would use
								let paymentKey = "";
								if (frequency === "Semanal") {
									paymentKey = `day-${dateKey(d)}-${saturdayWeek(d)}`;
								} else if (frequency === "Quinzenal") {
									const dayOfMonth = d.getDate();
									const year = d.getFullYear();
									const month = d.getMonth();
									if (dayOfMonth <= 15) {
										paymentKey = `day-${dateKey(d)}-quinzenal-${year}-${month + 1}-1`;
									} else {
										paymentKey = `day-${dateKey(d)}-quinzenal-${year}-${month + 1}-2`;
									}
								} else {
									paymentKey = `day-${dateKey(d)}-${monthKey(d.getFullYear(), d.getMonth())}`;
								}

								// Mark as paid without creating history entry
								if (isFirestoreConnected) {
									await FirestoreService.createPayment(caregiverId, cg.frequency, paymentKey);
								} else {
									setPayments((prev) => {
										const next = { ...prev, daily: { ...prev.daily } };
										const set = new Set(next.daily[caregiverId] ?? []);
										set.add(paymentKey);
										next.daily[caregiverId] = set;
										return next;
									});
								}
								totalAmount += cg.dayAmount || cg.amount;
								dayShifts++;
								workedDates.add(dateKey(d));
							}
							if (isNightScheduled && !isPaidForCaregiverShift(cg, d, "night")) {
								// Generate the same payment key that isPaidForCaregiverShift would use
								let paymentKey = "";
								if (frequency === "Semanal") {
									paymentKey = `night-${dateKey(d)}-${saturdayWeek(d)}`;
								} else if (frequency === "Quinzenal") {
									const dayOfMonth = d.getDate();
									const year = d.getFullYear();
									const month = d.getMonth();
									if (dayOfMonth <= 15) {
										paymentKey = `night-${dateKey(d)}-quinzenal-${year}-${month + 1}-1`;
									} else {
										paymentKey = `night-${dateKey(d)}-quinzenal-${year}-${month + 1}-2`;
									}
								} else {
									paymentKey = `night-${dateKey(d)}-${monthKey(d.getFullYear(), d.getMonth())}`;
								}

								// Mark as paid without creating history entry
								if (isFirestoreConnected) {
									await FirestoreService.createPayment(caregiverId, cg.frequency, paymentKey);
								} else {
									setPayments((prev) => {
										const next = { ...prev, daily: { ...prev.daily } };
										const set = new Set(next.daily[caregiverId] ?? []);
										set.add(paymentKey);
										next.daily[caregiverId] = set;
										return next;
									});
								}
								totalAmount += cg.nightAmount || cg.amount;
								nightShifts++;
								workedDates.add(dateKey(d));
							}
						}
					}
				}

				daysMarked = workedDates.size;

				// Create single payment history entry for the entire period
				if (totalAmount > 0) {
					const now = new Date().toISOString();
					let description = "";

					if (frequency === "Semanal") {
						// Extract period start date from periodKey (format: YYYY-MM-DD)
						const [year, month, day] = periodKey.split("-");
						const periodStart = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
						const periodEnd = new Date(periodStart);
						periodEnd.setDate(periodStart.getDate() + 6); // Friday
						description = `Semana de ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`;
					} else if (frequency === "Quinzenal") {
						const [, year, month, half] = periodKey.split("-");
						const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString(
							"pt-BR",
							{ month: "long" },
						);
						description = `${half === "1" ? "1ª" : "2ª"} Quinzena de ${monthName} de ${year}`;
					} else {
						// Mensal
						const [year, month] = periodKey.split("-");
						const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString(
							"pt-BR",
							{ month: "long" },
						);
						description = `${monthName} de ${year}`;
					}

					// Add shift details to description
					const shiftDetails = [];
					if (dayShifts > 0) shiftDetails.push(`${dayShifts} ${dayShifts === 1 ? "Dia" : "Dias"}`);
					if (nightShifts > 0)
						shiftDetails.push(`${nightShifts} ${nightShifts === 1 ? "Noite" : "Noites"}`);
					if (shiftDetails.length > 0) {
						description += ` (${shiftDetails.join(", ")})`;
					}

					const managerName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';

					const historyEntry: Omit<PaymentHistory, "id"> = {
						caregiverId,
						caregiverName: cg.name,
						date: now,
						frequency: cg.frequency,
						description,
						amount: totalAmount,
						paidAt: now,
						managerName,
					};

					if (isFirestoreConnected) {
						await FirestoreService.addPaymentHistory(historyEntry);
					} else {
						// Fallback to local state
						const newId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
						setPaymentHistory((prev) => [{ ...historyEntry, id: newId }, ...prev]);
					}
				}

				console.log(
					`Marked ${daysMarked} days (${dayShifts} day shifts, ${nightShifts} night shifts) as paid for ${cg.name} in period ${periodKey}, total: R$ ${totalAmount.toFixed(2)}`,
				);
			} catch (error) {
				console.error("Error marking period payment:", error);
			}
		},
		[
			caregivers,
			getScheduledCaregivers,
			isPaidForCaregiverShift,
			isFirestoreConnected,
			setPayments,
			setPaymentHistory,
			user,
		],
	);

	const isDayPaidForAllCaregivers = useCallback(
		(date: Date) => {
			const daySchedule = scheduleByDay[dateKey(date)];
			if (!daySchedule) return false;

			// Check if all day shift caregivers are paid
			const dayCaregivers = getScheduledCaregivers(date, "day");
			const dayPaid = dayCaregivers.every((cg) => isPaidForCaregiverShift(cg, date, "day"));

			// Check if all night shift caregivers are paid
			const nightCaregivers = getScheduledCaregivers(date, "night");
			const nightPaid = nightCaregivers.every((cg) => isPaidForCaregiverShift(cg, date, "night"));

			return dayPaid && nightPaid;
		},
		[scheduleByDay, getScheduledCaregivers, isPaidForCaregiverShift],
	);

	const deletePaymentHistory = useCallback(
		async (paymentId: string) => {
			try {
				// Find the payment history entry to get caregiver info
				const paymentEntry = paymentHistory.find((p) => p.id === paymentId);
				if (!paymentEntry) {
					console.error("Payment history entry not found:", paymentId);
					return;
				}

				// Find the caregiver to get frequency info
				const caregiver = caregivers.find((c) => c.id === paymentEntry.caregiverId);
				if (!caregiver) {
					console.error("Caregiver not found for payment:", paymentEntry.caregiverId);
					return;
				}

				// Extract period information from the description to reconstruct payment keys
				const description = paymentEntry.description;
				let periodStart: Date;
				let periodEnd: Date;

				if (caregiver.frequency === "Semanal") {
					// Extract week range from description like "Semana de 14/01/2024 a 20/01/2024"
					const weekMatch = description.match(
						/Semana de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/,
					);
					if (weekMatch) {
						const [, startStr, endStr] = weekMatch;
						periodStart = new Date(startStr.split("/").reverse().join("-"));
						periodEnd = new Date(endStr.split("/").reverse().join("-"));
					} else {
						console.error("Could not parse week dates from description:", description);
						return;
					}
				} else if (caregiver.frequency === "Quinzenal") {
					// Extract quinzena from description like "1ª Quinzena de setembro de 2025"
					const quinzenaMatch = description.match(/(\d+)ª Quinzena de (\w+) de (\d{4})/);
					if (quinzenaMatch) {
						const [, quinzena, monthName, year] = quinzenaMatch;
						const monthIndex = getPortugueseMonthIndex(monthName);
						if (monthIndex === -1) {
							console.error("Invalid Portuguese month name:", monthName);
							return;
						}
						if (quinzena === "1") {
							periodStart = new Date(parseInt(year), monthIndex, 1);
							periodEnd = new Date(parseInt(year), monthIndex, 15);
						} else {
							periodStart = new Date(parseInt(year), monthIndex, 16);
							periodEnd = new Date(parseInt(year), monthIndex + 1, 0);
						}
					} else {
						console.error("Could not parse quinzena from description:", description);
						return;
					}
				} else {
					// Mensal
					// Extract month from description like "setembro de 2025"
					const monthMatch = description.match(/(\w+) de (\d{4})/);
					if (monthMatch) {
						const [, monthName, year] = monthMatch;
						const monthIndex = getPortugueseMonthIndex(monthName);
						if (monthIndex === -1) {
							console.error("Invalid Portuguese month name:", monthName);
							return;
						}
						periodStart = new Date(parseInt(year), monthIndex, 1);
						periodEnd = new Date(parseInt(year), monthIndex + 1, 0);
					} else {
						console.error("Could not parse month from description:", description);
						return;
					}
				}

				// Collect all payment keys that need to be removed
				const paymentKeysToRemove: string[] = [];

				// Find all days in the period where the caregiver worked
				for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
					const dateKeyStr = dateKey(d);
					const daySchedule = scheduleByDay[dateKeyStr];

					if (daySchedule) {
						// Check day shift
						if (daySchedule.day.includes(caregiver.id)) {
							let paymentKey = "";
							if (caregiver.frequency === "Semanal") {
								paymentKey = `day-${dateKeyStr}-${saturdayWeek(d)}`;
							} else if (caregiver.frequency === "Quinzenal") {
								const dayOfMonth = d.getDate();
								const year = d.getFullYear();
								const month = d.getMonth();
								if (dayOfMonth <= 15) {
									paymentKey = `day-${dateKeyStr}-quinzenal-${year}-${month + 1}-1`;
								} else {
									paymentKey = `day-${dateKeyStr}-quinzenal-${year}-${month + 1}-2`;
								}
							} else {
								paymentKey = `day-${dateKeyStr}-${monthKey(d.getFullYear(), d.getMonth())}`;
							}
							paymentKeysToRemove.push(paymentKey);
						}

						// Check night shift
						if (daySchedule.night.includes(caregiver.id)) {
							let paymentKey = "";
							if (caregiver.frequency === "Semanal") {
								paymentKey = `night-${dateKeyStr}-${saturdayWeek(d)}`;
							} else if (caregiver.frequency === "Quinzenal") {
								const dayOfMonth = d.getDate();
								const year = d.getFullYear();
								const month = d.getMonth();
								if (dayOfMonth <= 15) {
									paymentKey = `night-${dateKeyStr}-quinzenal-${year}-${month + 1}-1`;
								} else {
									paymentKey = `night-${dateKeyStr}-quinzenal-${year}-${month + 1}-2`;
								}
							} else {
								paymentKey = `night-${dateKeyStr}-${monthKey(d.getFullYear(), d.getMonth())}`;
							}
							paymentKeysToRemove.push(paymentKey);
						}
					}
				}

				if (isFirestoreConnected) {
					const db = getFirestore();

					// Delete from payment history collection using the correct collection path
					const paymentHistoryDoc = doc(
						db,
						FirestoreService.getCollections().PAYMENT_HISTORY,
						paymentId,
					);
					await deleteDoc(paymentHistoryDoc);

					// Delete the corresponding payment records from the payments collection
					if (paymentKeysToRemove.length > 0) {
						await FirestoreService.deletePaymentsByKeys(caregiver.id, paymentKeysToRemove);
						console.log(`Deleted ${paymentKeysToRemove.length} payment records from Firestore`);
					}
				} else {
					// Fallback to local state
					setPaymentHistory((prev) => prev.filter((payment) => payment.id !== paymentId));

					// Remove the specific payment keys from local state
					setPayments((prev) => {
						const next = { ...prev, daily: { ...prev.daily } };
						const caregiverPayments = new Set(next.daily[caregiver.id] ?? []);

						// Remove each payment key
						paymentKeysToRemove.forEach((key) => {
							caregiverPayments.delete(key);
						});

						next.daily[caregiver.id] = caregiverPayments;
						return next;
					});
				}

				console.log(`Deleted payment history entry: ${paymentId}`);
				console.log(
					`Removed ${paymentKeysToRemove.length} payment keys for caregiver: ${caregiver.name}`,
				);
			} catch (error) {
				console.error("Error deleting payment history:", error);
				// Fallback to local state on error
				setPaymentHistory((prev) => prev.filter((payment) => payment.id !== paymentId));
			}
		},
		[isFirestoreConnected, paymentHistory, caregivers, scheduleByDay],
	);

	const clearAllData = useCallback(async () => {
		try {
			const collectionType = __DEV__ ? "development" : "production";
			console.log(`Starting to clear all data from ${collectionType} collections...`);

			// Track the action
			AnalyticsService.trackEvent("clear_all_data", {
				caregivers_count: caregivers.length,
				payment_history_count: paymentHistory.length,
				firestore_connected: isFirestoreConnected,
				collection_type: collectionType,
			});

			if (isFirestoreConnected) {
				// Clear data from Firestore (will clear dev or prod collections based on __DEV__)
				await FirestoreService.clearAllData();
			}

			// Clear local state
			setCaregivers([]);
			setScheduleByDay({});
			setPayments({ daily: {}, weekly: {}, monthly: {} });
			setPaymentHistory([]);

			console.log(`All data cleared successfully from ${collectionType} collections`);
		} catch (error) {
			console.error("Error clearing all data:", error);
			throw error;
		}
	}, [isFirestoreConnected, caregivers.length, paymentHistory.length]);

	const value = useMemo<ScheduleContextValue>(
		() => ({
			caregivers,
			scheduleByDay,
			payments,
			paymentHistory,
			isLoading,
			isFirestoreConnected,
			addCaregiver,
			updateCaregiver,
			deleteCaregiver,
			assignCaregiverToShift,
			unassignCaregiverFromShift,
			toggleShiftAssignment,
			markPaidForCaregiverShift,
			markPaidForPeriod,
			getScheduledCaregivers,
			isPaidForCaregiverShift,
			isDayPaidForAllCaregivers,
			deletePaymentHistory,
			clearAllData,
		}),
		[
			caregivers,
			scheduleByDay,
			payments,
			paymentHistory,
			isLoading,
			isFirestoreConnected,
			addCaregiver,
			updateCaregiver,
			deleteCaregiver,
			assignCaregiverToShift,
			unassignCaregiverFromShift,
			toggleShiftAssignment,
			markPaidForCaregiverShift,
			markPaidForPeriod,
			getScheduledCaregivers,
			isPaidForCaregiverShift,
			isDayPaidForAllCaregivers,
			deletePaymentHistory,
			clearAllData,
		],
	);

	return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

export function useSchedule() {
	const ctx = useContext(ScheduleContext);
	if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
	return ctx;
}
