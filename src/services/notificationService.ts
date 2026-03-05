import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Caregiver } from "@/context/ScheduleContext";
import { dateKey, monthKey, saturdayWeek } from "@/utils/date";

// Configure notification behavior
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
		shouldShowBanner: true,
		shouldShowList: true,
	}),
});

export interface OverduePayment {
	id: string;
	caregiverName: string;
	caregiverId: string;
	frequency: "Semanal" | "Quinzenal" | "Mensal";
	dueDate: Date;
	amount: number;
	description: string;
	shift?: "day" | "night";
}

export class NotificationService {
	private static isInitialized = false;

	// Initialize notification permissions
	static async initialize(): Promise<boolean> {
		try {
			if (this.isInitialized) return true;

			// Request permissions
			const { status: existingStatus } = await Notifications.getPermissionsAsync();
			let finalStatus = existingStatus;

			if (existingStatus !== "granted") {
				const { status } = await Notifications.requestPermissionsAsync();
				finalStatus = status;
			}

			if (finalStatus !== "granted") {
				console.log("Notification permissions not granted");
				return false;
			}

			// Configure notification channel for Android
			if (Platform.OS === "android") {
				await Notifications.setNotificationChannelAsync("overdue-payments", {
					name: "Overdue Payments",
					description: "Notifications for overdue caregiver payments",
					importance: Notifications.AndroidImportance.HIGH,
					vibrationPattern: [0, 250, 250, 250],
					lightColor: "#FF6B6B",
				});
			}

			this.isInitialized = true;
			console.log("Notification service initialized successfully");
			return true;
		} catch (error) {
			console.error("Error initializing notification service:", error);
			return false;
		}
	}

	// Check for overdue payments and schedule notifications
	static async checkAndScheduleOverdueNotifications(
		caregivers: Caregiver[],
		scheduleByDay: Record<string, { day: string[]; night: string[] }>,
		payments: {
			daily: Record<string, Set<string>>;
			weekly: Record<string, Set<string>>;
			monthly: Record<string, Set<string>>;
		},
	): Promise<void> {
		try {
			const overduePayments = this.getOverduePayments(caregivers, scheduleByDay, payments);

			if (overduePayments.length === 0) {
				console.log("No overdue payments found");
				return;
			}

			console.log(`Found ${overduePayments.length} overdue payments`);

			// Cancel existing overdue notifications
			await this.cancelOverdueNotifications();

			// Schedule new notifications
			for (const payment of overduePayments) {
				await this.scheduleOverdueNotification(payment);
			}
		} catch (error) {
			console.error("Error checking overdue payments:", error);
		}
	}

	// Get all overdue payments - only check on last day of frequency period
	private static getOverduePayments(
		caregivers: Caregiver[],
		scheduleByDay: Record<string, { day: string[]; night: string[] }>,
		payments: {
			daily: Record<string, Set<string>>;
			weekly: Record<string, Set<string>>;
			monthly: Record<string, Set<string>>;
		},
	): OverduePayment[] {
		const overduePayments: OverduePayment[] = [];
		const today = new Date();

		caregivers.forEach((caregiver) => {
			// Only check for overdue payments on the last day of each frequency period
			if (!this.isLastDayOfPeriod(today, caregiver.frequency)) {
				return;
			}

			// Check for unpaid work in the current period
			const periodUnpaidWork = this.getUnpaidWorkInPeriod(
				caregiver,
				today,
				scheduleByDay,
				payments,
			);

			if (periodUnpaidWork.length > 0) {
				// Create a single notification for the entire period
				const totalAmount = periodUnpaidWork.reduce((sum, work) => sum + work.amount, 0);
				const description = this.getPeriodDescription(today, caregiver.frequency);

				overduePayments.push({
					id: `${caregiver.id}-period-${this.getPeriodKey(today, caregiver.frequency)}`,
					caregiverName: caregiver.name,
					caregiverId: caregiver.id,
					frequency: caregiver.frequency,
					dueDate: today,
					amount: totalAmount,
					description: `${description} (${periodUnpaidWork.length} turnos)`,
				});
			}
		});

		return overduePayments;
	}

	// Check if today is the last day of the frequency period
	private static isLastDayOfPeriod(
		date: Date,
		frequency: "Semanal" | "Quinzenal" | "Mensal",
	): boolean {
		if (frequency === "Semanal") {
			// Last day of week is Friday (day 5) - Saturday to Friday week
			return date.getDay() === 5;
		} else if (frequency === "Quinzenal") {
			// Last day of quinzena is 15th or last day of month
			const dayOfMonth = date.getDate();
			const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
			return dayOfMonth === 15 || dayOfMonth === lastDayOfMonth;
		} else {
			// Mensal
			// Last day of month
			const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
			return date.getDate() === lastDayOfMonth;
		}
	}

	// Get unpaid work in the current period
	private static getUnpaidWorkInPeriod(
		caregiver: Caregiver,
		date: Date,
		scheduleByDay: Record<string, { day: string[]; night: string[] }>,
		payments: {
			daily: Record<string, Set<string>>;
			weekly: Record<string, Set<string>>;
			monthly: Record<string, Set<string>>;
		},
	): { amount: number; shift: "day" | "night"; date: Date }[] {
		const unpaidWork: { amount: number; shift: "day" | "night"; date: Date }[] = [];
		const periodStart = this.getPeriodStart(date, caregiver.frequency);
		const periodEnd = this.getPeriodEnd(date, caregiver.frequency);

		// Check each day in the period
		for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
			const dayKey = dateKey(d);
			const daySchedule = scheduleByDay[dayKey];

			if (daySchedule) {
				// Check day shift
				if (daySchedule.day.includes(caregiver.id)) {
					const paymentKey = this.getPaymentKey(caregiver, d, "day");
					const isPaid = payments.daily[caregiver.id]?.has(paymentKey) || false;

					if (!isPaid) {
						unpaidWork.push({
							amount: caregiver.dayAmount || caregiver.amount,
							shift: "day",
							date: new Date(d),
						});
					}
				}

				// Check night shift
				if (daySchedule.night.includes(caregiver.id)) {
					const paymentKey = this.getPaymentKey(caregiver, d, "night");
					const isPaid = payments.daily[caregiver.id]?.has(paymentKey) || false;

					if (!isPaid) {
						unpaidWork.push({
							amount: caregiver.nightAmount || caregiver.amount,
							shift: "night",
							date: new Date(d),
						});
					}
				}
			}
		}

		return unpaidWork;
	}

	// Get the start date of the current period
	private static getPeriodStart(date: Date, frequency: "Semanal" | "Quinzenal" | "Mensal"): Date {
		if (frequency === "Semanal") {
			// Start of week is Saturday
			const start = new Date(date);
			const dayOfWeek = start.getDay();
			// Calculate days to subtract to get to Saturday
			const daysToSubtract = dayOfWeek === 6 ? 0 : (dayOfWeek === 0 ? 1 : dayOfWeek + 1);
			start.setDate(start.getDate() - daysToSubtract);
			return start;
		} else if (frequency === "Quinzenal") {
			// Start of quinzena is 1st or 16th of month
			const dayOfMonth = date.getDate();
			const start = new Date(date.getFullYear(), date.getMonth(), dayOfMonth <= 15 ? 1 : 16);
			return start;
		} else {
			// Mensal
			// Start of month is 1st
			return new Date(date.getFullYear(), date.getMonth(), 1);
		}
	}

	// Get the end date of the current period
	private static getPeriodEnd(date: Date, frequency: "Semanal" | "Quinzenal" | "Mensal"): Date {
		if (frequency === "Semanal") {
			// End of week is Friday
			const end = new Date(date);
			const dayOfWeek = end.getDay();
			// Calculate days to add to get to Friday
			const daysToAdd = dayOfWeek === 0 ? 5 : (dayOfWeek === 6 ? 6 : 5 - dayOfWeek);
			end.setDate(end.getDate() + daysToAdd);
			return end;
		} else if (frequency === "Quinzenal") {
			// End of quinzena is 15th or last day of month
			const dayOfMonth = date.getDate();
			const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
			const endDay = dayOfMonth <= 15 ? 15 : lastDayOfMonth;
			return new Date(date.getFullYear(), date.getMonth(), endDay);
		} else {
			// Mensal
			// End of month is last day
			return new Date(date.getFullYear(), date.getMonth() + 1, 0);
		}
	}

	// Get payment key for a specific date and shift
	private static getPaymentKey(caregiver: Caregiver, date: Date, shift: "day" | "night"): string {
		if (caregiver.frequency === "Semanal") {
			return `${shift}-${dateKey(date)}-${saturdayWeek(date)}`;
		} else if (caregiver.frequency === "Quinzenal") {
			const dayOfMonth = date.getDate();
			const year = date.getFullYear();
			const month = date.getMonth();
			const quinzena = dayOfMonth <= 15 ? "1" : "2";
			return `${shift}-${dateKey(date)}-quinzenal-${year}-${month + 1}-${quinzena}`;
		} else {
			return `${shift}-${dateKey(date)}-${monthKey(date.getFullYear(), date.getMonth())}`;
		}
	}

	// Get period key for identification
	private static getPeriodKey(date: Date, frequency: "Semanal" | "Quinzenal" | "Mensal"): string {
		if (frequency === "Semanal") {
			return saturdayWeek(date);
		} else if (frequency === "Quinzenal") {
			const dayOfMonth = date.getDate();
			const year = date.getFullYear();
			const month = date.getMonth();
			const quinzena = dayOfMonth <= 15 ? "1" : "2";
			return `quinzenal-${year}-${month + 1}-${quinzena}`;
		} else {
			return monthKey(date.getFullYear(), date.getMonth());
		}
	}

	// Get description for the period
	private static getPeriodDescription(
		date: Date,
		frequency: "Semanal" | "Quinzenal" | "Mensal",
	): string {
		if (frequency === "Semanal") {
			const start = this.getPeriodStart(date, frequency);
			const end = this.getPeriodEnd(date, frequency);
			return `Semana de ${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
		} else if (frequency === "Quinzenal") {
			const dayOfMonth = date.getDate();
			const monthName = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
			return dayOfMonth <= 15 ? `1ª Quinzena de ${monthName}` : `2ª Quinzena de ${monthName}`;
		} else {
			return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
		}
	}

	// Schedule a notification for an overdue payment
	public static async scheduleOverdueNotification(payment: OverduePayment): Promise<void> {
		try {
			const title = "Pagamento em Atraso";
			const body = `${payment.caregiverName} - ${payment.description} (R$ ${payment.amount.toFixed(2).replace(".", ",")})`;

			await Notifications.scheduleNotificationAsync({
				content: {
					title,
					body,
					data: {
						paymentId: payment.id,
						caregiverId: payment.caregiverId,
						type: "overdue_payment",
						frequency: payment.frequency,
					},
					sound: true,
				},
				trigger: null, // Show immediately
				identifier: `overdue-${payment.id}`,
			});

			console.log(
				`Scheduled overdue notification for ${payment.caregiverName} - ${payment.description}`,
			);
		} catch (error) {
			console.error("Error scheduling overdue notification:", error);
		}
	}

	// Cancel all overdue payment notifications
	private static async cancelOverdueNotifications(): Promise<void> {
		try {
			const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
			const overdueNotificationIds = scheduledNotifications
				.filter((notification) => notification.identifier.startsWith("overdue-"))
				.map((notification) => notification.identifier);

			if (overdueNotificationIds.length > 0) {
				for (const id of overdueNotificationIds) {
					await Notifications.cancelScheduledNotificationAsync(id);
				}
				console.log(`Cancelled ${overdueNotificationIds.length} overdue notifications`);
			}
		} catch (error) {
			console.error("Error cancelling overdue notifications:", error);
		}
	}

	// Get all scheduled notifications (for debugging)
	static async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
		try {
			return await Notifications.getAllScheduledNotificationsAsync();
		} catch (error) {
			console.error("Error getting scheduled notifications:", error);
			return [];
		}
	}

	// Clear all notifications
	static async clearAllNotifications(): Promise<void> {
		try {
			await Notifications.cancelAllScheduledNotificationsAsync();
			await Notifications.dismissAllNotificationsAsync();
			console.log("All notifications cleared");
		} catch (error) {
			console.error("Error clearing notifications:", error);
		}
	}
}
