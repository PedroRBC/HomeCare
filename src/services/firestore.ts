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
  writeBatch,
  arrayUnion,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "@react-native-firebase/firestore";
import { Caregiver, PaymentHistory, PaymentsByCaregiver } from "@/context/ScheduleContext";
import { House, HouseManager, HouseInvitation, HouseRole } from "@/types/house.types";
import { logger } from "@/utils/logger";
import type { UserConsents } from "@/utils/privacy";
import { decryptFields, encryptFields, SECURE_FIELDS } from "@/utils/secureFields";
import { buildDataExport, type DataExport, type HouseExportInput } from "@/utils/dataExport";
import { CrashlyticsService } from "./firebase";
import { HouseKeyService } from "./houseKeys";

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

const HOUSE_DATA_COLLECTIONS = ["caregivers", "schedule", "payments", "paymentHistory"] as const;

// Access records have a predictable id so security rules can check membership
const accessDocId = (houseId: string, userId: string) => `${houseId}_${userId}`;

// Firestore batches accept up to 500 writes
const BATCH_LIMIT = 400;

// Sensitive fields (see SECURE_FIELDS) are stored encrypted, as "enc:v1:..." strings
type Encrypted<T> = T | string;

export interface FirestoreCaregiver {
  id: string;
  name: string;
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário";
  amount: Encrypted<number>;
  dayAmount?: Encrypted<number>;
  nightAmount?: Encrypted<number>;
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
  amount: Encrypted<number>;
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
  invitationId?: string; // Invitation that granted access (checked by security rules)
  legacyAccessId?: string; // Record this one replaced (checked by security rules)
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
  consents?: UserConsents;
}

export class FirestoreService {
  private static unsubscribeFunctions: (() => void)[] = [];
  private static currentHouseId: string | null = null;
  private static houseKey: Uint8Array | null = null;
  private static migratingDocs = new Set<string>();

  // Initialize Firestore for a house (shared by all managers/owners)
  static async initialize(userId: string, houseId: string): Promise<void> {
    try {
      logger.log("Initializing Firestore service for user:", userId, "house:", houseId);
      this.currentHouseId = houseId;
      await this.testConnection();
      this.houseKey = await HouseKeyService.getKey(houseId, userId);
      logger.log("Firestore service initialized successfully for user:", userId);
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

  private static requireHouseKey(): Uint8Array {
    if (!this.houseKey) {
      throw new Error("House encryption key not loaded. Call initialize() first.");
    }
    return this.houseKey;
  }

  // Cleanup and reset for user logout
  static cleanup(): void {
    logger.log("Cleaning up FirestoreService for user logout");
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
    this.currentHouseId = null;
    this.houseKey = null;
    HouseKeyService.clear();
  }

  // Re-writes records stored before encryption existed with their sensitive fields encrypted
  private static encryptLegacyRecord(
    docPath: string,
    record: Record<string, unknown>,
    fields: readonly string[],
  ): void {
    if (this.migratingDocs.has(docPath) || !this.houseKey) return;
    this.migratingDocs.add(docPath);

    const encrypted = encryptFields(record, fields, this.houseKey, docPath);
    const updates = Object.fromEntries(
      fields.filter((f) => f in encrypted).map((f) => [f, encrypted[f]]),
    );

    updateDoc(doc(getFirestore(), docPath), updates)
      .then(() => logger.log("Encrypted legacy record:", docPath))
      .catch((error) => console.error("Error encrypting legacy record:", error))
      .finally(() => this.migratingDocs.delete(docPath));
  }

  private static toCaregiver(docPath: string, stored: Record<string, unknown>, key: Uint8Array) {
    const { data, hasPlaintext, hasLockedFields } = decryptFields(
      stored,
      SECURE_FIELDS.caregivers,
      key,
      docPath,
    );
    if (hasLockedFields) CrashlyticsService.log("Caregiver fields could not be decrypted");

    const caregiver: Caregiver = {
      id: data.id as string,
      name: data.name as string,
      frequency: data.frequency as Caregiver["frequency"],
      amount: Number(data.amount),
      dayAmount: data.dayAmount === undefined ? undefined : Number(data.dayAmount),
      nightAmount: data.nightAmount === undefined ? undefined : Number(data.nightAmount),
      disabled: data.disabled as boolean | undefined,
    };
    return { caregiver, data, hasPlaintext };
  }

  private static toPaymentHistory(
    docPath: string,
    stored: Record<string, unknown>,
    key: Uint8Array,
  ) {
    const { data, hasPlaintext, hasLockedFields } = decryptFields(
      stored,
      SECURE_FIELDS.paymentHistory,
      key,
      docPath,
    );
    if (hasLockedFields) CrashlyticsService.log("Payment history fields could not be decrypted");

    const entry = data as unknown as FirestorePaymentHistory;
    const paymentHistory: PaymentHistory = {
      id: entry.id,
      caregiverId: entry.caregiverId,
      caregiverName: entry.caregiverName,
      date: entry.date,
      frequency: entry.frequency,
      description: entry.description,
      amount: Number(entry.amount),
      paidAt: entry.paidAt,
    };

    if (entry.managerName) paymentHistory.managerName = entry.managerName;
    if (entry.periodKey) paymentHistory.periodKey = entry.periodKey;
    if (entry.paymentKeys) paymentHistory.paymentKeys = entry.paymentKeys;
    if (entry.historyKey) paymentHistory.historyKey = entry.historyKey;

    return { paymentHistory, data, hasPlaintext };
  }

  // Test Firestore connection
  static async testConnection(): Promise<void> {
    try {
      const db = getFirestore();
      const testDoc = doc(db, "_test", "connection");
      await getDoc(testDoc);
      logger.log("Firestore connection test successful");
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
          const key = this.requireHouseKey();
          const caregivers: Caregiver[] = [];
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
            const docPath = `${collections.CAREGIVERS}/${doc.id}`;
            const { caregiver, data, hasPlaintext } = this.toCaregiver(docPath, doc.data(), key);
            if (hasPlaintext) this.encryptLegacyRecord(docPath, data, SECURE_FIELDS.caregivers);
            caregivers.push(caregiver);
          });
          logger.log("Caregivers updated from Firestore:", caregivers.length, "caregivers");
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

      const firestoreCaregiver = encryptFields(
        {
          id: caregiverId,
          name: caregiver.name,
          frequency: caregiver.frequency,
          amount: caregiver.amount,
          dayAmount: caregiver.dayAmount,
          nightAmount: caregiver.nightAmount,
          createdAt: now,
          updatedAt: now,
        },
        SECURE_FIELDS.caregivers,
        this.requireHouseKey(),
        caregiverDoc.path,
      ) as unknown as FirestoreCaregiver;

      await setDoc(caregiverDoc, firestoreCaregiver);

      logger.log("Caregiver added to Firestore:", caregiverId);
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
      await updateDoc(
        caregiverDoc,
        encryptFields(
          updateData,
          SECURE_FIELDS.caregivers,
          this.requireHouseKey(),
          caregiverDoc.path,
        ),
      );

      logger.log("Caregiver updated in Firestore:", caregiverId);
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
          logger.log("Schedule updated from Firestore:", Object.keys(schedule).length, "days");
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

      logger.log(
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

          logger.log("Payments updated from Firestore:", querySnapshot.size, "payment documents");
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

      logger.log("Payment upserted in Firestore:", paymentId, caregiverId, frequency, paymentKey);
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
        logger.log("No payment keys to delete");
        return;
      }

      const db = getFirestore();
      const paymentsRef = collection(db, this.getCollections().PAYMENTS);
      logger.log("Payments collection:", paymentsRef);
      logger.log("Deleting payments for caregiver:", caregiverId, "with keys:", paymentKeys);

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

      logger.log(`Deleted ${totalDeleted} payment documents for caregiver ${caregiverId}`);
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
          const key = this.requireHouseKey();
          const history: PaymentHistory[] = [];
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
            const docPath = `${paymentHistoryRef.path}/${doc.id}`;
            const { paymentHistory, data, hasPlaintext } = this.toPaymentHistory(
              docPath,
              doc.data(),
              key,
            );
            if (hasPlaintext) {
              this.encryptLegacyRecord(docPath, data, SECURE_FIELDS.paymentHistory);
            }
            history.push(paymentHistory);
          });
          logger.log("Payment history updated from Firestore:", history.length, "payments");
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

      const firestorePayment = encryptFields(
        {
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
        },
        SECURE_FIELDS.paymentHistory,
        this.requireHouseKey(),
        paymentDoc.path,
      ) as unknown as FirestorePaymentHistory;

      await setDoc(paymentDoc, firestorePayment, { merge: true });

      logger.log("Payment history upserted in Firestore:", paymentId);
      return paymentId;
    } catch (error) {
      console.error("Error adding payment history to Firestore:", error);
      CrashlyticsService.logError(error as Error, "Add payment history error");
      throw error;
    }
  }

  // ===== HOUSE MANAGEMENT =====

  // Create a new house, together with its owner access record and encryption key
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

      const access: FirestoreUserHouseAccess = {
        userId: houseData.createdBy,
        houseId,
        role: "owner",
        addedAt: now,
      };

      const batch = writeBatch(db);
      batch.set(houseDoc, firestoreHouse);
      batch.set(this.accessRef(houseId, houseData.createdBy), access);
      batch.set(
        HouseKeyService.keyRef(houseId),
        HouseKeyService.newKeyDocument(houseData.createdBy),
      );
      await batch.commit();

      logger.log("House created in Firestore:", houseId);
      return firestoreHouse as House;
    } catch (error) {
      console.error("Error creating house:", error);
      CrashlyticsService.logError(error as Error, "Create house");
      throw error;
    }
  }

  private static accessRef(houseId: string, userId: string) {
    return doc(
      getFirestore(),
      getHouseCollections().USER_HOUSE_ACCESS,
      accessDocId(houseId, userId),
    );
  }

  // Access records created before security rules used random ids. Each one is
  // replaced by a record with a predictable id the rules can check.
  private static async migrateLegacyAccess(
    userId: string,
    records: QueryDocumentSnapshot[],
  ): Promise<void> {
    const legacy = records.filter(
      (record) => record.id !== accessDocId(record.data().houseId, userId),
    );
    if (legacy.length === 0) return;

    try {
      const current = new Set(records.map((record) => record.id));
      const batch = writeBatch(getFirestore());

      legacy.forEach((record) => {
        const data = record.data() as FirestoreUserHouseAccess;
        const id = accessDocId(data.houseId, userId);
        if (!current.has(id)) {
          current.add(id);
          batch.set(this.accessRef(data.houseId, userId), {
            userId,
            houseId: data.houseId,
            role: data.role,
            addedAt: data.addedAt,
            legacyAccessId: record.id,
          });
        }
        batch.delete(record.ref);
      });

      await batch.commit();
      logger.log("Migrated", legacy.length, "legacy access records");
    } catch (error) {
      console.error("Error migrating legacy access records:", error);
      CrashlyticsService.logError(error as Error, "Migrate legacy access");
    }
  }

  private static async getAccessRecords(userId: string): Promise<FirestoreUserHouseAccess[]> {
    const db = getFirestore();
    const accessRef = collection(db, getHouseCollections().USER_HOUSE_ACCESS);
    const snapshot = await getDocs(query(accessRef, where("userId", "==", userId)));
    await this.migrateLegacyAccess(userId, snapshot.docs);
    return snapshot.docs.map(
      (record: QueryDocumentSnapshot) => record.data() as FirestoreUserHouseAccess,
    );
  }

  // Get user's houses
  static async getUserHouses(userId: string): Promise<House[]> {
    try {
      const db = getFirestore();
      const houseIds = [...new Set((await this.getAccessRecords(userId)).map((a) => a.houseId))];
      logger.log("Found", houseIds.length, "houses for user");

      const snapshots = await Promise.all(
        houseIds.map((houseId) => getDoc(doc(db, getHouseCollections().HOUSES, houseId))),
      );

      return snapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => ({ ...snapshot.data(), id: snapshot.id }) as House);
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

      logger.log("House updated in Firestore:", houseId);
    } catch (error) {
      console.error("Error updating house:", error);
      CrashlyticsService.logError(error as Error, "Update house");
      throw error;
    }
  }

  private static async deleteDocuments(refs: DocumentReference[]): Promise<void> {
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(getFirestore());
      refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  // Delete a house and everything stored for it: caregivers, schedule, payments,
  // history, invitations, access records and its encryption key. Destroying the key
  // also makes any copy of the encrypted data left behind (backups, caches) unreadable.
  static async deleteHouse(houseId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // House data goes first, while the owner's access record still grants permission
      for (const collectionName of HOUSE_DATA_COLLECTIONS) {
        const snapshot = await getDocs(
          collection(db, houseCollections.HOUSES, houseId, collectionName),
        );
        await this.deleteDocuments(
          snapshot.docs.map((record: QueryDocumentSnapshot) => record.ref),
        );
      }

      const invitations = await getDocs(
        query(collection(db, houseCollections.HOUSE_INVITATIONS), where("houseId", "==", houseId)),
      );
      await this.deleteDocuments(
        invitations.docs.map((record: QueryDocumentSnapshot) => record.ref),
      );

      const access = await getDocs(
        query(collection(db, houseCollections.USER_HOUSE_ACCESS), where("houseId", "==", houseId)),
      );

      // Rules are checked against the state before the batch, so the owner can
      // remove the key, the house and every access record (their own included) at once
      const batch = writeBatch(db);
      batch.delete(HouseKeyService.keyRef(houseId));
      batch.delete(doc(db, houseCollections.HOUSES, houseId));
      access.docs.forEach((record: QueryDocumentSnapshot) => batch.delete(record.ref));
      await batch.commit();

      HouseKeyService.forget(houseId);
      logger.log("House deleted from Firestore:", houseId);
    } catch (error) {
      console.error("Error deleting house:", error);
      CrashlyticsService.logError(error as Error, "Delete house");
      throw error;
    }
  }

  // Leave a house managed by someone else
  private static async leaveHouse(houseId: string, userId: string): Promise<void> {
    const db = getFirestore();
    const houseDoc = doc(db, getHouseCollections().HOUSES, houseId);
    const houseSnapshot = await getDoc(houseDoc);
    const access = await getDocs(
      query(
        collection(db, getHouseCollections().USER_HOUSE_ACCESS),
        where("houseId", "==", houseId),
        where("userId", "==", userId),
      ),
    );

    const batch = writeBatch(db);
    if (houseSnapshot.exists()) {
      const houseData = houseSnapshot.data() as FirestoreHouse;
      batch.update(houseDoc, {
        managers: houseData.managers.filter((m) => m.userId !== userId),
        updatedAt: new Date().toISOString(),
      });
    }
    access.docs.forEach((record: QueryDocumentSnapshot) => batch.delete(record.ref));
    await batch.commit();
  }

  // Delete user account and all associated data
  static async deleteUserAccount(userId: string, email: string | null): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      logger.log("Starting account deletion");

      const accessRecords = await this.getAccessRecords(userId);
      const ownedHouses = new Set<string>();
      const managedHouses = new Set<string>();
      accessRecords.forEach((access) =>
        (access.role === "owner" ? ownedHouses : managedHouses).add(access.houseId),
      );

      // 1. Delete every house the user owns, with all of its data
      for (const houseId of ownedHouses) {
        await this.deleteHouse(houseId);
      }

      // 2. Leave the houses managed with other people
      for (const houseId of managedHouses) {
        if (!ownedHouses.has(houseId)) await this.leaveHouse(houseId, userId);
      }

      // 3. Delete invitations sent and received by the user
      const invitationsRef = collection(db, houseCollections.HOUSE_INVITATIONS);
      const invitationQueries = [query(invitationsRef, where("invitedBy", "==", userId))];
      if (email) {
        invitationQueries.push(
          query(invitationsRef, where("invitedEmail", "==", email.toLowerCase())),
        );
      }
      for (const invitationQuery of invitationQueries) {
        const snapshot = await getDocs(invitationQuery);
        await this.deleteDocuments(
          snapshot.docs.map((record: QueryDocumentSnapshot) => record.ref),
        );
      }

      // 4. Delete the user profile (consent records included)
      await deleteDoc(doc(db, houseCollections.USERS, userId));

      logger.log("User account data deleted");
    } catch (error) {
      console.error("Error deleting user account:", error);
      CrashlyticsService.logError(error as Error, "Delete user account");
      throw error;
    }
  }

  // Remove another manager from a house (owner only)
  static async removeHouseManager(houseId: string, userId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const access = await getDocs(
        query(
          collection(db, houseCollections.USER_HOUSE_ACCESS),
          where("houseId", "==", houseId),
          where("userId", "==", userId),
        ),
      );

      const houseDoc = doc(db, houseCollections.HOUSES, houseId);
      const houseSnapshot = await getDoc(houseDoc);

      const batch = writeBatch(db);
      access.docs.forEach((record: QueryDocumentSnapshot) => batch.delete(record.ref));
      if (houseSnapshot.exists()) {
        const houseData = houseSnapshot.data() as FirestoreHouse;
        batch.update(houseDoc, {
          managers: houseData.managers.filter((m) => m.userId !== userId),
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit();

      logger.log("House manager removed from house:", houseId);
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
      const invitedEmail = email.trim().toLowerCase();

      // Get house details
      const houseDoc = doc(db, houseCollections.HOUSES, houseId);
      const houseSnapshot = await getDoc(houseDoc);

      if (!houseSnapshot.exists()) {
        throw new Error("House not found");
      }

      const houseData = houseSnapshot.data() as FirestoreHouse;

      if (houseData.managers.some((manager) => manager.email?.toLowerCase() === invitedEmail)) {
        throw new Error("Este usuário já é gerente desta casa");
      }

      // Check if invitation already exists
      const existingInvitationsQuery = query(
        collection(db, houseCollections.HOUSE_INVITATIONS),
        where("houseId", "==", houseId),
        where("invitedEmail", "==", invitedEmail),
        where("status", "==", "pending"),
      );

      const existingInvitations = await getDocs(existingInvitationsQuery);
      if (!existingInvitations.empty) {
        throw new Error("Um convite já foi enviado para este email");
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
        invitedEmail,
        invitedBy,
        invitedByName,
        role: "manager" as HouseRole,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await setDoc(invitationDoc, invitation);
      logger.log("House invitation sent for house:", houseId);
    } catch (error) {
      console.error("Error sending house invitation:", error);
      throw error;
    }
  }

  private static isExpired(invitation: { expiresAt: string }): boolean {
    return new Date(invitation.expiresAt).getTime() < Date.now();
  }

  // Get user invitations
  static async getUserInvitations(userId: string, userEmail: string): Promise<HouseInvitation[]> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      // Query invitations by user email
      const invitationsQuery = query(
        collection(db, houseCollections.HOUSE_INVITATIONS),
        where("invitedEmail", "==", userEmail.toLowerCase()),
      );

      const invitationsSnapshot = await getDocs(invitationsQuery);
      const invitations: HouseInvitation[] = [];

      invitationsSnapshot.forEach((doc: any) => {
        const data = doc.data() as FirestoreHouseInvitation;
        const status =
          data.status === "pending" && this.isExpired(data) ? ("expired" as const) : data.status;
        invitations.push({
          id: doc.id,
          houseId: data.houseId,
          houseName: data.houseName,
          invitedEmail: data.invitedEmail,
          invitedBy: data.invitedBy,
          invitedByName: data.invitedByName,
          role: data.role as HouseRole,
          status,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
        });
      });

      logger.log(`Found ${invitations.length} invitations for user`);
      return invitations;
    } catch (error) {
      console.error("Error getting user invitations:", error);
      throw error;
    }
  }

  // Accept house invitation. Updating the invitation, creating the access record
  // and joining the managers list happen in one batch, which security rules check
  // together: access is only granted from a pending invitation for this user.
  static async acceptHouseInvitation(invitationId: string, userId: string): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const invitationDoc = doc(db, houseCollections.HOUSE_INVITATIONS, invitationId);
      const invitationSnapshot = await getDoc(invitationDoc);
      if (!invitationSnapshot.exists()) {
        throw new Error("Invitation not found");
      }

      const invitation = invitationSnapshot.data() as FirestoreHouseInvitation;
      if (invitation.status !== "pending") {
        throw new Error("Este convite não está mais disponível");
      }
      if (this.isExpired(invitation)) {
        throw new Error("Este convite expirou. Peça um novo convite ao proprietário da casa.");
      }

      const userProfile = await this.getUserProfile(userId);
      const now = new Date().toISOString();

      const newManager: HouseManager = {
        userId,
        email: invitation.invitedEmail,
        displayName: userProfile?.displayName || "",
        role: invitation.role,
        addedAt: now,
        addedBy: invitation.invitedBy,
      };

      const access: FirestoreUserHouseAccess = {
        userId,
        houseId: invitation.houseId,
        role: invitation.role,
        addedAt: now,
        invitationId,
      };

      const batch = writeBatch(db);
      batch.update(invitationDoc, { status: "accepted" });
      batch.set(this.accessRef(invitation.houseId, userId), access);
      batch.update(doc(db, houseCollections.HOUSES, invitation.houseId), {
        managers: arrayUnion(newManager),
        updatedAt: now,
      });
      await batch.commit();

      logger.log("House invitation accepted:", invitationId);
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

      logger.log("House invitation declined:", invitationId);
    } catch (error) {
      console.error("Error declining house invitation:", error);
      throw error;
    }
  }

  // ===== USER PROFILE MANAGEMENT =====

  // Create user profile. Merges into an existing document, so consents recorded
  // during sign-up are kept if the profile is created twice.
  static async createUserProfile(
    userId: string,
    email: string,
    displayName: string,
    photoURL?: string,
    providers?: ("password" | "google.com")[],
    hasPassword?: boolean,
    consents?: UserConsents,
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

      if (consents) {
        userData.consents = consents;
      }

      await setDoc(userDoc, userData, { merge: true });
      logger.log("User profile created:", userId);
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

      logger.log("User profile updated:", userId);
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }

  // Record the user's consent choices (LGPD art. 8: the controller must be able to prove consent)
  static async updateUserConsents(userId: string, consents: UserConsents): Promise<void> {
    const db = getFirestore();
    const userDoc = doc(db, getHouseCollections().USERS, userId);
    await setDoc(
      userDoc,
      { id: userId, consents, updatedAt: new Date().toISOString() },
      { merge: true },
    );
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

      logger.log("User providers updated:", userId);
    } catch (error) {
      console.error("Error updating user providers:", error);
      throw error;
    }
  }

  // ===== PERSONAL DATA EXPORT =====

  // Everything stored about the user, decrypted (LGPD art. 18, II and V)
  static async exportUserData(userId: string, email: string | null): Promise<DataExport> {
    const db = getFirestore();
    const houseCollections = getHouseCollections();
    const houses: HouseExportInput[] = [];

    for (const house of await this.getUserHouses(userId)) {
      const key = await HouseKeyService.getKey(house.id, userId);
      const houseRef = (name: string) => collection(db, houseCollections.HOUSES, house.id, name);
      const [caregivers, schedule, payments, paymentHistory] = await Promise.all(
        HOUSE_DATA_COLLECTIONS.map((name) => getDocs(houseRef(name))),
      );

      houses.push({
        house: house as unknown as Record<string, unknown> & { id: string },
        role: house.managers.find((manager) => manager.userId === userId)?.role,
        caregivers: caregivers.docs.map(
          (record: QueryDocumentSnapshot) =>
            this.toCaregiver(record.ref.path, record.data(), key).data,
        ),
        schedule: Object.fromEntries(
          schedule.docs.map((record: QueryDocumentSnapshot) => [record.id, record.data()]),
        ),
        payments: payments.docs.map((record: QueryDocumentSnapshot) => record.data()),
        paymentHistory: paymentHistory.docs.map(
          (record: QueryDocumentSnapshot) =>
            this.toPaymentHistory(record.ref.path, record.data(), key).data,
        ),
      });
    }

    const invitationsRef = collection(db, houseCollections.HOUSE_INVITATIONS);
    const sent = await getDocs(query(invitationsRef, where("invitedBy", "==", userId)));
    const received = email
      ? await getDocs(query(invitationsRef, where("invitedEmail", "==", email.toLowerCase())))
      : null;

    return buildDataExport({
      profile: (await this.getUserProfile(userId)) as Record<string, unknown> | null,
      houses,
      invitationsSent: sent.docs.map((record: QueryDocumentSnapshot) => record.data()),
      invitationsReceived:
        received?.docs.map((record: QueryDocumentSnapshot) => record.data()) ?? [],
    });
  }
}
