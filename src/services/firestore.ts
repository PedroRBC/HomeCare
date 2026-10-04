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
  onSnapshot,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { Caregiver, PaymentHistory, PaymentsByCaregiver } from "@/context/ScheduleContext";
import { House, HouseManager, HouseInvitation, HouseRole } from "@/types/house.types";
import { CrashlyticsService } from "./firebase";
import { t as translate } from "i18next";

// Collections of a house, shared by all its managers
const getCollections = (houseId: string) =>
  ({
    CAREGIVERS: `houses/${houseId}/caregivers`,
    SCHEDULE: `houses/${houseId}/schedule`,
    PAYMENTS: `houses/${houseId}/payments`,
    PAYMENT_HISTORY: `houses/${houseId}/paymentHistory`,
  }) as const;

// Global collections
const getHouseCollections = () =>
  ({
    HOUSES: "houses",
    HOUSE_INVITATIONS: "house_invitations",
    USER_HOUSE_ACCESS: "user_house_access",
    USERS: "users",
  }) as const;

export interface FirestoreCaregiver {
  id: string;
  name: string;
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário";
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
    dayExtra?: string[]; // Array of caregiver IDs for extra day shift
    nightExtra?: string[]; // Array of caregiver IDs for extra night shift
  };
}

export interface FirestorePayment {
  caregiverId: string;
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário";
  paymentKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestorePaymentHistory {
  id: string;
  caregiverId: string;
  caregiverName: string;
  date: string;
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário";
  description: string;
  amount: number;
  paidAt: string;
  createdAt: string;
  managerName?: string; // Name of the manager who marked the payment as paid
  periodKey?: string;
  paymentKeys?: string[];
  historyKey?: string;
}

// House-related Firestore interfaces
export interface FirestoreHouse {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  managers: HouseManager[];
  isActive: boolean;
}

export interface FirestoreHouseInvitation {
  id: string;
  houseId: string;
  houseName: string;
  invitedEmail: string;
  invitedBy: string;
  invitedByName: string;
  role: HouseRole;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface FirestoreUserHouseAccess {
  userId: string;
  houseId: string;
  role: HouseRole;
  addedAt: string;
}

export interface FirestoreUser {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
  providers?: ("password" | "google.com")[];
  hasPassword?: boolean;
}

export class FirestoreService {
  private static unsubscribeFunctions: (() => void)[] = [];
  private static currentHouseId: string | null = null;

  // Initialize Firestore for a house (shared by all managers/owners)
  static async initialize(userId: string, houseId: string): Promise<void> {
    try {
      console.log("Initializing Firestore service for user:", userId, "house:", houseId);
      this.currentHouseId = houseId;
      await this.testConnection();
      console.log("Firestore service initialized successfully for user:", userId);
    } catch (error) {
      console.error("Error initializing Firestore:", error);
      CrashlyticsService.logError(error as Error, "Firestore initialization");
      throw error;
    }
  }

  // Get collections for current house (shared by all managers/owners)
  public static getCollections() {
    if (!this.currentHouseId) {
      throw new Error("FirestoreService not initialized. Call initialize() first.");
    }
    return getCollections(this.currentHouseId);
  }

  // Cleanup and reset for user logout
  static cleanup(): void {
    console.log("Cleaning up FirestoreService for user logout");
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
    this.currentHouseId = null;
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

  // ===== CAREGIVERS =====

  // Subscribe to caregivers collection with real-time updates
  static subscribeToCaregivers(
    onUpdate: (caregivers: Caregiver[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const db = getFirestore();
    const collections = this.getCollections();
    const caregiversRef = collection(db, collections.CAREGIVERS);
    const q = query(caregiversRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          const caregivers: Caregiver[] = [];
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
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
      const caregiversRef = collection(db, this.getCollections().CAREGIVERS);
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
      const caregiverDoc = doc(db, this.getCollections().CAREGIVERS, caregiverId);
      await updateDoc(caregiverDoc, updateData);

      console.log("Caregiver updated in Firestore:", caregiverId);
    } catch (error) {
      console.error("Error updating caregiver in Firestore:", error);
      CrashlyticsService.logError(error as Error, "Update caregiver error");
      throw error;
    }
  }

  // ===== SCHEDULE =====

  // Subscribe to schedule collection with real-time updates
  static subscribeToSchedule(
    onUpdate: (
      schedule: Record<
        string,
        { day: string[]; night: string[]; dayExtra?: string[]; nightExtra?: string[] }
      >,
    ) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const db = getFirestore();
    const scheduleRef = collection(db, this.getCollections().SCHEDULE);

    const unsubscribe = onSnapshot(
      scheduleRef,
      (querySnapshot) => {
        try {
          const schedule: Record<
            string,
            { day: string[]; night: string[]; dayExtra?: string[]; nightExtra?: string[] }
          > = {};
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
            const data = doc.data();
            schedule[doc.id] = {
              day: data.day || [],
              night: data.night || [],
              dayExtra: data.dayExtra || [],
              nightExtra: data.nightExtra || [],
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
    daySchedule: { day: string[]; night: string[]; dayExtra?: string[]; nightExtra?: string[] },
  ): Promise<void> {
    try {
      const db = getFirestore();
      const scheduleDoc = doc(db, this.getCollections().SCHEDULE, dateKey);
      await setDoc(
        scheduleDoc,
        {
          day: daySchedule.day,
          night: daySchedule.night,
          dayExtra: daySchedule.dayExtra || [],
          nightExtra: daySchedule.nightExtra || [],
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
    const paymentsRef = collection(db, this.getCollections().PAYMENTS);

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
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
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

  private static sanitizeDocId(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private static chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Create a new payment document
  static async createPayment(
    caregiverId: string,
    frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário",
    paymentKey: string,
  ): Promise<string> {
    try {
      const db = getFirestore();
      const paymentId = this.sanitizeDocId(`${caregiverId}__${paymentKey}`);
      const paymentDoc = doc(db, this.getCollections().PAYMENTS, paymentId);
      const now = new Date().toISOString();

      await setDoc(
        paymentDoc,
        {
          caregiverId,
          frequency,
          paymentKey,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      console.log("Payment upserted in Firestore:", paymentId, caregiverId, frequency, paymentKey);
      return paymentId;
    } catch (error) {
      console.error("Error creating payment in Firestore:", error);
      CrashlyticsService.logError(error as Error, "Create payment error");
      throw error;
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
      const paymentsRef = collection(db, this.getCollections().PAYMENTS);
      console.log("Payments collection:", paymentsRef);
      console.log("Deleting payments for caregiver:", caregiverId, "with keys:", paymentKeys);

      const keyChunks = this.chunkArray([...new Set(paymentKeys)], 10);
      let totalDeleted = 0;

      for (const keyChunk of keyChunks) {
        const q = query(
          paymentsRef,
          where("caregiverId", "==", caregiverId),
          where("paymentKey", "in", keyChunk),
        );

        const querySnapshot = await getDocs(q);
        const deletePromises: Promise<void>[] = [];

        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          deletePromises.push(deleteDoc(doc.ref));
        });

        await Promise.all(deletePromises);
        totalDeleted += deletePromises.length;
      }

      console.log(`Deleted ${totalDeleted} payment documents for caregiver ${caregiverId}`);
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
    const paymentHistoryRef = collection(db, this.getCollections().PAYMENT_HISTORY);
    const q = query(paymentHistoryRef, orderBy("paidAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          const history: PaymentHistory[] = [];
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
            const data = doc.data() as FirestorePaymentHistory;
            const paymentHistory: PaymentHistory = {
              id: data.id,
              caregiverId: data.caregiverId,
              caregiverName: data.caregiverName,
              date: data.date,
              frequency: data.frequency,
              description: data.description,
              amount: data.amount,
              paidAt: data.paidAt,
            };

            if (data.managerName) {
              paymentHistory.managerName = data.managerName;
            }

            if (data.periodKey) {
              paymentHistory.periodKey = data.periodKey;
            }

            if (data.paymentKeys) {
              paymentHistory.paymentKeys = data.paymentKeys;
            }

            if (data.historyKey) {
              paymentHistory.historyKey = data.historyKey;
            }

            history.push(paymentHistory);
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

  static async deletePaymentHistory(paymentId: string): Promise<void> {
    const db = getFirestore();
    await deleteDoc(doc(db, this.getCollections().PAYMENT_HISTORY, paymentId));
  }

  // Add payment to history
  static async addPaymentHistory(payment: Omit<PaymentHistory, "id">): Promise<string> {
    try {
      const db = getFirestore();
      const now = new Date().toISOString();
      const paymentId = payment.historyKey
        ? this.sanitizeDocId(payment.historyKey)
        : doc(collection(db, this.getCollections().PAYMENT_HISTORY)).id;
      const paymentDoc = doc(db, this.getCollections().PAYMENT_HISTORY, paymentId);

      const firestorePayment: FirestorePaymentHistory = {
        id: paymentId,
        caregiverId: payment.caregiverId,
        caregiverName: payment.caregiverName,
        date: payment.date,
        frequency: payment.frequency as "Semanal" | "Quinzenal" | "Mensal" | "Diário",
        description: payment.description,
        amount: payment.amount,
        paidAt: payment.paidAt,
        createdAt: now,
        managerName: payment.managerName,
        periodKey: payment.periodKey,
        paymentKeys: payment.paymentKeys,
        historyKey: payment.historyKey,
      };

      await setDoc(paymentDoc, firestorePayment, { merge: true });

      console.log("Payment history upserted in Firestore:", paymentId);
      return paymentId;
    } catch (error) {
      console.error("Error adding payment history to Firestore:", error);
      CrashlyticsService.logError(error as Error, "Add payment history error");
      throw error;
    }
  }

  // ===== UTILITY METHODS =====

  // ===== HOUSE MANAGEMENT =====

  // Create a new house
  static async createHouse(houseData: {
    name: string;
    description?: string;
    createdBy: string;
  }): Promise<House> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();
      const housesRef = collection(db, houseCollections.HOUSES);
      const houseDoc = doc(housesRef);
      const houseId = houseDoc.id;
      const now = new Date().toISOString();

      // Get user profile to populate email and display name
      const userProfile = await this.getUserProfile(houseData.createdBy);
      const userEmail = userProfile?.email || "";
      const userDisplayName = userProfile?.displayName || "";

      const firestoreHouse: FirestoreHouse = {
        id: houseId,
        name: houseData.name,
        description: houseData.description || "",
        createdBy: houseData.createdBy,
        createdAt: now,
        updatedAt: now,
        managers: [
          {
            userId: houseData.createdBy,
            email: userEmail,
            displayName: userDisplayName,
            role: "owner",
            addedAt: now,
            addedBy: houseData.createdBy,
          },
        ],
        isActive: true,
      };

      await setDoc(houseDoc, firestoreHouse);

      // Create user house access record
      await this.createUserHouseAccess(houseId, houseData.createdBy, "owner");

      console.log("House created in Firestore:", houseId, houseData.name);
      console.log("User house access created for user:", houseData.createdBy, "house:", houseId);

      return firestoreHouse as House;
    } catch (error) {
      console.error("Error creating house:", error);
      CrashlyticsService.logError(error as Error, "Create house");
      throw error;
    }
  }

  // Get user's houses
  static async getUserHouses(userId: string): Promise<House[]> {
    try {
      console.log("Getting user houses for user:", userId);
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // Get user's house access records
      const accessRef = collection(db, houseCollections.USER_HOUSE_ACCESS);
      const accessQuery = query(accessRef, where("userId", "==", userId));
      const accessSnapshot = await getDocs(accessQuery);

      console.log("Found", accessSnapshot.docs.length, "access records for user:", userId);
      const houseIds = accessSnapshot.docs.map((doc: any) => doc.data().houseId);
      console.log("House IDs:", houseIds);

      if (houseIds.length === 0) {
        console.log("No houses found for user:", userId);
        return [];
      }

      // Get house details
      const housesRef = collection(db, houseCollections.HOUSES);
      const housesQuery = query(housesRef, where("__name__", "in", houseIds));
      const housesSnapshot = await getDocs(housesQuery);

      const houses = housesSnapshot.docs.map((doc: any) => ({
        ...doc.data(),
        id: doc.id,
      })) as House[];

      console.log("Retrieved", houses.length, "houses for user:", userId);
      return houses;
    } catch (error) {
      console.error("Error getting user houses:", error);
      CrashlyticsService.logError(error as Error, "Get user houses");
      throw error;
    }
  }

  // Update house
  static async updateHouse(houseId: string, updates: Partial<House>): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();
      const houseDoc = doc(db, houseCollections.HOUSES, houseId);

      // Filter out undefined values to prevent Firestore errors
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined),
      );

      await updateDoc(houseDoc, {
        ...filteredUpdates,
        updatedAt: new Date().toISOString(),
      });

      console.log("House updated in Firestore:", houseId);
    } catch (error) {
      console.error("Error updating house:", error);
      CrashlyticsService.logError(error as Error, "Update house");
      throw error;
    }
  }

  // Delete house
  static async deleteHouse(houseId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // Delete house document
      const houseDoc = doc(db, houseCollections.HOUSES, houseId);
      await deleteDoc(houseDoc);

      // Delete user access records
      const accessRef = collection(db, houseCollections.USER_HOUSE_ACCESS);
      const accessQuery = query(accessRef, where("houseId", "==", houseId));
      const accessSnapshot = await getDocs(accessQuery);

      const deletePromises = accessSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log("House deleted from Firestore:", houseId);
    } catch (error) {
      console.error("Error deleting house:", error);
      CrashlyticsService.logError(error as Error, "Delete house");
      throw error;
    }
  }

  // Delete user account and all associated data
  static async deleteUserAccount(userId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      console.log("Starting account deletion for user:", userId);

      // 1. Get all houses where user is owner
      const userAccessRef = collection(db, houseCollections.USER_HOUSE_ACCESS);
      const userAccessQuery = query(userAccessRef, where("userId", "==", userId));
      const userAccessSnapshot = await getDocs(userAccessQuery);

      const ownedHouses: string[] = [];
      const managedHouses: string[] = [];

      userAccessSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.role === "owner") {
          ownedHouses.push(data.houseId);
        } else {
          managedHouses.push(data.houseId);
        }
      });

      console.log("User owns houses:", ownedHouses);
      console.log("User manages houses:", managedHouses);

      // 2. Delete all houses where user is owner
      for (const houseId of ownedHouses) {
        await this.deleteHouse(houseId);
        console.log("Deleted owned house:", houseId);
      }

      // 3. Remove user from houses where they are manager
      for (const houseId of managedHouses) {
        await this.removeHouseManager(houseId, userId);
        console.log("Removed user from managed house:", houseId);
      }

      // 4. Delete all user access records
      const deleteAccessPromises = userAccessSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
      await Promise.all(deleteAccessPromises);

      // 5. Delete user profile
      const userProfileDoc = doc(db, houseCollections.USERS, userId);
      await deleteDoc(userProfileDoc);

      // 6. Delete all invitations sent by this user
      const invitationsRef = collection(db, houseCollections.HOUSE_INVITATIONS);
      const sentInvitationsQuery = query(invitationsRef, where("invitedBy", "==", userId));
      const sentInvitationsSnapshot = await getDocs(sentInvitationsQuery);
      const deleteInvitationsPromises = sentInvitationsSnapshot.docs.map((doc: any) =>
        deleteDoc(doc.ref),
      );
      await Promise.all(deleteInvitationsPromises);

      // 7. Delete all invitations received by this user
      const receivedInvitationsQuery = query(invitationsRef, where("invitedEmail", "==", userId));
      const receivedInvitationsSnapshot = await getDocs(receivedInvitationsQuery);
      const deleteReceivedInvitationsPromises = receivedInvitationsSnapshot.docs.map((doc: any) =>
        deleteDoc(doc.ref),
      );
      await Promise.all(deleteReceivedInvitationsPromises);

      console.log("User account deleted successfully:", userId);
    } catch (error) {
      console.error("Error deleting user account:", error);
      CrashlyticsService.logError(error as Error, "Delete user account");
      throw error;
    }
  }

  // Create user house access record
  private static async createUserHouseAccess(
    houseId: string,
    userId: string,
    role: HouseRole,
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();
      const accessRef = collection(db, houseCollections.USER_HOUSE_ACCESS);
      const accessDoc = doc(accessRef);

      const accessData: FirestoreUserHouseAccess = {
        userId,
        houseId,
        role,
        addedAt: new Date().toISOString(),
      };

      await setDoc(accessDoc, accessData);
    } catch (error) {
      console.error("Error creating user house access:", error);
      throw error;
    }
  }

  // Remove house manager
  static async removeHouseManager(houseId: string, userId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // Remove from user access
      const accessRef = collection(db, houseCollections.USER_HOUSE_ACCESS);
      const accessQuery = query(
        accessRef,
        where("houseId", "==", houseId),
        where("userId", "==", userId),
      );
      const accessSnapshot = await getDocs(accessQuery);

      const deletePromises = accessSnapshot.docs.map((doc: any) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Update house managers list
      const houseDoc = doc(db, houseCollections.HOUSES, houseId);
      const houseSnapshot = await getDoc(houseDoc);

      if (houseSnapshot.exists()) {
        const houseData = houseSnapshot.data() as FirestoreHouse;
        const updatedManagers = houseData.managers.filter((m) => m.userId !== userId);

        await updateDoc(houseDoc, {
          managers: updatedManagers,
          updatedAt: new Date().toISOString(),
        });
      }

      console.log("House manager removed:", userId, "from house:", houseId);
    } catch (error) {
      console.error("Error removing house manager:", error);
      throw error;
    }
  }

  // ===== HOUSE INVITATIONS =====

  // Send house invitation
  static async sendHouseInvitation(
    houseId: string,
    email: string,
    invitedBy: string,
    invitedByName: string,
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // Get house details
      const houseDoc = doc(db, houseCollections.HOUSES, houseId);
      const houseSnapshot = await getDoc(houseDoc);

      if (!houseSnapshot.exists()) {
        throw new Error("House not found");
      }

      const houseData = houseSnapshot.data() as FirestoreHouse;

      // Check if invitation already exists
      const existingInvitationsQuery = query(
        collection(db, houseCollections.HOUSE_INVITATIONS),
        where("houseId", "==", houseId),
        where("invitedEmail", "==", email.toLowerCase()),
        where("status", "==", "pending"),
      );

      const existingInvitations = await getDocs(existingInvitationsQuery);
      if (!existingInvitations.empty) {
        throw new Error(translate("errors.inviteAlreadySent"));
      }

      // Create invitation
      const invitationRef = collection(db, houseCollections.HOUSE_INVITATIONS);
      const invitationDoc = doc(invitationRef);
      const invitationId = invitationDoc.id;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation: FirestoreHouseInvitation = {
        id: invitationId,
        houseId,
        houseName: houseData.name,
        invitedEmail: email.toLowerCase(),
        invitedBy,
        invitedByName,
        role: "manager" as HouseRole,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await setDoc(invitationDoc, invitation);
      console.log("House invitation sent:", email, "for house:", houseData.name);
    } catch (error) {
      console.error("Error sending house invitation:", error);
      throw error;
    }
  }

  // Get user invitations
  static async getUserInvitations(userId: string, userEmail: string): Promise<HouseInvitation[]> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      console.log("Getting invitations for user:", userId, "email:", userEmail);

      // Query invitations by user email
      const invitationsQuery = query(
        collection(db, houseCollections.HOUSE_INVITATIONS),
        where("invitedEmail", "==", userEmail.toLowerCase()),
      );

      const invitationsSnapshot = await getDocs(invitationsQuery);
      const invitations: HouseInvitation[] = [];

      invitationsSnapshot.forEach((doc: any) => {
        const data = doc.data() as FirestoreHouseInvitation;
        invitations.push({
          id: doc.id,
          houseId: data.houseId,
          houseName: data.houseName,
          invitedEmail: data.invitedEmail,
          invitedBy: data.invitedBy,
          invitedByName: data.invitedByName,
          role: data.role as HouseRole,
          status: data.status,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
        });
      });

      console.log(`Found ${invitations.length} invitations for user: ${userId}`);
      return invitations;
    } catch (error) {
      console.error("Error getting user invitations:", error);
      throw error;
    }
  }

  // Accept house invitation
  static async acceptHouseInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // Update invitation status
      const invitationDoc = doc(db, houseCollections.HOUSE_INVITATIONS, invitationId);
      await updateDoc(invitationDoc, {
        status: "accepted",
      });

      // Get invitation details
      const invitationSnapshot = await getDoc(invitationDoc);
      if (!invitationSnapshot.exists()) {
        throw new Error("Invitation not found");
      }

      const invitation = invitationSnapshot.data() as FirestoreHouseInvitation;

      // Create user house access
      await this.createUserHouseAccess(invitation.houseId, userId, invitation.role);

      // Update house managers list
      const houseDoc = doc(db, houseCollections.HOUSES, invitation.houseId);
      const houseSnapshot = await getDoc(houseDoc);

      if (houseSnapshot.exists()) {
        const houseData = houseSnapshot.data() as FirestoreHouse;

        // Get user profile to populate display name
        const userProfile = await this.getUserProfile(userId);
        const displayName = userProfile?.displayName || "";

        const newManager: HouseManager = {
          userId,
          email: invitation.invitedEmail,
          displayName: displayName,
          role: invitation.role,
          addedAt: new Date().toISOString(),
          addedBy: invitation.invitedBy,
        };

        await updateDoc(houseDoc, {
          managers: [...houseData.managers, newManager],
          updatedAt: new Date().toISOString(),
        });
      }

      console.log("House invitation accepted:", invitationId);
    } catch (error) {
      console.error("Error accepting house invitation:", error);
      throw error;
    }
  }

  // Decline house invitation
  static async declineHouseInvitation(invitationId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const invitationDoc = doc(db, houseCollections.HOUSE_INVITATIONS, invitationId);
      await updateDoc(invitationDoc, {
        status: "declined",
      });

      console.log("House invitation declined:", invitationId);
    } catch (error) {
      console.error("Error declining house invitation:", error);
      throw error;
    }
  }

  // ===== USER PROFILE MANAGEMENT =====

  // Create user profile
  static async createUserProfile(
    userId: string,
    email: string,
    displayName: string,
    photoURL?: string,
    providers?: ("password" | "google.com")[],
    hasPassword?: boolean,
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();
      const now = new Date().toISOString();

      const userDoc = doc(db, houseCollections.USERS, userId);

      // Build user data object, excluding undefined values
      const userData: any = {
        id: userId,
        email: email.toLowerCase(),
        displayName,
        createdAt: now,
        updatedAt: now,
      };

      // Only add photoURL if it's defined
      if (photoURL) {
        userData.photoURL = photoURL;
      }

      // Add providers if defined
      if (providers) {
        userData.providers = providers;
      }

      // Add hasPassword if defined
      if (hasPassword !== undefined) {
        userData.hasPassword = hasPassword;
      }

      await setDoc(userDoc, userData);
      console.log("User profile created:", userId, displayName);
    } catch (error) {
      console.error("Error creating user profile:", error);
      throw error;
    }
  }

  // Get user profile
  static async getUserProfile(userId: string): Promise<FirestoreUser | null> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const userDoc = doc(db, houseCollections.USERS, userId);
      const userSnapshot = await getDoc(userDoc);

      if (!userSnapshot.exists()) {
        return null;
      }

      return userSnapshot.data() as FirestoreUser;
    } catch (error) {
      console.error("Error getting user profile:", error);
      throw error;
    }
  }

  // Get multiple user profiles by IDs
  static async getUserProfiles(userIds: string[]): Promise<Map<string, FirestoreUser>> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();
      const userProfiles = new Map<string, FirestoreUser>();

      // Process in batches of 10 (Firestore 'in' query limit)
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const usersRef = collection(db, houseCollections.USERS);
        const q = query(usersRef, where("__name__", "in", batch));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          const userData = doc.data() as FirestoreUser;
          userProfiles.set(doc.id, userData);
        });
      }

      return userProfiles;
    } catch (error) {
      console.error("Error getting user profiles:", error);
      throw error;
    }
  }

  // Update user profile
  static async updateUserProfile(
    userId: string,
    updates: { displayName?: string; photoURL?: string },
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const userDoc = doc(db, houseCollections.USERS, userId);

      // Filter out undefined values from updates
      const filteredUpdates: any = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.displayName !== undefined) {
        filteredUpdates.displayName = updates.displayName;
      }
      if (updates.photoURL !== undefined) {
        filteredUpdates.photoURL = updates.photoURL;
      }

      await updateDoc(userDoc, filteredUpdates);

      console.log("User profile updated:", userId, updates);
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }

  // Update user providers (after linking/unlinking auth methods)
  static async updateUserProviders(
    userId: string,
    updates: { providers: ("password" | "google.com")[]; hasPassword: boolean },
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const userDoc = doc(db, houseCollections.USERS, userId);

      await updateDoc(userDoc, {
        providers: updates.providers,
        hasPassword: updates.hasPassword,
        updatedAt: new Date().toISOString(),
      });

      console.log("User providers updated:", userId, updates);
    } catch (error) {
      console.error("Error updating user providers:", error);
      throw error;
    }
  }
}
