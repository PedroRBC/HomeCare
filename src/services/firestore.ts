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
  runTransaction,
  Timestamp,
  arrayUnion,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Transaction,
  type WriteBatch,
} from "@react-native-firebase/firestore";
import { Caregiver, PaymentHistory, PaymentsByCaregiver } from "@/context/ScheduleContext";
import { House, HouseManager, HouseInvitation, HouseRole } from "@/types/house.types";
import { logger } from "@/utils/logger";
import type { UserConsents } from "@/utils/privacy";
import type { AuthProviderType } from "@/types/auth";
import { decryptFields, encryptFields, SECURE_FIELDS } from "@/utils/secureFields";
import { isEncryptedValue } from "@/utils/fieldCrypto";
import { buildDataExport, type DataExport, type HouseExportInput } from "@/utils/dataExport";
import { effectiveInvitationStatus } from "@/utils/invitations";
import { paidShiftKey, parsePaymentKey } from "@/utils/paymentDomain";
import { moneyInCents } from "@/utils/paymentObligations";
import {
  caregiverLinkId,
  buildCaregiverShifts,
  dayShiftKeys,
  normalizeEmail,
  scheduleShiftKeys,
  shiftKey,
  type CaregiverLink,
  type CaregiverLinkStatus,
} from "@/utils/caregiverShifts";
import { CrashlyticsService } from "./firebase";
import { HouseKeyService } from "./houseKeys";
import { CaregiverPayService } from "./caregiverPay";
import { deleteOwnReports, listOwnReports } from "./feedbackReports";
import { ShiftNotesService, noteKeyRef } from "./shiftNotes";
import { t as translate } from "i18next";
import type { HouseAccessIssue } from "@/types/house.types";

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
    CAREGIVER_LINKS: "caregiver_links",
    CAREGIVER_ACCESS: "caregiver_access",
  }) as const;

const HOUSE_DATA_COLLECTIONS = ["caregivers", "schedule", "payments", "paymentHistory"] as const;

// Access records have a predictable id so security rules can check membership
const accessDocId = (houseId: string, userId: string) => `${houseId}_${userId}`;

// Firestore batches accept up to 500 writes
const BATCH_LIMIT = 400;

// Sensitive fields (see SECURE_FIELDS) are stored encrypted, as "enc:v1:..." strings
type Encrypted<T> = T | string;

// A record whose encrypted fields couldn't be read (wrong key or tampered data)
export class LockedRecordError extends Error {
  constructor() {
    super("This record's encrypted data can't be read on this device");
    this.name = "LockedRecordError";
  }
}

export class HouseAccessRepairError extends Error {
  constructor(public readonly issues: HouseAccessIssue[]) {
    super(translate("errors.houseAccessRepair"));
    this.name = "HouseAccessRepairError";
  }
}

// The selected house with its key; replaced, never changed, when the selection changes
type HouseScope = Readonly<{
  userId: string;
  houseId: string;
  houseName: string;
  key: Uint8Array;
  generation: number;
}>;

type ScheduleSnapshot = Record<
  string,
  {
    day: string[];
    night: string[];
    dayExtra?: string[];
    nightExtra?: string[];
    dayAdditional?: string[];
    nightAdditional?: string[];
  }
>;

export interface FirestoreCaregiver {
  id: string;
  name: string;
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário";
  amount: Encrypted<number>;
  dayAmount?: Encrypted<number>;
  nightAmount?: Encrypted<number>;
  additionalAmount?: Encrypted<number>;
  disabled?: boolean;
  email?: string; // Login email of the caregiver, gives her read access to her shifts
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreCaregiverLink extends Omit<CaregiverLink, "id"> {
  updatedAt: string;
  respondedAt?: string;
}

type CaregiverLinkWriteTarget = {
  set: (ref: DocumentReference, data: FirestoreCaregiverLink) => unknown;
  update: (ref: DocumentReference, data: Partial<FirestoreCaregiverLink>) => unknown;
  delete: (ref: DocumentReference) => unknown;
};

type CaregiverLinkWriter = {
  ref: DocumentReference;
  write: (writer: CaregiverLinkWriteTarget, current?: DocumentSnapshot) => void;
};

const linkWriteBatchTarget = (batch: WriteBatch): CaregiverLinkWriteTarget => ({
  set: (ref, data) => batch.set(ref, data),
  update: (ref, data) => batch.update(ref, data),
  delete: (ref) => batch.delete(ref),
});

const linkWriteTransactionTarget = (transaction: Transaction): CaregiverLinkWriteTarget => ({
  set: (ref, data) => transaction.set(ref, data),
  update: (ref, data) => transaction.update(ref, data),
  delete: (ref) => transaction.delete(ref),
});

export interface FirestoreSchedule {
  [dateKey: string]: {
    day: string[]; // Array of caregiver IDs for day shift
    night: string[]; // Array of caregiver IDs for night shift
    dayExtra?: string[]; // Legacy extra day assignments
    nightExtra?: string[]; // Legacy extra night assignments
    dayAdditional?: string[]; // Add-on for an assigned regular day shift
    nightAdditional?: string[]; // Add-on for an assigned regular night shift
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
  dayRate?: Encrypted<number>;
  nightRate?: Encrypted<number>;
  additionalRate?: Encrypted<number>;
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
  expiresAtTs?: Timestamp; // Missing on invitations from before server-checked expiry
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
  providers?: AuthProviderType[];
  hasPassword?: boolean;
  consents?: UserConsents;
}

export class FirestoreService {
  private static unsubscribeFunctions: (() => void)[] = [];
  private static scope: HouseScope | null = null;
  private static generation = 0;
  private static migratingDocs = new Set<string>();

  private static validateAdditionalAmount(value: number): void {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 1e-7
    ) {
      throw new Error("Additional amount must be a finite, non-negative currency value");
    }
  }

  // Initialize Firestore for a house (shared by all managers/owners)
  // Returns false when a newer initialize() or cleanup() superseded this one
  static async initialize(userId: string, houseId: string, houseName = ""): Promise<boolean> {
    const generation = ++this.generation;
    try {
      logger.log("Initializing Firestore service for user:", userId, "house:", houseId);
      // The house and its key are published together once the key is loaded, so a
      // write can never pair one house with another house's key
      this.scope = null;
      await this.testConnection();
      const key = await HouseKeyService.getKey(houseId, userId);
      if (generation !== this.generation) return false;

      this.scope = Object.freeze({ userId, houseId, houseName, key, generation });
      logger.log("Firestore service initialized successfully for user:", userId);
      return true;
    } catch (error) {
      console.error("Error initializing Firestore:", error);
      CrashlyticsService.logError(error as Error, "Firestore initialization");
      throw error;
    }
  }

  // House, key and generation an operation works with, taken once when it starts:
  // a house switch while it awaits can't make it pair this house with another's key
  private static requireScope(): HouseScope {
    if (!this.scope) {
      throw new Error("FirestoreService not initialized. Call initialize() first.");
    }
    return this.scope;
  }

  static isReadyFor(userId: string, houseId: string): boolean {
    return this.scope?.userId === userId && this.scope.houseId === houseId;
  }

  // Checked right before writing: a write started for a house that was left (switch,
  // sign-out) is refused instead of landing after the user moved on
  private static assertCurrent(scope: HouseScope): void {
    if (this.scope?.generation !== scope.generation) {
      throw new Error("The selected house changed before the change was saved");
    }
  }

  // Cleanup and reset for user logout
  static cleanup(): void {
    logger.log("Cleaning up FirestoreService for user logout");
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
    this.generation++;
    this.scope = null;
    HouseKeyService.clear();
  }

  // Re-writes records stored before encryption existed with their sensitive fields encrypted
  // Runs in a transaction on the current document: a field another manager changed
  // meanwhile is left alone, only values still in plain text are encrypted
  private static encryptLegacyRecord(
    docPath: string,
    fields: readonly string[],
    key: Uint8Array,
  ): void {
    if (this.migratingDocs.has(docPath)) return;
    this.migratingDocs.add(docPath);

    const db = getFirestore();
    runTransaction(db, async (transaction) => {
      const ref = doc(db, docPath);
      const current = await transaction.get(ref);
      if (!current.exists()) return;

      const data = current.data() as Record<string, unknown>;
      const plain = Object.fromEntries(
        fields
          .filter((field) => data[field] !== undefined && !isEncryptedValue(data[field]))
          .map((field) => [field, data[field]]),
      );
      if (Object.keys(plain).length === 0) return;

      transaction.update(ref, encryptFields(plain, fields, key, docPath));
    })
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
      additionalAmount:
        data.additionalAmount === undefined ? undefined : Number(data.additionalAmount),
      disabled: data.disabled as boolean | undefined,
      ...(data.email ? { email: data.email as string } : {}),
      // Shown, but its rates are unknown: no edits or payments until readable again
      ...(hasLockedFields && { locked: true }),
    };
    return {
      caregiver,
      data: hasLockedFields
        ? {
            ...data,
            locked: true,
            amount: null,
            dayAmount: null,
            nightAmount: null,
            additionalAmount: null,
          }
        : data,
      hasPlaintext,
    };
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
      ...(entry.dayRate !== undefined && { dayRate: Number(entry.dayRate) }),
      ...(entry.nightRate !== undefined && { nightRate: Number(entry.nightRate) }),
      ...(entry.additionalRate !== undefined && { additionalRate: Number(entry.additionalRate) }),
      paidAt: entry.paidAt,
      ...(hasLockedFields && { locked: true }),
    };

    if (entry.managerName) paymentHistory.managerName = entry.managerName;
    if (entry.periodKey) paymentHistory.periodKey = entry.periodKey;
    if (entry.paymentKeys) paymentHistory.paymentKeys = entry.paymentKeys;
    if (entry.historyKey) paymentHistory.historyKey = entry.historyKey;

    return {
      paymentHistory,
      data: hasLockedFields
        ? {
            ...data,
            locked: true,
            amount: null,
            dayRate: null,
            nightRate: null,
            additionalRate: null,
          }
        : data,
      hasPlaintext,
    };
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
    const { houseId, key } = this.requireScope();
    const collections = getCollections(houseId);
    const caregiversRef = collection(db, collections.CAREGIVERS);
    const q = query(caregiversRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          const caregivers: Caregiver[] = [];
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
            const docPath = `${collections.CAREGIVERS}/${doc.id}`;
            const { caregiver, hasPlaintext } = this.toCaregiver(docPath, doc.data(), key);
            if (hasPlaintext) this.encryptLegacyRecord(docPath, SECURE_FIELDS.caregivers, key);
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
      const scope = this.requireScope();
      const now = new Date().toISOString();
      const db = getFirestore();
      const caregiversRef = collection(db, getCollections(scope.houseId).CAREGIVERS);
      const caregiverDoc = doc(caregiversRef);
      const caregiverId = caregiverDoc.id;

      if (caregiver.additionalAmount !== undefined)
        this.validateAdditionalAmount(caregiver.additionalAmount);

      const plainCaregiver: FirestoreCaregiver = {
        id: caregiverId,
        name: caregiver.name,
        frequency: caregiver.frequency,
        amount: caregiver.amount,
        ...(caregiver.dayAmount !== undefined && { dayAmount: caregiver.dayAmount }),
        ...(caregiver.nightAmount !== undefined && { nightAmount: caregiver.nightAmount }),
        ...(caregiver.additionalAmount !== undefined && {
          additionalAmount: caregiver.additionalAmount,
        }),
        ...(normalizeEmail(caregiver.email) && { email: normalizeEmail(caregiver.email) }),
        createdAt: now,
        updatedAt: now,
      };
      const firestoreCaregiver = encryptFields(
        { ...plainCaregiver },
        SECURE_FIELDS.caregivers,
        scope.key,
        caregiverDoc.path,
      ) as unknown as FirestoreCaregiver;

      // Record and link are written together, so her access always matches her record.
      // The link gets the plain name and email, which the caregiver must be able to read.
      const linkWrite = await this.caregiverLinkWrite(scope, plainCaregiver);
      const batch = writeBatch(db);
      batch.set(caregiverDoc, firestoreCaregiver);
      linkWrite.write(linkWriteBatchTarget(batch));
      this.assertCurrent(scope);
      await batch.commit();

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
      if (updates.additionalAmount !== undefined) {
        this.validateAdditionalAmount(updates.additionalAmount);
        updateData.additionalAmount = updates.additionalAmount;
      }
      if (updates.disabled !== undefined) updateData.disabled = updates.disabled;
      if (updates.email !== undefined) updateData.email = normalizeEmail(updates.email);

      const scope = this.requireScope();
      const db = getFirestore();
      const caregiverDoc = doc(db, getCollections(scope.houseId).CAREGIVERS, caregiverId);
      const current = await getDoc(caregiverDoc);
      if (!current.exists()) throw new Error(`Caregiver ${caregiverId} not found`);
      const { caregiver: currentCaregiver, data: currentData } = this.toCaregiver(
        caregiverDoc.path,
        current.data(),
        scope.key,
      );
      // Placeholders of fields that couldn't be decrypted would overwrite the real
      // values, here or in her link
      if (currentCaregiver.locked) throw new LockedRecordError();

      // Record and link are written together: a removed or changed email can't keep
      // the previous account authorized if the link write fails. The link gets the
      // decrypted name, which the caregiver must be able to read.
      const shouldUpdateLink =
        updates.name !== undefined || updates.email !== undefined || updates.disabled !== undefined;
      const linkWrite = shouldUpdateLink
        ? await this.caregiverLinkWrite(scope, {
            ...(currentData as unknown as FirestoreCaregiver),
            ...updateData,
            id: caregiverId,
          })
        : null;
      const encryptedUpdates = encryptFields(
        updateData,
        SECURE_FIELDS.caregivers,
        scope.key,
        caregiverDoc.path,
      );

      if (updates.additionalAmount === 0) {
        const scheduleCollection = collection(db, getCollections(scope.houseId).SCHEDULE);
        const marksQuery = query(
          collection(db, getCollections(scope.houseId).PAYMENTS),
          where("caregiverId", "==", caregiverId),
        );
        const [scheduleList, existingMarks] = await Promise.all([
          getDocs(scheduleCollection),
          getDocs(marksQuery),
        ]);
        const scheduleRefs = scheduleList.docs.map((record) => record.ref);
        const assignedAdditional = scheduleList.docs.flatMap((record) =>
          (["dayAdditional", "nightAdditional"] as const).flatMap((field, index) =>
            ((record.data()[field] ?? []) as string[]).includes(caregiverId)
              ? [{ dayKey: record.id, shift: (index === 0 ? "day" : "night") as "day" | "night" }]
              : [],
          ),
        );
        const assignedKeys = new Set(
          assignedAdditional.map(({ dayKey, shift }) => `${dayKey}:${shift}`),
        );
        const additionalMarkRefs = existingMarks.docs.flatMap((record) => {
          const parsed = parsePaymentKey(record.data().paymentKey);
          return parsed?.mode === "additional" &&
            assignedKeys.has(`${parsed.dayKey}:${parsed.shift}`)
            ? [record.ref]
            : [];
        });
        const canonicalMarkRefs = assignedAdditional.map(({ dayKey, shift }) =>
          this.paymentMarkRef(scope.houseId, caregiverId, dayKey, shift, "additional"),
        );
        const additionalPaymentRefs = [
          ...new Map(
            [...additionalMarkRefs, ...canonicalMarkRefs].map((ref) => [ref.path, ref]),
          ).values(),
        ];
        const observedCaregiverUpdatedAt = current.data()?.updatedAt;
        await runTransaction(db, async (transaction) => {
          const [currentSnapshot, ...readSnapshots] = await Promise.all([
            transaction.get(caregiverDoc),
            ...scheduleRefs.map((ref) => transaction.get(ref)),
            ...additionalPaymentRefs.map((ref) => transaction.get(ref)),
            ...(linkWrite ? [transaction.get(linkWrite.ref)] : []),
          ]);
          if (!currentSnapshot.exists()) throw new Error(`Caregiver ${caregiverId} not found`);
          if (currentSnapshot.data()?.updatedAt !== observedCaregiverUpdatedAt) {
            throw new Error(
              "Schedule changed while clearing the additional amount. Refresh and try again.",
            );
          }
          const current = this.toCaregiver(
            caregiverDoc.path,
            currentSnapshot.data()!,
            scope.key,
          ).caregiver;
          if (current.locked) throw new LockedRecordError();
          const currentSchedules = readSnapshots.slice(0, scheduleRefs.length);
          const paymentSnapshots = readSnapshots.slice(
            scheduleRefs.length,
            scheduleRefs.length + additionalPaymentRefs.length,
          );
          const linkSnapshot = linkWrite
            ? readSnapshots[scheduleRefs.length + additionalPaymentRefs.length]
            : undefined;
          const paidAdditional = new Set<string>();
          paymentSnapshots.forEach((snapshot) => {
            if (!snapshot.exists()) return;
            const parsed = parsePaymentKey(snapshot.data()?.paymentKey);
            if (parsed?.mode === "additional") {
              paidAdditional.add(`${parsed.dayKey}:${parsed.shift}`);
            }
          });
          const hasPending = currentSchedules.some((snapshot, index) => {
            const data = snapshot.data() ?? {};
            const date = scheduleList.docs[index].id;
            return (["dayAdditional", "nightAdditional"] as const).some((field, shiftIndex) => {
              const shift = shiftIndex === 0 ? "day" : "night";
              return (
                ((data[field] ?? []) as string[]).includes(caregiverId) &&
                !paidAdditional.has(`${date}:${shift}`)
              );
            });
          });
          if (hasPending) {
            throw new Error(
              "Remove or pay pending additional shifts before clearing the additional amount",
            );
          }
          this.assertCurrent(scope);
          transaction.update(caregiverDoc, encryptedUpdates);
          linkWrite?.write(linkWriteTransactionTarget(transaction), linkSnapshot);
        });
      } else {
        const batch = writeBatch(db);
        batch.update(caregiverDoc, encryptedUpdates);
        linkWrite?.write(linkWriteBatchTarget(batch));
        this.assertCurrent(scope);
        await batch.commit();
      }

      logger.log("Caregiver updated in Firestore:", caregiverId);
    } catch (error) {
      console.error("Error updating caregiver in Firestore:", error);
      CrashlyticsService.logError(error as Error, "Update caregiver error");
      throw error;
    }
  }

  // ===== SCHEDULE =====

  // Disabling a record never replaces encrypted fields with display placeholders.
  static async disableCaregiver(caregiverId: string): Promise<void> {
    const scope = this.requireScope();
    const db = getFirestore();
    const caregiverRef = doc(db, getCollections(scope.houseId).CAREGIVERS, caregiverId);
    const linkRef = doc(
      db,
      getHouseCollections().CAREGIVER_LINKS,
      caregiverLinkId(scope.houseId, caregiverId),
    );
    const link = await getDoc(linkRef);
    const batch = writeBatch(db);
    batch.update(caregiverRef, { disabled: true, updatedAt: new Date().toISOString() });
    if (link.exists()) batch.update(linkRef, { disabled: true, pay: null });
    this.assertCurrent(scope);
    await batch.commit();
  }

  // Subscribe to schedule collection with real-time updates
  static subscribeToSchedule(
    onUpdate: (schedule: ScheduleSnapshot) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const db = getFirestore();
    const scheduleRef = collection(db, getCollections(this.requireScope().houseId).SCHEDULE);

    const unsubscribe = onSnapshot(
      scheduleRef,
      (querySnapshot) => {
        try {
          const schedule = this.parseScheduleSnapshot(querySnapshot.docs);
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

  private static parseScheduleSnapshot(docs: QueryDocumentSnapshot[]): ScheduleSnapshot {
    const schedule: ScheduleSnapshot = {};
    docs.forEach((doc) => {
      const data = doc.data();
      schedule[doc.id] = {
        day: data.day || [],
        night: data.night || [],
        dayExtra: data.dayExtra || [],
        nightExtra: data.nightExtra || [],
        dayAdditional: data.dayAdditional || [],
        nightAdditional: data.nightAdditional || [],
      };
    });
    return schedule;
  }

  // Apply one assignment to the latest day, not a render-time copy of all its lists.
  // Concurrent manager edits retry instead of replacing one another's caregivers.
  static async updateDaySchedule(
    dateKey: string,
    caregiverId: string,
    shift: "day" | "night",
    extra: boolean,
    assigned: boolean,
  ): Promise<void> {
    try {
      const scope = this.requireScope();
      const db = getFirestore();
      const scheduleDoc = doc(db, getCollections(scope.houseId).SCHEDULE, dateKey);
      const linkDoc = doc(
        db,
        getHouseCollections().CAREGIVER_LINKS,
        caregiverLinkId(scope.houseId, caregiverId),
      );
      const marksQuery = query(
        collection(db, getCollections(scope.houseId).PAYMENTS),
        where("caregiverId", "==", caregiverId),
      );
      const existingMarks = await getDocs(marksQuery);
      const legacyPaid = new Set(
        existingMarks.docs.flatMap((record) => {
          const parsed = parsePaymentKey(record.data().paymentKey);
          return parsed?.dayKey === dateKey && parsed.shift === shift ? [parsed.mode] : [];
        }),
      );
      const additionalMarkRef = this.paymentMarkRef(
        scope.houseId,
        caregiverId,
        dateKey,
        shift,
        "additional",
      );
      const extraMarkRef = this.paymentMarkRef(
        scope.houseId,
        caregiverId,
        dateKey,
        shift,
        "daily-extra",
      );
      await runTransaction(db, async (transaction) => {
        const [snapshot, link, additionalMark, extraMark] = await Promise.all([
          transaction.get(scheduleDoc),
          transaction.get(linkDoc),
          transaction.get(additionalMarkRef),
          transaction.get(extraMarkRef),
        ]);
        const previous = snapshot.data() ?? {};
        const day = {
          day: [...(previous.day ?? [])] as string[],
          night: [...(previous.night ?? [])] as string[],
          dayExtra: [...(previous.dayExtra ?? [])] as string[],
          nightExtra: [...(previous.nightExtra ?? [])] as string[],
          dayAdditional: [...(previous.dayAdditional ?? [])] as string[],
          nightAdditional: [...(previous.nightAdditional ?? [])] as string[],
        };
        const extraList = shift === "day" ? "dayExtra" : "nightExtra";
        const additionalList = shift === "day" ? "dayAdditional" : "nightAdditional";
        const target = extra ? extraList : shift;
        const other = extra ? shift : extraList;
        const isPaid = (mode: "additional" | "daily-extra") =>
          legacyPaid.has(mode) ||
          (mode === "additional" ? additionalMark.exists() : extraMark.exists());

        if (
          !assigned &&
          !extra &&
          day[additionalList].includes(caregiverId) &&
          isPaid("additional")
        ) {
          throw new Error(
            "This additional payment was already paid. Reverse it from payment history first.",
          );
        }
        if (assigned && !extra && day[extraList].includes(caregiverId) && isPaid("daily-extra")) {
          throw new Error(
            "This legacy extra payment was already paid. Reverse it from payment history first.",
          );
        }
        if (extra && !assigned && isPaid("daily-extra")) {
          throw new Error(
            "This legacy extra payment was already paid. Reverse it from payment history first.",
          );
        }

        day[target] = day[target].filter((id) => id !== caregiverId);
        if (!assigned && !extra)
          day[additionalList] = day[additionalList].filter((id) => id !== caregiverId);
        if (assigned) {
          day[target].push(caregiverId);
          day[other] = day[other].filter((id) => id !== caregiverId);
        }
        this.assertCurrent(scope);
        transaction.set(scheduleDoc, { ...previous, ...day, updatedAt: new Date().toISOString() });
        if (link.exists()) {
          const priorShifts = (link.data()!.shifts ?? []) as string[];
          const keys = new Set([
            ...priorShifts.filter(
              (key) => key !== shiftKey(dateKey, "day") && key !== shiftKey(dateKey, "night"),
            ),
            ...dayShiftKeys(caregiverId, dateKey, day),
          ]);
          transaction.update(linkDoc, { shifts: [...keys] });
        }
      });
      logger.log("Day assignment saved:", dateKey, caregiverId, shift);
    } catch (error) {
      console.error("Error updating day schedule in Firestore:", error);
      CrashlyticsService.logError(error as Error, "Update day schedule error");
      throw error;
    }
  }

  // Add-ons are independent flags on top of a regular shift, not legacy extra shifts.
  static async updateShiftAdditional(
    dateKey: string,
    caregiverId: string,
    shift: "day" | "night",
    assigned: boolean,
  ): Promise<void> {
    const scope = this.requireScope();
    const db = getFirestore();
    const collections = getCollections(scope.houseId);
    const scheduleDoc = doc(db, collections.SCHEDULE, dateKey);
    const caregiverDoc = doc(db, collections.CAREGIVERS, caregiverId);
    const linkDoc = doc(
      db,
      getHouseCollections().CAREGIVER_LINKS,
      caregiverLinkId(scope.houseId, caregiverId),
    );
    const marksQuery = query(
      collection(db, collections.PAYMENTS),
      where("caregiverId", "==", caregiverId),
    );
    const existingMarks = await getDocs(marksQuery);
    const legacyPaid = existingMarks.docs.some((record) => {
      const parsed = parsePaymentKey(record.data().paymentKey);
      return parsed?.dayKey === dateKey && parsed.shift === shift && parsed.mode === "additional";
    });
    const additionalMarkRef = this.paymentMarkRef(
      scope.houseId,
      caregiverId,
      dateKey,
      shift,
      "additional",
    );

    await runTransaction(db, async (transaction) => {
      const [caregiverSnapshot, scheduleSnapshot, linkSnapshot, additionalMark] = await Promise.all(
        [
          transaction.get(caregiverDoc),
          transaction.get(scheduleDoc),
          transaction.get(linkDoc),
          transaction.get(additionalMarkRef),
        ],
      );
      if (!caregiverSnapshot.exists()) throw new Error("Caregiver no longer exists in this house");
      const caregiver = this.toCaregiver(
        caregiverDoc.path,
        caregiverSnapshot.data()!,
        scope.key,
      ).caregiver;
      if (caregiver.locked) throw new LockedRecordError();
      if (
        caregiver.disabled ||
        !Number.isFinite(caregiver.additionalAmount) ||
        caregiver.additionalAmount! <= 0
      ) {
        throw new Error("Caregiver is disabled or has no additional amount configured");
      }

      const previous = scheduleSnapshot.data() ?? {};
      const baseList = (previous[shift] ?? []) as string[];
      if (assigned && !baseList.includes(caregiverId)) {
        throw new Error("A regular shift is required before adding an additional payment");
      }
      const listName = shift === "day" ? "dayAdditional" : "nightAdditional";
      const list = [...((previous[listName] ?? []) as string[])];
      const wasAssigned = list.includes(caregiverId);
      const isPaid = legacyPaid || additionalMark.exists();
      if (!assigned && wasAssigned && isPaid) {
        throw new Error(
          "This additional payment was already paid. Reverse it from payment history first.",
        );
      }
      if (assigned === wasAssigned) return;

      const next = assigned ? [...list, caregiverId] : list.filter((id) => id !== caregiverId);
      const updatedAt = new Date().toISOString();
      this.assertCurrent(scope);
      transaction.update(caregiverDoc, { updatedAt });
      transaction.set(scheduleDoc, {
        ...previous,
        [listName]: next,
        updatedAt,
      });
      if (linkSnapshot.exists()) {
        const priorShifts = (linkSnapshot.data()!.shifts ?? []) as string[];
        const keys = new Set([
          ...priorShifts.filter(
            (key) => key !== shiftKey(dateKey, "day") && key !== shiftKey(dateKey, "night"),
          ),
          ...dayShiftKeys(caregiverId, dateKey, {
            day: (shift === "day" ? baseList : (previous.day ?? [])) as string[],
            night: (shift === "night" ? baseList : (previous.night ?? [])) as string[],
            dayExtra: (previous.dayExtra ?? []) as string[],
            nightExtra: (previous.nightExtra ?? []) as string[],
          }),
        ]);
        transaction.update(linkDoc, { shifts: [...keys] });
      }
    });
  }

  // ===== CAREGIVER LINKS =====
  // A caregiver with an email gets a global link document, so she can find the
  // houses she works at and read their schedule from her own account.

  // Batch write that creates, updates or removes the link of a caregiver of the
  // current house to match her record
  private static async caregiverLinkWrite(
    { houseId, houseName }: HouseScope,
    caregiver: FirestoreCaregiver,
  ): Promise<CaregiverLinkWriter> {
    const db = getFirestore();
    const linkDoc = doc(
      db,
      getHouseCollections().CAREGIVER_LINKS,
      caregiverLinkId(houseId, caregiver.id),
    );
    const email = normalizeEmail(caregiver.email);
    const existing = await getDoc(linkDoc);
    const schedule = email ? await getDocs(collection(db, getCollections(houseId).SCHEDULE)) : null;

    const link = email
      ? {
          houseId,
          houseName,
          caregiverId: caregiver.id,
          caregiverName: caregiver.name,
          email,
          disabled: caregiver.disabled ?? false,
          updatedAt: new Date().toISOString(),
        }
      : null;
    const newLink: FirestoreCaregiverLink | null = link
      ? {
          ...link,
          status: "pending",
          shifts: scheduleShiftKeys(caregiver.id, this.parseScheduleSnapshot(schedule!.docs)),
        }
      : null;

    return {
      ref: linkDoc,
      write: (writer, current = existing) => {
        if (!email || !link || !newLink) {
          if (current.exists()) {
            writer.delete(linkDoc);
            writer.delete(CaregiverPayService.keyRef(linkDoc.id));
          }
          return;
        }

        // Same email: keep the caregiver's answer and shifts. A new email or
        // missing link is a new invitation, initialized from the schedule snapshot,
        // with a new pay key so the previous email can't read the next pay.
        if ((current.data() as FirestoreCaregiverLink | undefined)?.email === email) {
          writer.update(linkDoc, link);
        } else {
          writer.set(linkDoc, newLink);
          writer.delete(CaregiverPayService.keyRef(linkDoc.id));
        }
      },
    };
  }

  // The caregiver accepts or declines working at a house. Accepting also records her
  // access to the house schedule, which security rules check against the link.
  static async respondToCaregiverLink(
    linkId: string,
    status: Exclude<CaregiverLinkStatus, "pending">,
    userId: string,
  ): Promise<void> {
    const db = getFirestore();
    const linkDoc = doc(db, getHouseCollections().CAREGIVER_LINKS, linkId);
    const batch = writeBatch(db);
    batch.update(linkDoc, { status, respondedAt: new Date().toISOString() });
    if (status === "accepted") {
      const link = (await getDoc(linkDoc)).data() as FirestoreCaregiverLink;
      batch.set(this.caregiverAccessRef(link.houseId, userId), {
        userId,
        houseId: link.houseId,
        linkId,
      });
    }
    await batch.commit();
  }

  private static caregiverAccessRef(houseId: string, userId: string) {
    return doc(
      getFirestore(),
      getHouseCollections().CAREGIVER_ACCESS,
      accessDocId(houseId, userId),
    );
  }

  // A manager invites a caregiver who declined again
  static async resendCaregiverInvitation(caregiverId: string): Promise<void> {
    const db = getFirestore();
    const { houseId } = this.requireScope();
    await updateDoc(
      doc(db, getHouseCollections().CAREGIVER_LINKS, caregiverLinkId(houseId, caregiverId)),
      {
        status: "pending",
        updatedAt: new Date().toISOString(),
      },
    );
  }

  // Links of the caregivers of a house, so its managers see who accepted
  static subscribeToHouseCaregiverLinks(
    houseId: string,
    onUpdate: (links: CaregiverLink[]) => void,
  ): () => void {
    const db = getFirestore();
    const q = query(
      collection(db, getHouseCollections().CAREGIVER_LINKS),
      where("houseId", "==", houseId),
    );
    return onSnapshot(
      q,
      (snapshot) =>
        onUpdate(
          snapshot.docs.map((linkDoc: QueryDocumentSnapshot) => ({
            ...(linkDoc.data() as FirestoreCaregiverLink),
            id: linkDoc.id,
          })),
        ),
      (error) => console.error("Error in house caregiver links listener:", error),
    );
  }

  // Links of the logged in caregiver, across every house that registered her email
  static subscribeToCaregiverLinks(
    email: string,
    onUpdate: (links: CaregiverLink[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const db = getFirestore();
    const q = query(
      collection(db, getHouseCollections().CAREGIVER_LINKS),
      where("email", "==", normalizeEmail(email)),
    );

    // Not registered in unsubscribeFunctions: it outlives house selection changes
    return onSnapshot(
      q,
      (querySnapshot) => {
        const links = querySnapshot.docs.map((linkDoc: QueryDocumentSnapshot) => ({
          ...(linkDoc.data() as FirestoreCaregiverLink),
          id: linkDoc.id,
        }));
        onUpdate(links);
      },
      (error) => {
        console.error("Error in caregiver links listener:", error);
        CrashlyticsService.logError(error, "Caregiver links listener error");
        onError?.(error);
      },
    );
  }

  // Schedule of any house, for a caregiver that is not one of its managers. Links
  // accepted before access records existed get theirs first.
  static subscribeToHouseSchedule(
    houseId: string,
    access: { userId: string; linkId: string },
    onUpdate: (schedule: ScheduleSnapshot) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const db = getFirestore();
    let unsubscribe = () => {};
    let cancelled = false;

    setDoc(this.caregiverAccessRef(houseId, access.userId), { ...access, houseId })
      .then(() => {
        if (cancelled) return;
        unsubscribe = onSnapshot(
          collection(db, getCollections(houseId).SCHEDULE),
          (querySnapshot) => onUpdate(this.parseScheduleSnapshot(querySnapshot.docs)),
          (error) => {
            console.error("Error in house schedule listener:", houseId, error);
            onError?.(error);
          },
        );
      })
      .catch((error) => {
        logger.warn("Could not record caregiver access:", error);
        if (!cancelled) onError?.(error);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  private static async getCaregiverLinksOfHouse(houseId: string) {
    const db = getFirestore();
    const linksQuery = query(
      collection(db, getHouseCollections().CAREGIVER_LINKS),
      where("houseId", "==", houseId),
    );
    return (await getDocs(linksQuery)).docs;
  }

  // ===== PAYMENTS =====

  // Subscribe to payments collection with real-time updates
  static subscribeToPayments(
    onUpdate: (payments: PaymentsByCaregiver) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const db = getFirestore();
    const paymentsRef = collection(db, getCollections(this.requireScope().houseId).PAYMENTS);

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

  private static paymentMarkRef(
    houseId: string,
    caregiverId: string,
    dayKey: string,
    shift: "day" | "night",
    mode: "regular" | "daily-extra" | "additional",
  ) {
    const identity = paidShiftKey(dayKey, shift, mode);
    return doc(
      getFirestore(),
      getCollections(houseId).PAYMENTS,
      this.sanitizeDocId(`${caregiverId}__${identity}`),
    );
  }

  private static chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Marks the given shifts as paid and records the history entry, if any, in one
  // batch: a failure can't leave shifts paid without a record, or the other way round
  static async recordPayment(
    caregiverId: string,
    frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário",
    paymentKeys: string[],
    history: Omit<PaymentHistory, "id"> | null,
    expectedRates?: { dayRate: number; nightRate: number; additionalRate: number },
  ): Promise<void> {
    try {
      const scope = this.requireScope();
      const db = getFirestore();
      const collections = getCollections(scope.houseId);
      const now = new Date().toISOString();
      if (paymentKeys.length + 1 > BATCH_LIMIT) {
        throw new Error("Too many shifts to record in a single payment");
      }

      const identity = (key: string) => {
        const parsed = parsePaymentKey(key);
        return parsed ? paidShiftKey(parsed.dayKey, parsed.shift, parsed.mode) : key;
      };
      // Existing legacy markers used period-based IDs. Check them too; all new
      // markers use a frequency-independent identity for transactional races.
      const existingMarks = await getDocs(
        query(collection(db, collections.PAYMENTS), where("caregiverId", "==", caregiverId)),
      );
      const alreadyPaid = new Set(
        existingMarks.docs.map((record: QueryDocumentSnapshot) =>
          identity(record.data().paymentKey),
        ),
      );
      if (paymentKeys.some((key) => alreadyPaid.has(identity(key))))
        throw new Error("Some shifts were already paid. Refresh before recording this payment.");

      const marks = paymentKeys.map((paymentKey) => {
        const paymentId = this.sanitizeDocId(`${caregiverId}__${identity(paymentKey)}`);
        return { ref: doc(db, collections.PAYMENTS, paymentId), paymentKey };
      });
      await runTransaction(db, async (transaction) => {
        const currentCaregiver = await transaction.get(
          doc(db, collections.CAREGIVERS, caregiverId),
        );
        if (!currentCaregiver.exists()) throw new Error("Caregiver no longer exists in this house");
        const current = this.toCaregiver(
          currentCaregiver.ref.path,
          currentCaregiver.data()!,
          scope.key,
        ).caregiver;
        if (current.locked) throw new LockedRecordError();
        const parsedKeys = paymentKeys
          .map((paymentKey) => ({ paymentKey, parsed: parsePaymentKey(paymentKey) }))
          .filter(
            (
              entry,
            ): entry is {
              paymentKey: string;
              parsed: NonNullable<ReturnType<typeof parsePaymentKey>>;
            } => entry.parsed !== null,
          );
        const scheduleRefs = new Map(
          parsedKeys.map(({ parsed }) => [
            parsed.dayKey,
            doc(db, collections.SCHEDULE, parsed.dayKey),
          ]),
        );
        const [previous, schedules] = await Promise.all([
          Promise.all(marks.map((mark) => transaction.get(mark.ref))),
          Promise.all([...scheduleRefs.values()].map((ref) => transaction.get(ref))),
        ]);
        const scheduleByDay = new Map(
          [...scheduleRefs.keys()].map((dayKey, index) => [dayKey, schedules[index].data() ?? {}]),
        );
        for (const { parsed } of parsedKeys) {
          const schedule = scheduleByDay.get(parsed.dayKey)!;
          const shiftList = (field: string) => (schedule[field] ?? []) as string[];
          const regularAssigned = shiftList(parsed.shift).includes(caregiverId);
          if (parsed.mode === "additional") {
            const additionalField = parsed.shift === "day" ? "dayAdditional" : "nightAdditional";
            if (
              !regularAssigned ||
              !shiftList(additionalField).includes(caregiverId) ||
              !Number.isFinite(current.additionalAmount) ||
              current.additionalAmount! <= 0
            ) {
              throw new Error("Schedule or rates changed. Refresh before recording this payment.");
            }
          } else if (expectedRates) {
            const field =
              parsed.mode === "daily-extra"
                ? parsed.shift === "day"
                  ? "dayExtra"
                  : "nightExtra"
                : parsed.shift;
            if (!shiftList(field).includes(caregiverId)) {
              throw new Error("Schedule or rates changed. Refresh before recording this payment.");
            }
          }
          if (expectedRates) {
            const currentRate =
              parsed.mode === "additional"
                ? current.additionalAmount
                : parsed.shift === "day"
                  ? (current.dayAmount ?? current.amount)
                  : (current.nightAmount ?? current.amount);
            const expectedRate =
              parsed.mode === "additional"
                ? expectedRates.additionalRate
                : parsed.shift === "day"
                  ? expectedRates.dayRate
                  : expectedRates.nightRate;
            if (moneyInCents(currentRate ?? 0) !== moneyInCents(expectedRate)) {
              throw new Error("Schedule or rates changed. Refresh before recording this payment.");
            }
          }
        }
        if (previous.some((snapshot) => snapshot.exists())) {
          throw new Error("Some shifts were already paid. Refresh before recording this payment.");
        }
        if (history?.historyKey) {
          const previousHistory = await transaction.get(
            doc(db, collections.PAYMENT_HISTORY, this.sanitizeDocId(history.historyKey)),
          );
          if (previousHistory.exists()) throw new Error("This payment was already recorded.");
        }
        this.assertCurrent(scope);
        for (const mark of marks) {
          transaction.set(mark.ref, {
            caregiverId,
            frequency,
            paymentKey: mark.paymentKey,
            createdAt: now,
            updatedAt: now,
          });
        }
        if (history)
          this.addPaymentHistory(
            (ref, data) => {
              transaction.set(ref, data);
            },
            scope,
            history,
            now,
          );
      });
      logger.log("Payment recorded:", caregiverId, paymentKeys.length, "shifts");
    } catch (error) {
      console.error("Error recording payment in Firestore:", error);
      CrashlyticsService.logError(error as Error, "Record payment error");
      throw error;
    }
  }

  // Deletes a history entry together with its paid marks, only if reversal remains valid.
  static async deletePaymentRecord(
    paymentId: string,
    caregiverId: string,
    paymentKeys: string[],
  ): Promise<void> {
    try {
      const scope = this.requireScope();
      const db = getFirestore();
      const collections = getCollections(scope.houseId);
      const uniqueKeys = [...new Set(paymentKeys)];
      const parsedKeys = uniqueKeys
        .map((paymentKey) => ({ paymentKey, parsed: parsePaymentKey(paymentKey) }))
        .filter(
          (
            entry,
          ): entry is {
            paymentKey: string;
            parsed: NonNullable<ReturnType<typeof parsePaymentKey>>;
          } => entry.parsed !== null,
        );
      const queriedMarkRefs: DocumentReference[] = [];

      // Marks are found by key: older ones may have been stored under other ids.
      for (const keyChunk of this.chunkArray(uniqueKeys, 10)) {
        if (keyChunk.length === 0) continue;
        const snapshot = await getDocs(
          query(
            collection(db, collections.PAYMENTS),
            where("caregiverId", "==", caregiverId),
            where("paymentKey", "in", keyChunk),
          ),
        );
        snapshot.forEach((record: QueryDocumentSnapshot) => queriedMarkRefs.push(record.ref));
      }

      const markRefs = [
        ...new Map(
          [
            ...queriedMarkRefs,
            ...parsedKeys.map(({ parsed }) =>
              this.paymentMarkRef(
                scope.houseId,
                caregiverId,
                parsed.dayKey,
                parsed.shift,
                parsed.mode,
              ),
            ),
          ].map((ref) => [ref.path, ref]),
        ).values(),
      ];
      if (markRefs.length + 1 > BATCH_LIMIT) {
        throw new Error("Too many shifts to delete in a single payment");
      }

      const historyRef = doc(db, collections.PAYMENT_HISTORY, paymentId);
      const caregiverRef = doc(db, collections.CAREGIVERS, caregiverId);
      const scheduleRefs = new Map(
        parsedKeys.map(({ parsed }) => [
          parsed.dayKey,
          doc(db, collections.SCHEDULE, parsed.dayKey),
        ]),
      );
      await runTransaction(db, async (transaction) => {
        const [historySnapshot, caregiverSnapshot, ...readSnapshots] = await Promise.all([
          transaction.get(historyRef),
          transaction.get(caregiverRef),
          ...[...scheduleRefs.values()].map((ref) => transaction.get(ref)),
          ...markRefs.map((ref) => transaction.get(ref)),
        ]);
        if (
          historySnapshot.exists() &&
          historySnapshot.data()?.caregiverId !== undefined &&
          historySnapshot.data()?.caregiverId !== caregiverId
        ) {
          throw new Error("Payment record does not belong to this caregiver");
        }
        const scheduleSnapshots = readSnapshots.slice(0, scheduleRefs.size);
        const markSnapshots = readSnapshots.slice(scheduleRefs.size);
        const scheduleByDay = new Map(
          [...scheduleRefs.keys()].map((dayKey, index) => [
            dayKey,
            scheduleSnapshots[index].data() ?? {},
          ]),
        );
        const hasActiveAdditional = parsedKeys.some(({ parsed }) => {
          if (parsed.mode !== "additional") return false;
          const field = parsed.shift === "day" ? "dayAdditional" : "nightAdditional";
          return ((scheduleByDay.get(parsed.dayKey)?.[field] ?? []) as string[]).includes(
            caregiverId,
          );
        });
        if (hasActiveAdditional) {
          if (!caregiverSnapshot.exists()) {
            throw new Error("Configure a positive additional amount before reversing this payment");
          }
          const current = this.toCaregiver(
            caregiverRef.path,
            caregiverSnapshot.data()!,
            scope.key,
          ).caregiver;
          if (current.locked) throw new LockedRecordError();
          if (!Number.isFinite(current.additionalAmount) || current.additionalAmount! <= 0) {
            throw new Error("Configure a positive additional amount before reversing this payment");
          }
        }

        this.assertCurrent(scope);
        transaction.delete(historyRef);
        markSnapshots.forEach((snapshot, index) => {
          const mark = snapshot.data();
          if (
            snapshot.exists() &&
            mark?.caregiverId === caregiverId &&
            uniqueKeys.includes(mark.paymentKey)
          ) {
            transaction.delete(markRefs[index]);
          }
        });
      });
      logger.log(`Deleted payment ${paymentId} and ${markRefs.length} paid shifts`);
    } catch (error) {
      console.error("Error deleting payment from Firestore:", error);
      CrashlyticsService.logError(error as Error, "Delete payment error");
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
    const { houseId, key } = this.requireScope();
    const paymentHistoryRef = collection(db, getCollections(houseId).PAYMENT_HISTORY);
    const q = query(paymentHistoryRef, orderBy("paidAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          const history: PaymentHistory[] = [];
          querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
            const docPath = `${paymentHistoryRef.path}/${doc.id}`;
            const { paymentHistory, hasPlaintext } = this.toPaymentHistory(
              docPath,
              doc.data(),
              key,
            );
            if (hasPlaintext) {
              this.encryptLegacyRecord(docPath, SECURE_FIELDS.paymentHistory, key);
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

  // Adds a payment history entry to a batch
  private static addPaymentHistory(
    write: (ref: DocumentReference, data: FirestorePaymentHistory) => void,
    scope: HouseScope,
    payment: Omit<PaymentHistory, "id">,
    now: string,
  ): void {
    const db = getFirestore();
    const historyRef = collection(db, getCollections(scope.houseId).PAYMENT_HISTORY);
    const paymentId = payment.historyKey
      ? this.sanitizeDocId(payment.historyKey)
      : doc(historyRef).id;
    const paymentDoc = doc(historyRef, paymentId);

    const firestorePayment = encryptFields(
      {
        id: paymentId,
        caregiverId: payment.caregiverId,
        caregiverName: payment.caregiverName,
        date: payment.date,
        frequency: payment.frequency as "Semanal" | "Quinzenal" | "Mensal" | "Diário",
        description: payment.description,
        amount: payment.amount,
        dayRate: payment.dayRate,
        nightRate: payment.nightRate,
        additionalRate: payment.additionalRate,
        paidAt: payment.paidAt,
        createdAt: now,
        managerName: payment.managerName,
        periodKey: payment.periodKey,
        paymentKeys: payment.paymentKeys,
        historyKey: payment.historyKey,
      },
      SECURE_FIELDS.paymentHistory,
      scope.key,
      paymentDoc.path,
    ) as unknown as FirestorePaymentHistory;

    write(paymentDoc, firestorePayment);
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
  ): Promise<HouseAccessIssue[]> {
    const issues: HouseAccessIssue[] = [];
    const groups = new Map<string, QueryDocumentSnapshot[]>();
    for (const record of records) {
      const data = record.data() as FirestoreUserHouseAccess;
      if (
        data.userId !== userId ||
        typeof data.houseId !== "string" ||
        !data.houseId ||
        data.houseId.includes("/")
      ) {
        issues.push({
          houseId: typeof data.houseId === "string" ? data.houseId : "",
          reason: "invalid-access",
        });
        continue;
      }
      groups.set(data.houseId, [...(groups.get(data.houseId) ?? []), record]);
    }

    // An orphaned/ambiguous house must not roll back valid houses' grants. Keep
    // failed records intact for repair, and report partial availability to callers.
    for (const [houseId, group] of groups) {
      const roles = new Set(group.map((record) => record.data().role));
      if ([...roles].some((role) => !["owner", "manager"].includes(role))) {
        issues.push({ houseId, reason: "invalid-access" });
        continue;
      }
      if (roles.size !== 1) {
        issues.push({ houseId, reason: "conflicting-access" });
        continue;
      }
      const id = accessDocId(houseId, userId);
      const legacy = group.filter((record) => record.id !== id);
      if (!legacy.length) continue;
      let canonicalExists = group.some((record) => record.id === id);
      try {
        for (const chunk of this.chunkArray(legacy, Math.floor(BATCH_LIMIT / 2))) {
          const batch = writeBatch(getFirestore());
          for (const record of chunk) {
            const data = record.data() as FirestoreUserHouseAccess;
            if (!canonicalExists) {
              batch.set(this.accessRef(houseId, userId), {
                userId,
                houseId,
                role: data.role,
                ...(data.addedAt !== undefined && { addedAt: data.addedAt }),
                legacyAccessId: record.id,
              });
              canonicalExists = true;
            }
            batch.delete(record.ref);
          }
          await batch.commit();
        }
      } catch (error) {
        issues.push({ houseId, reason: "migration-failed" });
        logger.warn("Legacy house access requires repair:", houseId);
        CrashlyticsService.logError(error as Error, "Migrate legacy house access");
      }
    }
    return issues;
  }

  private static async getAccessState(userId: string) {
    const db = getFirestore();
    const accessRef = collection(db, getHouseCollections().USER_HOUSE_ACCESS);
    const snapshot = await getDocs(query(accessRef, where("userId", "==", userId)));
    const issues = await this.migrateLegacyAccess(userId, snapshot.docs);
    const blocked = new Set(issues.map((issue) => issue.houseId));
    const accessRecords = snapshot.docs
      .map((record: QueryDocumentSnapshot) => record.data() as FirestoreUserHouseAccess)
      .filter(
        (record: FirestoreUserHouseAccess) =>
          !blocked.has(record.houseId) &&
          typeof record.houseId === "string" &&
          !!record.houseId &&
          !record.houseId.includes("/") &&
          record.userId === userId &&
          ["owner", "manager"].includes(record.role),
      );
    return { accessRecords, issues };
  }

  static async getUserHouses(userId: string): Promise<House[]> {
    return (await this.getUserHouseState(userId)).houses;
  }

  static async getUserHouseState(userId: string): Promise<{
    houses: House[];
    accessRecords: FirestoreUserHouseAccess[];
    issues: HouseAccessIssue[];
  }> {
    try {
      const db = getFirestore();
      const { accessRecords, issues } = await this.getAccessState(userId);
      const houseIds = [...new Set(accessRecords.map((record) => record.houseId))];
      const snapshots = await Promise.allSettled(
        houseIds.map((houseId) => getDoc(doc(db, getHouseCollections().HOUSES, houseId))),
      );
      const houses: House[] = [];
      snapshots.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.exists()) {
          houses.push({ ...result.value.data(), id: result.value.id } as House);
        } else if (result.status === "fulfilled") {
          issues.push({ houseId: houseIds[index], reason: "missing-house" });
        } else {
          issues.push({ houseId: houseIds[index], reason: "unavailable-house" });
        }
      });
      return { houses, accessRecords, issues };
    } catch (error) {
      console.error("Error getting user houses:", error);
      CrashlyticsService.logError(error as Error, "Get user houses");
      throw error;
    }
  }

  // Update house
  static async updateHouse(
    houseId: string,
    updates: Partial<Pick<House, "name" | "description">>,
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();
      const houseDoc = doc(db, houseCollections.HOUSES, houseId);

      // Filter out undefined values to prevent Firestore errors
      const filteredUpdates = {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
      };

      const links = updates.name !== undefined ? await this.getCaregiverLinksOfHouse(houseId) : [];
      if (links.length + 1 > BATCH_LIMIT)
        throw new Error("Too many caregiver links to rename atomically.");
      const batch = writeBatch(db);
      batch.update(houseDoc, {
        ...filteredUpdates,
        updatedAt: new Date().toISOString(),
      });

      if (updates.name !== undefined) {
        links.forEach((link: QueryDocumentSnapshot) =>
          batch.update(link.ref, { houseName: updates.name }),
        );
      }
      await batch.commit();
      if (updates.name !== undefined) {
        // Same house and generation, so writes already under way stay valid
        if (houseId === this.scope?.houseId) {
          this.scope = Object.freeze({ ...this.scope, houseName: updates.name });
        }
      }

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
  // also makes encrypted copies kept without it (e.g. device caches) unreadable.
  static async deleteHouse(houseId: string, ownerId: string): Promise<void> {
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

      // Caregivers of a deleted house lose access to it
      const links = await this.getCaregiverLinksOfHouse(houseId);
      await this.deleteDocuments(
        links.flatMap((link: QueryDocumentSnapshot) => [
          link.ref,
          CaregiverPayService.keyRef(link.id),
        ]),
      );

      // Other managers' access goes in bounded batches; the owner's record is kept
      // until the end, as it is what authorizes all of these deletions
      const ownAccessId = accessDocId(houseId, ownerId);
      const access = await getDocs(
        query(collection(db, houseCollections.USER_HOUSE_ACCESS), where("houseId", "==", houseId)),
      );
      const ownAccess = access.docs.filter(
        (record: QueryDocumentSnapshot) => record.id === ownAccessId,
      );
      await this.deleteDocuments(
        access.docs
          .filter((record: QueryDocumentSnapshot) => record.id !== ownAccessId)
          .map((record: QueryDocumentSnapshot) => record.ref),
      );

      // Rules are checked against the state before the batch, so the owner can remove
      // the key, the house and their own access record at once
      const batch = writeBatch(db);
      batch.delete(HouseKeyService.keyRef(houseId));
      batch.delete(noteKeyRef(houseId));
      batch.delete(noteKeyRef(houseId, true));
      batch.delete(doc(db, houseCollections.HOUSES, houseId));
      ownAccess.forEach((record: QueryDocumentSnapshot) => batch.delete(record.ref));
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
      // Legacy malformed lists must not strand account deletion. Authorization
      // comes from access records; only a well-formed single entry is removed here.
      if (houseData.managers.filter((m) => m?.userId === userId).length === 1) {
        batch.update(houseDoc, {
          managers: houseData.managers.filter((m) => m?.userId !== userId),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    access.docs.forEach((record: QueryDocumentSnapshot) => batch.delete(record.ref));
    await batch.commit();
  }

  // Delete user account and all associated data
  static async deleteUserAccount(
    userId: string,
    email: string | null,
    emailVerified = false,
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      logger.log("Starting account deletion");

      const { accessRecords, issues } = await this.getUserHouseState(userId);
      // Unreachable owned data cannot be declared erased. Repair comes before any
      // destructive writes; ordinary use and explicitly partial export remain available.
      const blockingIssues = issues.filter(
        (issue) =>
          issue.reason !== "missing-house" ||
          !accessRecords.some(
            (access) => access.houseId === issue.houseId && access.role === "manager",
          ) ||
          accessRecords.some(
            (access) => access.houseId === issue.houseId && access.role === "owner",
          ),
      );
      if (blockingIssues.length) throw new HouseAccessRepairError(blockingIssues);
      const ownedHouses = new Set<string>();
      const managedHouses = new Set<string>();
      accessRecords.forEach((access) =>
        (access.role === "owner" ? ownedHouses : managedHouses).add(access.houseId),
      );

      // Reports are independent of houses and must be erased before the Auth identity.
      await deleteOwnReports(userId);
      await ShiftNotesService.deleteOwn(userId);

      // 1. Delete every house the user owns, with all of its data
      for (const houseId of ownedHouses) {
        await this.deleteHouse(houseId, userId);
      }

      // 2. Leave the houses managed with other people
      for (const houseId of managedHouses) {
        if (!ownedHouses.has(houseId)) await this.leaveHouse(houseId, userId);
      }

      // 3. Delete invitations sent and received by the user
      const invitationsRef = collection(db, houseCollections.HOUSE_INVITATIONS);
      const invitationQueries = [query(invitationsRef, where("invitedBy", "==", userId))];
      if (email && emailVerified) {
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

      // 4. Delete her access to schedules of houses where she works as a caregiver
      // Close accepted grants before deleting the identity, so a later account
      // registering the same verified address does not inherit those grants.
      if (email && emailVerified) {
        const links = await getDocs(
          query(
            collection(db, houseCollections.CAREGIVER_LINKS),
            where("email", "==", normalizeEmail(email)),
          ),
        );
        for (const chunk of this.chunkArray(links.docs, BATCH_LIMIT)) {
          const batch = writeBatch(db);
          chunk.forEach((link: QueryDocumentSnapshot) =>
            batch.update(link.ref, {
              status: "declined",
              respondedAt: new Date().toISOString(),
            }),
          );
          await batch.commit();
        }
      }
      const caregiverAccess = await getDocs(
        query(collection(db, houseCollections.CAREGIVER_ACCESS), where("userId", "==", userId)),
      );
      await this.deleteDocuments(
        caregiverAccess.docs.map((record: QueryDocumentSnapshot) => record.ref),
      );

      // 5. Delete the user profile (consent records included)
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

      // Expired invitations, and old ones the invitee can no longer accept, don't
      // block a new one; they are removed instead
      const existingInvitations = await getDocs(existingInvitationsQuery);
      const [expired, active] = [true, false].map((wantExpired) =>
        existingInvitations.docs.filter(
          (record: QueryDocumentSnapshot) =>
            (effectiveInvitationStatus(record.data() as FirestoreHouseInvitation) === "expired") ===
            wantExpired,
        ),
      );
      if (active.length > 0) {
        throw new Error(translate("errors.inviteAlreadySent"));
      }
      await this.deleteDocuments(expired.map((record: QueryDocumentSnapshot) => record.ref));

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

      // Security rules compare the expiry with the server time
      await setDoc(invitationDoc, { ...invitation, expiresAtTs: Timestamp.fromDate(expiresAt) });
      logger.log("House invitation sent for house:", houseId);
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

      // Query invitations by user email
      const invitationsQuery = query(
        collection(db, houseCollections.HOUSE_INVITATIONS),
        where("invitedEmail", "==", userEmail.toLowerCase()),
      );

      const invitationsSnapshot = await getDocs(invitationsQuery);
      const invitations: HouseInvitation[] = [];

      invitationsSnapshot.forEach((doc: any) => {
        const data = doc.data() as FirestoreHouseInvitation;
        const status = effectiveInvitationStatus(data);
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
      if (effectiveInvitationStatus(invitation) === "expired") {
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
    providers?: AuthProviderType[],
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
    updates: { providers: AuthProviderType[]; hasPassword: boolean; email?: string | null },
  ): Promise<void> {
    try {
      const db = getFirestore();
      const houseCollections = getHouseCollections();

      const userDoc = doc(db, houseCollections.USERS, userId);

      await updateDoc(userDoc, {
        providers: updates.providers,
        hasPassword: updates.hasPassword,
        ...(updates.email !== undefined ? { email: (updates.email ?? "").toLowerCase() } : {}),
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
  static async exportUserData(
    userId: string,
    email: string | null,
    emailVerified = false,
  ): Promise<DataExport> {
    const db = getFirestore();
    const houseCollections = getHouseCollections();
    const houses: HouseExportInput[] = [];

    const houseState = await this.getUserHouseState(userId);
    for (const house of houseState.houses) {
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
        shiftNotes: await ShiftNotesService.export(house.id, userId),
        payments: payments.docs.map((record: QueryDocumentSnapshot) => record.data()),
        paymentHistory: paymentHistory.docs.map(
          (record: QueryDocumentSnapshot) =>
            this.toPaymentHistory(record.ref.path, record.data(), key).data,
        ),
      });
    }

    const invitationsRef = collection(db, houseCollections.HOUSE_INVITATIONS);
    const sent = await getDocs(query(invitationsRef, where("invitedBy", "==", userId)));
    const received =
      email && emailVerified
        ? await getDocs(query(invitationsRef, where("invitedEmail", "==", email.toLowerCase())))
        : null;
    const caregiverLinks =
      email && emailVerified
        ? await getDocs(
            query(
              collection(db, houseCollections.CAREGIVER_LINKS),
              where("email", "==", normalizeEmail(email)),
            ),
          )
        : null;

    const links = (caregiverLinks?.docs ?? []).map(
      (record) => ({ ...record.data(), id: record.id }) as CaregiverLink,
    );
    // Exporting a disabled link's history must not replace an active house-access link.
    const accessLinks = new Map<string, CaregiverLink>();
    for (const link of links) {
      if (link.status === "accepted" && (!accessLinks.has(link.houseId) || !link.disabled))
        accessLinks.set(link.houseId, link);
    }
    for (const [houseId, link] of accessLinks) {
      await setDoc(this.caregiverAccessRef(houseId, userId), { userId, houseId, linkId: link.id });
    }

    const exportedLinks: Record<string, unknown>[] = [];
    for (const link of links) {
      if (link.status === "accepted") {
        const snapshot = await getDocs(collection(db, getCollections(link.houseId).SCHEDULE));
        const ownShifts = buildCaregiverShifts([link], {
          [link.houseId]: this.parseScheduleSnapshot(snapshot.docs),
        }).map(({ date, shift, extra, additional }) => ({
          date,
          shift,
          extra,
          ...(additional !== undefined && { additional }),
        }));
        // Her own pay, readable, instead of the stored ciphertext
        exportedLinks.push({
          ...link,
          pay: await CaregiverPayService.read(link.id, link.pay).catch(() => null),
          ownShifts,
        });
      } else {
        const { pay: _pay, ...rest } = link;
        exportedLinks.push(rest);
      }
    }

    return buildDataExport({
      profile: (await this.getUserProfile(userId)) as Record<string, unknown> | null,
      houses,
      houseAccessIssues: houseState.issues,
      invitationsSent: sent.docs.map((record: QueryDocumentSnapshot) => record.data()),
      invitationsReceived:
        received?.docs.map((record: QueryDocumentSnapshot) => record.data()) ?? [],
      caregiverLinks: exportedLinks,
      feedbackReports: await listOwnReports(userId),
      shiftNotes: await ShiftNotesService.exportOwn(userId),
    });
  }
}
