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
  buildPaymentKey,
  paidShiftKey,
  parseExtraPeriodKey,
  resolvePeriodKey,
  toPaidShifts,
  type PaymentMode,
} from "@/utils/paymentDomain";
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
  locked?: boolean;
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
  toggleShiftAssignment: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
  toggleExtraShiftAssignment: (caregiverId: string, date: Date, shift: ShiftType) => Promise<void>;
  markPaidForPeriod: (
    caregiverId: string,
    periodKey: string,
    frequency: Frequency,
  ) => Promise<void>;
  getScheduledCaregivers: (date: Date, shift?: ShiftType) => Caregiver[];
  getExtraScheduledCaregivers: (date: Date, shift?: ShiftType) => Caregiver[];
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
        if (
          !(await FirestoreService.initialize(userId, houseId, houseNameRef.current)) ||
          !active
        ) {
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
  }, [user?.uid, currentHouse?.id]);

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
        // Every scheduled shift of this period, wherever it falls in the schedule
        const periodShifts: { date: Date; shift: ShiftType; mode: PaymentMode }[] = [];

        if (frequency === "Diário") {
          const parsedExtraPeriod = parseExtraPeriodKey(periodKey);
          if (!parsedExtraPeriod) return;

          const { dayKey, shift } = parsedExtraPeriod;
          const extraShift = shift === "day" ? "dayExtra" : "nightExtra";
          if ((scheduleByDay[dayKey]?.[extraShift] ?? []).includes(caregiverId)) {
            periodShifts.push({ date: parseCalendarDate(dayKey), shift, mode: "daily-extra" });
          }
        } else {
          Object.entries(scheduleByDay).forEach(([dayKey, daySchedule]) => {
            const date = parseCalendarDate(dayKey);
            if (resolvePeriodKey(date, frequency) !== periodKey) return;

            (["day", "night"] as const).forEach((shift) => {
              if (daySchedule[shift].includes(caregiverId)) {
                periodShifts.push({ date, shift, mode: "regular" });
              }
            });
          });
        }

        const unpaidShifts = periodShifts.filter(
          ({ date, shift, mode }) => !isPaidForCaregiverShift(cg, date, shift, mode),
        );
        const collectedPaymentKeys = unpaidShifts.map(({ date, shift, mode }) =>
          buildPaymentKey({ date, shift, frequency, mode }),
        );
        if (collectedPaymentKeys.length === 0) return;

        const dayShifts = unpaidShifts.filter((s) => s.shift === "day").length;
        const nightShifts = unpaidShifts.length - dayShifts;
        const totalAmount =
          dayShifts * (cg.dayAmount || cg.amount) + nightShifts * (cg.nightAmount || cg.amount);
        const daysMarked = new Set(unpaidShifts.map((s) => dateKey(s.date))).size;

        // Create single payment history entry for the entire period
        let historyEntry: Omit<PaymentHistory, "id"> | null = null;
        if (totalAmount > 0) {
          const now = new Date().toISOString();
          let description = "";

          if (frequency === "Diário") {
            const parsed = parseExtraPeriodKey(periodKey);
            if (parsed) {
              description = `Extra ${parsed.shift === "day" ? "Dia" : "Noite"} - ${new Date(`${parsed.dayKey}T12:00:00`).toLocaleDateString("pt-BR")}`;
            }
          } else if (frequency === "Semanal") {
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

          const managerName =
            user?.displayName || user?.email?.split("@")[0] || translate("notifications.user");

          historyEntry = {
            caregiverId,
            caregiverName: cg.name,
            date: now,
            frequency,
            description,
            amount: totalAmount,
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
      addCaregiver,
      updateCaregiver,
      deleteCaregiver,
      toggleShiftAssignment,
      toggleExtraShiftAssignment,
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
      addCaregiver,
      updateCaregiver,
      deleteCaregiver,
      toggleShiftAssignment,
      toggleExtraShiftAssignment,
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
