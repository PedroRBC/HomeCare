import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { dateKey, parseCalendarDate } from "@/utils/date";
import { logger } from "@/utils/logger";
import { AnalyticsService } from "@/services/firebase";
import { FirestoreService } from "@/services/firestore";
import { legacyPaymentKeys } from "@/utils/paymentHistory";
import {
  buildHistoryKey,
  describePeriod,
  paidShiftKey,
  toPaidShifts,
  type PaymentMode,
} from "@/utils/paymentDomain";
import {
  additionalAmount,
  additionalList,
  collectPaymentObligations,
  shiftAmount,
  sumAmounts,
} from "@/utils/paymentObligations";
import { useAuth } from "./AuthContext";
import { useHouse } from "./HouseContext";
import { t as translate } from "i18next";

export type Frequency = "Semanal" | "Quinzenal" | "Mensal" | "Diário";
export type ShiftType = "day" | "night";
export type Caregiver = {
  id: string;
  name: string;
  frequency: Frequency;
  amount: number;
  dayAmount?: number;
  nightAmount?: number;
  additionalAmount?: number;
  disabled?: boolean;
  email?: string; // Login email of the caregiver, links her account to this house
  // Encrypted fields couldn't be read: amounts are unknown, so no edits or payments
  locked?: boolean;
};

export type DaySchedule = {
  day: string[]; // caregiver IDs for day shift
  night: string[]; // caregiver IDs for night shift
  dayExtra?: string[]; // caregivers paid as daily extra for day shift
  nightExtra?: string[]; // caregivers paid as daily extra for night shift
  dayAdditional?: string[];
  nightAdditional?: string[];
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
  periodKey?: string; // Structured period key for reliable deletion
  paymentKeys?: string[]; // All individual payment keys associated with this entry
  historyKey?: string; // Deterministic key to avoid duplicate period history
  dayRate?: number;
  nightRate?: number;
  additionalRate?: number;
  locked?: boolean;
};

type ScheduleContextValue = {
  caregivers: Caregiver[];
  scheduleByDay: Record<string, DaySchedule>;
  payments: PaymentsByCaregiver;
  paymentHistory: PaymentHistory[];
  isLoading: boolean;
  isFirestoreConnected: boolean;
  hasLoadError: boolean;
  retryLoad: () => void;
  addCaregiver: (caregiver: Omit<Caregiver, "id">) => Promise<void>;
  updateCaregiver: (caregiver: Caregiver) => Promise<void>;
  deleteCaregiver: (caregiverId: string) => Promise<void>;
  toggleShiftAssignment: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
  toggleExtraShiftAssignment: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
  toggleShiftAdditional: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
  markPaidForPeriod: (
    caregiverId: string,
    periodKey: string,
    frequency: Frequency,
  ) => Promise<void>;
  getScheduledCaregivers: (date: Date, shift?: ShiftType) => Caregiver[];
  getExtraScheduledCaregivers: (date: Date, shift?: ShiftType) => Caregiver[];
  getAdditionalScheduledCaregivers: (date: Date, shift?: ShiftType) => Caregiver[];
  isPaidForCaregiverShift: (
    caregiver: Caregiver,
    date: Date,
    shift: ShiftType,
    payMode?: PaymentMode,
  ) => boolean;
  deletePaymentHistory: (paymentId: string) => Promise<void>;
};

const ScheduleContext = createContext<ScheduleContextValue | undefined>(undefined);

const normalizeDaySchedule = (daySchedule?: Partial<DaySchedule>): DaySchedule => ({
  day: daySchedule?.day ?? [],
  night: daySchedule?.night ?? [],
  dayExtra: daySchedule?.dayExtra ?? [],
  nightExtra: daySchedule?.nightExtra ?? [],
  dayAdditional: daySchedule?.dayAdditional ?? [],
  nightAdditional: daySchedule?.nightAdditional ?? [],
});

const extraListOf = (shift: ShiftType) => (shift === "day" ? "dayExtra" : "nightExtra");

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

  // Firestore connection state. Readiness belongs to one house: while another house
  // loads, nothing is written as if the previous one were still selected.
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  const [readyHouseId, setReadyHouseId] = useState<string | null>(null);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const houseNameRef = useRef(currentHouse?.name ?? "");
  houseNameRef.current = currentHouse?.name ?? "";
  const isFirestoreConnected =
    readyHouseId !== null && readyHouseId === currentHouse?.id && readyUserId === user?.uid;
  const processingPaymentsRef = useRef<Set<string>>(new Set());

  // Initialize Firestore and set up real-time listeners
  useEffect(() => {
    let unsubscribeFunctions: (() => void)[] = [];
    let active = true;
    let failed = false;
    const snapshots = new Set<string>();
    const houseId = currentHouse?.id;
    const userId = user?.uid;
    const notReady = () => {
      if (!active) return;
      failed = true;
      setHasLoadError(true);
      setReadyHouseId(null);
      setReadyUserId(null);
      setIsLoading(false);
    };
    const received = (collection: string) => {
      if (!active || failed) return;
      snapshots.add(collection);
      if (snapshots.size === 4 && houseId && userId) {
        setReadyHouseId(houseId);
        setReadyUserId(userId);
        setIsLoading(false);
      }
    };

    // Data of the previous house (or user) never shows under this one
    setCaregivers([]);
    setScheduleByDay({});
    setPayments({ daily: {}, weekly: {}, monthly: {} });
    setPaymentHistory([]);
    setReadyHouseId(null);
    setReadyUserId(null);
    setHasLoadError(false);
    setIsLoading(true);

    const initializeFirestore = async () => {
      if (!userId || !houseId) {
        logger.log(
          "No user or house selected, clearing data and skipping Firestore initialization",
        );
        setIsLoading(false);
        return;
      }

      try {
        logger.log(
          "Initializing Firestore in ScheduleContext for user:",
          userId,
          "house:",
          houseId,
        );

        // Initialize Firestore service with user ID and house ID
        // A newer house selection took over while this one was loading
        const initialized = await FirestoreService.initialize(
          userId,
          houseId,
          houseNameRef.current,
        );
        if (!active) return;
        if (!initialized) {
          notReady();
          return;
        }

        // Set up real-time listeners
        const unsubscribeCaregivers = FirestoreService.subscribeToCaregivers(
          (caregivers) => {
            if (!active) return;
            logger.log("Caregivers updated from Firestore:", caregivers.length, "caregivers");
            setCaregivers(caregivers);
            received("caregivers");
          },
          (error) => {
            console.error("Error in caregivers listener:", error);
            notReady();
          },
        );

        const unsubscribeSchedule = FirestoreService.subscribeToSchedule(
          (schedule) => {
            if (!active) return;
            logger.log("Schedule updated from Firestore:", Object.keys(schedule).length, "days");
            const scheduleWithShifts: Record<string, DaySchedule> = {};
            Object.entries(schedule).forEach(([date, daySchedule]) => {
              scheduleWithShifts[date] = normalizeDaySchedule(daySchedule);
            });
            setScheduleByDay(scheduleWithShifts);
            received("schedule");
          },
          (error) => {
            console.error("Error in schedule listener:", error);
            notReady();
          },
        );

        const unsubscribePayments = FirestoreService.subscribeToPayments(
          (payments) => {
            if (!active) return;
            logger.log("Payments updated from Firestore");
            setPayments(payments);
            received("payments");
          },
          (error) => {
            console.error("Error in payments listener:", error);
            notReady();
          },
        );

        const unsubscribePaymentHistory = FirestoreService.subscribeToPaymentHistory(
          (history) => {
            if (!active) return;
            logger.log("Payment history updated from Firestore:", history.length, "payments");
            setPaymentHistory(history);
            received("history");
          },
          (error) => {
            console.error("Error in payment history listener:", error);
            notReady();
          },
        );

        unsubscribeFunctions = [
          unsubscribeCaregivers,
          unsubscribeSchedule,
          unsubscribePayments,
          unsubscribePaymentHistory,
        ];

        logger.log("Firestore listeners installed; waiting for all initial snapshots");
      } catch (error) {
        console.error("Error initializing Firestore:", error);
        notReady();
      }
    };

    initializeFirestore();

    // Cleanup listeners on unmount or user change
    return () => {
      active = false;
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
      FirestoreService.cleanup();
    };
  }, [user?.uid, currentHouse?.id, loadAttempt]);

  // Every change is written to the selected house and only shows once Firestore has
  // it: a failed or impossible write reaches the caller instead of looking applied
  const persist = useCallback(
    async <T,>(remote: () => Promise<T>): Promise<T> => {
      if (!isFirestoreConnected) throw new Error(translate("errors.houseNotReady"));
      if (
        !user?.uid ||
        !currentHouse?.id ||
        !FirestoreService.isReadyFor(user.uid, currentHouse.id)
      ) {
        throw new Error(translate("errors.houseNotReady"));
      }
      return remote();
    },
    [isFirestoreConnected, user?.uid, currentHouse?.id],
  );

  // Amounts that couldn't be decrypted are unknown: saving the form or paying would
  // replace or compute them from placeholders
  const requireReadable = useCallback(
    (caregiverId: string) => {
      if (caregivers.find((cg) => cg.id === caregiverId)?.locked) {
        throw new Error(translate("errors.ratesUnavailable"));
      }
    },
    [caregivers],
  );

  const addCaregiver = useCallback(
    async (caregiver: Omit<Caregiver, "id">) => {
      const caregiverId = await persist(() => FirestoreService.addCaregiver(caregiver));
      AnalyticsService.trackCaregiverAction("created", caregiverId);
      AnalyticsService.trackEvent("caregiver_added", {
        frequency: caregiver.frequency,
      });
    },
    [persist],
  );

  const updateCaregiver = useCallback(
    async ({ id, locked: _locked, ...updates }: Caregiver) => {
      requireReadable(id);
      await persist(() => FirestoreService.updateCaregiver(id, updates));
    },
    [persist, requireReadable],
  );

  // Caregivers are disabled rather than deleted so their history stays intact
  const deleteCaregiver = useCallback(
    async (caregiverId: string) => {
      await persist(() => FirestoreService.disableCaregiver(caregiverId));
    },
    [persist],
  );

  // Adds or removes a caregiver from a shift's regular or extra list. A caregiver is
  // never in both lists of the same shift, so adding to one removes from the other.
  const toggleAssignment = useCallback(
    async (caregiverId: string, date: Date, shift: ShiftType, extra: boolean) => {
      const caregiver = caregivers.find((c) => c.id === caregiverId);
      if (caregiver?.disabled) {
        logger.warn("Cannot assign disabled caregiver to shift");
        return;
      }

      const key = dateKey(date);
      const list = extra ? extraListOf(shift) : shift;
      const wasAssigned = normalizeDaySchedule(scheduleByDay[key])[list]!.includes(caregiverId);
      await persist(() =>
        FirestoreService.updateDaySchedule(key, caregiverId, shift, extra, !wasAssigned),
      );

      if (!caregiver) return;
      const action = wasAssigned ? "unassigned" : "assigned";
      if (extra) {
        AnalyticsService.trackCaregiverAction(`${action}_extra`, caregiverId);
      } else {
        AnalyticsService.trackCaregiverAction(action, caregiverId);
        AnalyticsService.trackCalendarInteraction(
          wasAssigned ? "caregiver_removed" : "caregiver_added",
          date.toISOString(),
        );
      }
    },
    [caregivers, scheduleByDay, persist],
  );

  const toggleShiftAssignment = useCallback(
    (caregiverId: string, date: Date, shift: ShiftType) =>
      toggleAssignment(caregiverId, date, shift, false),
    [toggleAssignment],
  );

  const toggleExtraShiftAssignment = useCallback(
    (caregiverId: string, date: Date, shift: ShiftType) =>
      toggleAssignment(caregiverId, date, shift, true),
    [toggleAssignment],
  );

  const toggleShiftAdditional = useCallback(
    async (caregiverId: string, date: Date, shift: ShiftType) => {
      requireReadable(caregiverId);
      const key = dateKey(date);
      const assigned = scheduleByDay[key]?.[additionalList(shift)]?.includes(caregiverId) ?? false;
      await persist(() =>
        FirestoreService.updateShiftAdditional(key, caregiverId, shift, !assigned),
      );
    },
    [persist, requireReadable, scheduleByDay],
  );

  const getAdditionalScheduledCaregivers = useCallback(
    (date: Date, shift?: ShiftType): Caregiver[] => {
      const schedule = normalizeDaySchedule(scheduleByDay[dateKey(date)]);
      const shifts = shift ? [shift] : (["day", "night"] as const);
      return caregivers.filter((cg) =>
        shifts.some(
          (current) =>
            schedule[current].includes(cg.id) && schedule[additionalList(current)]!.includes(cg.id),
        ),
      );
    },
    [caregivers, scheduleByDay],
  );

  const getScheduledCaregivers = useCallback(
    (date: Date, shift?: ShiftType): Caregiver[] => {
      const key = dateKey(date);
      const daySchedule = normalizeDaySchedule(scheduleByDay[key]);
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

  const getExtraScheduledCaregivers = useCallback(
    (date: Date, shift?: ShiftType): Caregiver[] => {
      const key = dateKey(date);
      const daySchedule = normalizeDaySchedule(scheduleByDay[key]);

      if (shift) {
        const extraShift = shift === "day" ? "dayExtra" : "nightExtra";
        const caregiverIds = daySchedule[extraShift] ?? [];
        return caregivers.filter((cg) => caregiverIds.includes(cg.id));
      }

      const allCaregiverIds = [...(daySchedule.dayExtra ?? []), ...(daySchedule.nightExtra ?? [])];
      const uniqueIds = [...new Set(allCaregiverIds)];
      return caregivers.filter((cg) => uniqueIds.includes(cg.id));
    },
    [caregivers, scheduleByDay],
  );

  // caregiverId -> paid shifts, independent of the frequency they were paid under
  const paidShifts = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    Object.entries(payments.daily).forEach(([caregiverId, keys]) => {
      result[caregiverId] = toPaidShifts(keys);
    });
    return result;
  }, [payments]);

  const isPaidForCaregiverShift = useCallback(
    (cg: Caregiver, date: Date, shift: ShiftType, payMode: PaymentMode = "regular") =>
      paidShifts[cg.id]?.has(paidShiftKey(dateKey(date), shift, payMode)) ?? false,
    [paidShifts],
  );

  const markPaidForPeriod = useCallback(
    async (caregiverId: string, periodKey: string, frequency: Frequency) => {
      const cg = caregivers.find((c) => c.id === caregiverId);
      if (!cg) return;
      requireReadable(caregiverId);

      const periodProcessKey = `${caregiverId}::${periodKey}::${frequency}`;
      if (processingPaymentsRef.current.has(periodProcessKey)) {
        return;
      }

      processingPaymentsRef.current.add(periodProcessKey);

      try {
        const unpaidShifts = collectPaymentObligations(cg, scheduleByDay, isPaidForCaregiverShift)
          .filter((item) => item.periodKey === periodKey && item.frequency === frequency)
          .sort((a, b) => a.paymentKey.localeCompare(b.paymentKey));
        const collectedPaymentKeys = unpaidShifts.map((item) => item.paymentKey);
        if (collectedPaymentKeys.length === 0) return;

        const physicalShifts = new Map(
          unpaidShifts.map((item) => [`${item.dayKey}:${item.shift}`, item]),
        );
        const dayShifts = [...physicalShifts.values()].filter(
          (item) => item.shift === "day",
        ).length;
        const nightShifts = physicalShifts.size - dayShifts;
        const totalAmount = sumAmounts(unpaidShifts.map((item) => item.amount));
        const daysMarked = new Set(unpaidShifts.map((item) => item.dayKey)).size;
        const expectedRates = {
          dayRate: shiftAmount(cg, "day"),
          nightRate: shiftAmount(cg, "night"),
          additionalRate: additionalAmount(cg),
        };

        // Create single payment history entry for the entire period
        let historyEntry: Omit<PaymentHistory, "id"> | null = null;
        if (totalAmount > 0) {
          const now = new Date().toISOString();
          const first = unpaidShifts[0];
          const firstDate = parseCalendarDate(first.dayKey);
          let description =
            first.mode === "daily-extra"
              ? `Extra ${first.shift === "day" ? "Dia" : "Noite"} - ${firstDate.toLocaleDateString("pt-BR")}`
              : describePeriod(firstDate, frequency);

          // Add shift details to description
          const shiftDetails = [];
          if (dayShifts > 0) shiftDetails.push(`${dayShifts} ${dayShifts === 1 ? "Dia" : "Dias"}`);
          if (nightShifts > 0)
            shiftDetails.push(`${nightShifts} ${nightShifts === 1 ? "Noite" : "Noites"}`);
          if (shiftDetails.length > 0) {
            description += ` (${shiftDetails.join(", ")})`;
          }

          const managerName =
            user?.displayName || user?.email?.split("@")[0] || translate("notifications.user");

          historyEntry = {
            caregiverId,
            caregiverName: cg.name,
            date: now,
            frequency,
            description,
            amount: totalAmount,
            ...expectedRates,
            paidAt: now,
            managerName,
            periodKey,
            paymentKeys: collectedPaymentKeys,
            // A period can be paid in parts (e.g. around a frequency change). Keying the
            // entry by its first shift keeps each part instead of overwriting the last one.
            historyKey: `${buildHistoryKey({ caregiverId, periodKey, frequency })}::${collectedPaymentKeys[0]}`,
          };
        }

        // Paid shifts and their history entry are written together
        await persist(() =>
          FirestoreService.recordPayment(
            caregiverId,
            frequency,
            collectedPaymentKeys,
            historyEntry,
            expectedRates,
          ),
        );

        logger.log(
          `Marked ${daysMarked} days (${dayShifts} day shifts, ${nightShifts} night shifts) as paid in period ${periodKey}`,
        );
      } finally {
        processingPaymentsRef.current.delete(periodProcessKey);
      }
    },
    [caregivers, scheduleByDay, isPaidForCaregiverShift, persist, requireReadable, user],
  );

  const deletePaymentHistory = useCallback(
    async (paymentId: string) => {
      const entry = paymentHistory.find((p) => p.id === paymentId);
      if (!entry) throw new Error(translate("errors.paymentUnresolved"));

      const paymentKeys = entry.paymentKeys?.length
        ? entry.paymentKeys
        : legacyPaymentKeys(entry, scheduleByDay);
      // Deleting only the entry would leave its shifts marked as paid
      if (!paymentKeys) throw new Error(translate("errors.paymentUnresolved"));

      await persist(() =>
        FirestoreService.deletePaymentRecord(paymentId, entry.caregiverId, paymentKeys),
      );
      logger.log(`Deleted payment history ${paymentId} and ${paymentKeys.length} payments`);
    },
    [persist, paymentHistory, scheduleByDay],
  );

  const value = useMemo<ScheduleContextValue>(
    () => ({
      caregivers,
      scheduleByDay,
      payments,
      paymentHistory,
      isLoading,
      isFirestoreConnected,
      hasLoadError,
      retryLoad,
      addCaregiver,
      updateCaregiver,
      deleteCaregiver,
      toggleShiftAssignment,
      toggleExtraShiftAssignment,
      toggleShiftAdditional,
      getAdditionalScheduledCaregivers,
      markPaidForPeriod,
      getScheduledCaregivers,
      getExtraScheduledCaregivers,
      isPaidForCaregiverShift,
      deletePaymentHistory,
    }),
    [
      caregivers,
      scheduleByDay,
      payments,
      paymentHistory,
      isLoading,
      isFirestoreConnected,
      hasLoadError,
      retryLoad,
      addCaregiver,
      updateCaregiver,
      deleteCaregiver,
      toggleShiftAssignment,
      toggleExtraShiftAssignment,
      toggleShiftAdditional,
      getAdditionalScheduledCaregivers,
      markPaidForPeriod,
      getScheduledCaregivers,
      getExtraScheduledCaregivers,
      isPaidForCaregiverShift,
      deletePaymentHistory,
    ],
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
