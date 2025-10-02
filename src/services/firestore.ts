import {
	getFirestore,
	collection,
	doc,
	getDocs,
	getDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	query,
	orderBy,
	where,
	limit,
	onSnapshot,
	FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { Caregiver, PaymentHistory, PaymentsByCaregiver } from "@/context/ScheduleContext";
import { CrashlyticsService } from "./firebase";

// Firestore collection names
const COLLECTIONS = {
	CAREGIVERS: __DEV__ ? "caregivers_dev" : "caregivers",
	SCHEDULE: __DEV__ ? "schedule_dev" : "schedule",
	PAYMENTS: __DEV__ ? "payments_dev" : "payments",
	PAYMENT_HISTORY: __DEV__ ? "paymentHistory_dev" : "paymentHistory",
} as const;

// Firestore document structure types
export interface FirestoreCaregiver {
	id: string;
	name: string;
	frequency: "Semanal" | "Quinzenal" | "Mensal";
	amount: number;
	dayAmount?: number;
	nightAmount?: number;
	disabled?: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface FirestoreSchedule {
	[dateKey: string]: {
		day: string[]; // Array of caregiver IDs for day shift
		night: string[]; // Array of caregiver IDs for night shift
	};
}

export interface FirestorePayment {
	caregiverId: string;
	frequency: "Semanal" | "Quinzenal" | "Mensal";
	paymentKey: string;
	createdAt: string;
	updatedAt: string;
}

export interface FirestorePaymentHistory {
	id: string;
	caregiverId: string;
	caregiverName: string;
	date: string;
	frequency: "Semanal" | "Quinzenal" | "Mensal";
	description: string;
	amount: number;
	paidAt: string;
	createdAt: string;
}

export class FirestoreService {
	private static unsubscribeFunctions: (() => void)[] = [];

	// Initialize Firestore and set up real-time listeners
	static async initialize(): Promise<void> {
		try {
			console.log("Initializing Firestore service...");

			// Log which collections are being used
			if (__DEV__) {
				console.log("🔧 Development mode: Using dev collections:", {
					caregivers: COLLECTIONS.CAREGIVERS,
					schedule: COLLECTIONS.SCHEDULE,
					payments: COLLECTIONS.PAYMENTS,
					paymentHistory: COLLECTIONS.PAYMENT_HISTORY,
				});
			} else {
				console.log("🚀 Production mode: Using production collections");
			}

			// Test connection
			await this.testConnection();

			console.log("Firestore service initialized successfully");
		} catch (error) {
			console.error("Error initializing Firestore:", error);
			CrashlyticsService.logError(error as Error, "Firestore initialization");
			throw error;
		}
	}

	// Test Firestore connection
	static async testConnection(): Promise<void> {
		try {
			const db = getFirestore();
			const testDoc = doc(db, "_test", "connection");
			await getDoc(testDoc);
			console.log("Firestore connection test successful");
		} catch (error) {
			console.error("Firestore connection test failed:", error);
			throw error;
		}
	}

	// Clean up all listeners
	static cleanup(): void {
		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];
	}

	// ===== CAREGIVERS =====

	// Subscribe to caregivers collection with real-time updates
	static subscribeToCaregivers(
		onUpdate: (caregivers: Caregiver[]) => void,
		onError?: (error: Error) => void,
	): () => void {
		const db = getFirestore();
		const caregiversRef = collection(db, COLLECTIONS.CAREGIVERS);
		const q = query(caregiversRef, orderBy("createdAt", "desc"));

		const unsubscribe = onSnapshot(
			q,
			(querySnapshot) => {
				try {
					const caregivers: Caregiver[] = [];
					querySnapshot.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
						const data = doc.data() as FirestoreCaregiver;
						caregivers.push({
							id: data.id,
							name: data.name,
							frequency: data.frequency,
							amount: data.amount,
							dayAmount: data.dayAmount,
							nightAmount: data.nightAmount,
							disabled: data.disabled,
						});
					});
					console.log("Caregivers updated from Firestore:", caregivers.length, "caregivers");
					onUpdate(caregivers);
				} catch (error) {
					console.error("Error processing caregivers snapshot:", error);
					onError?.(error as Error);
				}
			},
			(error) => {
				console.error("Error in caregivers listener:", error);
				CrashlyticsService.logError(error, "Caregivers listener error");
				onError?.(error);
			},
		);

		this.unsubscribeFunctions.push(unsubscribe);
		return unsubscribe;
	}

	// Add a new caregiver
	static async addCaregiver(caregiver: Omit<Caregiver, "id">): Promise<string> {
		try {
			const now = new Date().toISOString();
			const db = getFirestore();
			const caregiversRef = collection(db, COLLECTIONS.CAREGIVERS);
			const caregiverDoc = doc(caregiversRef);
			const caregiverId = caregiverDoc.id;

			const firestoreCaregiver: FirestoreCaregiver = {
				id: caregiverId,
				name: caregiver.name,
				frequency: caregiver.frequency,
				amount: caregiver.amount,
				...(caregiver.dayAmount !== undefined && { dayAmount: caregiver.dayAmount }),
				...(caregiver.nightAmount !== undefined && { nightAmount: caregiver.nightAmount }),
				createdAt: now,
				updatedAt: now,
			};

			await setDoc(caregiverDoc, firestoreCaregiver);

			console.log("Caregiver added to Firestore:", caregiverId);
			return caregiverId;
		} catch (error) {
			console.error("Error adding caregiver to Firestore:", error);
			CrashlyticsService.logError(error as Error, "Add caregiver error");
			throw error;
		}
	}

	// Update caregiver
	static async updateCaregiver(
		caregiverId: string,
		updates: Partial<Omit<Caregiver, "id">>,
	): Promise<void> {
		try {
			const updateData: any = {
				updatedAt: new Date().toISOString(),
			};

			// Only include defined fields to avoid Firestore undefined errors
			if (updates.name !== undefined) updateData.name = updates.name;
			if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
			if (updates.amount !== undefined) updateData.amount = updates.amount;
			if (updates.dayAmount !== undefined) updateData.dayAmount = updates.dayAmount;
			if (updates.nightAmount !== undefined) updateData.nightAmount = updates.nightAmount;
			if (updates.disabled !== undefined) updateData.disabled = updates.disabled;

			const db = getFirestore();
			const caregiverDoc = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
			await updateDoc(caregiverDoc, updateData);

			console.log("Caregiver updated in Firestore:", caregiverId);
		} catch (error) {
			console.error("Error updating caregiver in Firestore:", error);
			CrashlyticsService.logError(error as Error, "Update caregiver error");
			throw error;
		}
	}

	// Delete caregiver
	static async deleteCaregiver(caregiverId: string): Promise<void> {
		try {
			const db = getFirestore();
			const caregiverDoc = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
			await deleteDoc(caregiverDoc);

			console.log("Caregiver deleted from Firestore:", caregiverId);
		} catch (error) {
			console.error("Error deleting caregiver from Firestore:", error);
			CrashlyticsService.logError(error as Error, "Delete caregiver error");
			throw error;
		}
	}

	// ===== SCHEDULE =====

	// Subscribe to schedule collection with real-time updates
	static subscribeToSchedule(
		onUpdate: (schedule: Record<string, { day: string[]; night: string[] }>) => void,
		onError?: (error: Error) => void,
	): () => void {
		const db = getFirestore();
		const scheduleRef = collection(db, COLLECTIONS.SCHEDULE);

		const unsubscribe = onSnapshot(
			scheduleRef,
			(querySnapshot) => {
				try {
					const schedule: Record<string, { day: string[]; night: string[] }> = {};
					querySnapshot.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
						const data = doc.data();
						schedule[doc.id] = {
							day: data.day || [],
							night: data.night || [],
						};
					});
					console.log("Schedule updated from Firestore:", Object.keys(schedule).length, "days");
					onUpdate(schedule);
				} catch (error) {
					console.error("Error processing schedule snapshot:", error);
					onError?.(error as Error);
				}
			},
			(error) => {
				console.error("Error in schedule listener:", error);
				CrashlyticsService.logError(error, "Schedule listener error");
				onError?.(error);
			},
		);

		this.unsubscribeFunctions.push(unsubscribe);
		return unsubscribe;
	}

	// Update day schedule
	static async updateDaySchedule(
		dateKey: string,
		daySchedule: { day: string[]; night: string[] },
	): Promise<void> {
		try {
			const db = getFirestore();
			const scheduleDoc = doc(db, COLLECTIONS.SCHEDULE, dateKey);
			await setDoc(
				scheduleDoc,
				{
					day: daySchedule.day,
					night: daySchedule.night,
					updatedAt: new Date().toISOString(),
				},
				{ merge: true },
			);

			console.log(
				"Day schedule updated in Firestore:",
				dateKey,
				"day:",
				daySchedule.day.length,
				"night:",
				daySchedule.night.length,
			);
		} catch (error) {
			console.error("Error updating day schedule in Firestore:", error);
			CrashlyticsService.logError(error as Error, "Update day schedule error");
			throw error;
		}
	}

	// ===== PAYMENTS =====

	// Subscribe to payments collection with real-time updates
	static subscribeToPayments(
		onUpdate: (payments: PaymentsByCaregiver) => void,
		onError?: (error: Error) => void,
	): () => void {
		const db = getFirestore();
		const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);

		const unsubscribe = onSnapshot(
			paymentsRef,
			(querySnapshot) => {
				try {
					const payments: PaymentsByCaregiver = {
						daily: {},
						weekly: {},
						monthly: {},
					};

					// Process each payment document
					querySnapshot.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
						const data = doc.data();
						const { caregiverId, paymentKey } = data;

						// All frequencies now use daily payments
						if (!payments.daily[caregiverId]) {
							payments.daily[caregiverId] = new Set();
						}
						payments.daily[caregiverId].add(paymentKey);
					});

					console.log("Payments updated from Firestore:", querySnapshot.size, "payment documents");
					onUpdate(payments);
				} catch (error) {
					console.error("Error processing payments snapshot:", error);
					onError?.(error as Error);
				}
			},
			(error) => {
				console.error("Error in payments listener:", error);
				CrashlyticsService.logError(error, "Payments listener error");
				onError?.(error);
			},
		);

		this.unsubscribeFunctions.push(unsubscribe);
		return unsubscribe;
	}

	// Create a new payment document
	static async createPayment(
		caregiverId: string,
		frequency: "Semanal" | "Quinzenal" | "Mensal",
		paymentKey: string,
	): Promise<string> {
		try {
			const db = getFirestore();
			const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);
			const paymentDoc = doc(paymentsRef);
			const paymentId = paymentDoc.id;

			await setDoc(paymentDoc, {
				caregiverId,
				frequency,
				paymentKey,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			console.log("Payment created in Firestore:", paymentId, caregiverId, frequency, paymentKey);
			return paymentId;
		} catch (error) {
			console.error("Error creating payment in Firestore:", error);
			CrashlyticsService.logError(error as Error, "Create payment error");
			throw error;
		}
	}

	// Check if a payment exists
	static async checkPaymentExists(
		caregiverId: string,
		frequency: "Semanal" | "Quinzenal" | "Mensal",
		paymentKey: string,
	): Promise<boolean> {
		try {
			const db = getFirestore();
			const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);
			const q = query(
				paymentsRef,
				where("caregiverId", "==", caregiverId),
				where("frequency", "==", frequency),
				where("paymentKey", "==", paymentKey),
				limit(1),
			);

			const querySnapshot = await getDocs(q);
			return !querySnapshot.empty;
		} catch (error) {
			console.error("Error checking payment existence:", error);
			CrashlyticsService.logError(error as Error, "Check payment existence error");
			return false;
		}
	}

	// Delete payment documents by payment keys
	static async deletePaymentsByKeys(caregiverId: string, paymentKeys: string[]): Promise<void> {
		try {
			if (paymentKeys.length === 0) {
				console.log("No payment keys to delete");
				return;
			}

			const db = getFirestore();
			const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);

			// Query for all payment documents that match the caregiverId and paymentKeys
			const q = query(
				paymentsRef,
				where("caregiverId", "==", caregiverId),
				where("paymentKey", "in", paymentKeys),
			);

			const querySnapshot = await getDocs(q);
			const deletePromises: Promise<void>[] = [];

			querySnapshot.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
				deletePromises.push(deleteDoc(doc.ref));
			});

			await Promise.all(deletePromises);
			console.log(
				`Deleted ${deletePromises.length} payment documents for caregiver ${caregiverId}`,
			);
		} catch (error) {
			console.error("Error deleting payments from Firestore:", error);
			CrashlyticsService.logError(error as Error, "Delete payments error");
			throw error;
		}
	}

	// ===== PAYMENT HISTORY =====

	// Subscribe to payment history collection with real-time updates
	static subscribeToPaymentHistory(
		onUpdate: (history: PaymentHistory[]) => void,
		onError?: (error: Error) => void,
	): () => void {
		const db = getFirestore();
		const paymentHistoryRef = collection(db, COLLECTIONS.PAYMENT_HISTORY);
		const q = query(paymentHistoryRef, orderBy("paidAt", "desc"));

		const unsubscribe = onSnapshot(
			q,
			(querySnapshot) => {
				try {
					const history: PaymentHistory[] = [];
					querySnapshot.forEach((doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
						const data = doc.data() as FirestorePaymentHistory;
						history.push({
							id: data.id,
							caregiverId: data.caregiverId,
							caregiverName: data.caregiverName,
							date: data.date,
							frequency: data.frequency,
							description: data.description,
							amount: data.amount,
							paidAt: data.paidAt,
						});
					});
					console.log("Payment history updated from Firestore:", history.length, "payments");
					onUpdate(history);
				} catch (error) {
					console.error("Error processing payment history snapshot:", error);
					onError?.(error as Error);
				}
			},
			(error) => {
				console.error("Error in payment history listener:", error);
				CrashlyticsService.logError(error, "Payment history listener error");
				onError?.(error);
			},
		);

		this.unsubscribeFunctions.push(unsubscribe);
		return unsubscribe;
	}

	// Add payment to history
	static async addPaymentHistory(payment: Omit<PaymentHistory, "id">): Promise<string> {
		try {
			const db = getFirestore();
			const paymentHistoryRef = collection(db, COLLECTIONS.PAYMENT_HISTORY);
			const paymentDoc = doc(paymentHistoryRef);
			const paymentId = paymentDoc.id;
			const now = new Date().toISOString();

			const firestorePayment: FirestorePaymentHistory = {
				id: paymentId,
				caregiverId: payment.caregiverId,
				caregiverName: payment.caregiverName,
				date: payment.date,
				frequency: payment.frequency as "Semanal" | "Quinzenal" | "Mensal",
				description: payment.description,
				amount: payment.amount,
				paidAt: payment.paidAt,
				createdAt: now,
			};

			await setDoc(paymentDoc, firestorePayment);

			console.log("Payment history added to Firestore:", paymentId);
			return paymentId;
		} catch (error) {
			console.error("Error adding payment history to Firestore:", error);
			CrashlyticsService.logError(error as Error, "Add payment history error");
			throw error;
		}
	}

	// ===== UTILITY METHODS =====

	// Initialize default data if collections are empty
	static async initializeDefaultData(): Promise<void> {
		try {
			// No default caregivers - start with empty list
			console.log("Caregivers collection initialized (empty)");

			// Payments collection will be populated as individual documents when payments are made
		} catch (error) {
			console.error("Error initializing default data:", error);
			CrashlyticsService.logError(error as Error, "Initialize default data error");
		}
	}

	// Clear all data from Firestore
	static async clearAllData(): Promise<void> {
		try {
			console.log("Starting to clear all data from Firestore...");
			const db = getFirestore();

			// Clear caregivers collection
			const caregiversRef = collection(db, COLLECTIONS.CAREGIVERS);
			const caregiversSnapshot = await getDocs(caregiversRef);
			const caregiverDeletePromises = caregiversSnapshot.docs.map(
				(doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => deleteDoc(doc.ref),
			);
			await Promise.all(caregiverDeletePromises);
			console.log(`Deleted ${caregiversSnapshot.docs.length} caregivers`);

			// Clear schedule collection
			const scheduleRef = collection(db, COLLECTIONS.SCHEDULE);
			const scheduleSnapshot = await getDocs(scheduleRef);
			const scheduleDeletePromises = scheduleSnapshot.docs.map(
				(doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => deleteDoc(doc.ref),
			);
			await Promise.all(scheduleDeletePromises);
			console.log(`Deleted ${scheduleSnapshot.docs.length} schedule documents`);

			// Clear payments collection
			const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);
			const paymentsSnapshot = await getDocs(paymentsRef);
			const paymentsDeletePromises = paymentsSnapshot.docs.map(
				(doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => deleteDoc(doc.ref),
			);
			await Promise.all(paymentsDeletePromises);
			console.log(`Deleted ${paymentsSnapshot.docs.length} payment documents`);

			// Clear payment history collection
			const paymentHistoryRef = collection(db, COLLECTIONS.PAYMENT_HISTORY);
			const paymentHistorySnapshot = await getDocs(paymentHistoryRef);
			const paymentHistoryDeletePromises = paymentHistorySnapshot.docs.map(
				(doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => deleteDoc(doc.ref),
			);
			await Promise.all(paymentHistoryDeletePromises);
			console.log(`Deleted ${paymentHistorySnapshot.docs.length} payment history documents`);

			console.log("All data cleared from Firestore successfully");
		} catch (error) {
			console.error("Error clearing all data from Firestore:", error);
			CrashlyticsService.logError(error as Error, "Clear all data error");
			throw error;
		}
	}

	// Get current timestamp
	static getTimestamp(): string {
		return new Date().toISOString();
	}
}
