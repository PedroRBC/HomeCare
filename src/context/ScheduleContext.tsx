import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { dateKey } from "@/utils/date";
import { logger } from "@/utils/logger";
import { AnalyticsService } from "@/services/firebase";
import { FirestoreService } from "@/services/firestore";
import { legacyPaymentKeys } from "@/utils/paymentHistory";
import {
  buildHistoryKey,
  buildPaymentKey,
  parseExtraPeriodKey,
  resolvePeriodKey,
  type PaymentMode,
} from "@/utils/paymentDomain";
import { useAuth } from "./AuthContext";
import { useHouse } from "./HouseContext";

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

const without = (ids: string[] | undefined, id: string) => (ids ?? []).filter((x) => x !== id);
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

  // Firestore connection state
  const [isLoading, setIsLoading] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const processingPaymentsRef = useRef<Set<string>>(new Set());

  // Initialize Firestore and set up real-time listeners
  useEffect(() => {
    let unsubscribeFunctions: (() => void)[] = [];

    const initializeFirestore = async () => {
      if (!user?.uid || !currentHouse?.id) {
        logger.log(
          "No user or house selected, clearing data and skipping Firestore initialization",
        );
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
        logger.log(
          "Initializing Firestore in ScheduleContext for user:",
          user.uid,
          "house:",
          currentHouse.id,
        );

        // Initialize Firestore service with user ID and house ID
        await FirestoreService.initialize(user.uid, currentHouse.id);

        // Set up real-time listeners
        const unsubscribeCaregivers = FirestoreService.subscribeToCaregivers(
          (caregivers) => {
            logger.log("Caregivers updated from Firestore:", caregivers.length, "caregivers");
            setCaregivers(caregivers);
          },
          (error) => {
            console.error("Error in caregivers listener:", error);
            setIsFirestoreConnected(false);
          },
        );

        const unsubscribeSchedule = FirestoreService.subscribeToSchedule(
          (schedule) => {
            logger.log("Schedule updated from Firestore:", Object.keys(schedule).length, "days");
            const scheduleWithShifts: Record<string, DaySchedule> = {};
            Object.entries(schedule).forEach(([date, daySchedule]) => {
              scheduleWithShifts[date] = normalizeDaySchedule(daySchedule);
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
            logger.log("Payments updated from Firestore");
            setPayments(payments);
          },
          (error) => {
            console.error("Error in payments listener:", error);
            setIsFirestoreConnected(false);
          },
        );

        const unsubscribePaymentHistory = FirestoreService.subscribeToPaymentHistory(
          (history) => {
            logger.log("Payment history updated from Firestore:", history.length, "payments");
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
        logger.log("Firestore initialization completed successfully");
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

  // Writes go to Firestore when connected. Otherwise, or if the write fails, the
  // change is only applied to local state.
  const persist = useCallback(
    async (remote: () => Promise<unknown>, local: () => void) => {
      if (!isFirestoreConnected) return local();
      try {
        await remote();
      } catch (error) {
        console.error("Error saving to Firestore:", error);
        local();
      }
    },
    [isFirestoreConnected],
  );

  const addCaregiver = useCallback(
    async (caregiver: Omit<Caregiver, "id">) => {
      await persist(
        async () => {
          const caregiverId = await FirestoreService.addCaregiver(caregiver);
          AnalyticsService.trackCaregiverAction("created", caregiverId, caregiver.name);
        },
        () => setCaregivers((prev) => [...prev, { ...caregiver, id: Date.now().toString() }]),
      );
      AnalyticsService.trackEvent("caregiver_added", {
        frequency: caregiver.frequency,
        amount: caregiver.amount,
      });
    },
    [persist],
  );

  const updateCaregiver = useCallback(
    ({ id, ...updates }: Caregiver) =>
      persist(
        () => FirestoreService.updateCaregiver(id, updates),
        () => setCaregivers((prev) => prev.map((cg) => (cg.id === id ? { id, ...updates } : cg))),
      ),
    [persist],
  );

  // Caregivers are disabled rather than deleted so their history stays intact
  const deleteCaregiver = useCallback(
    (caregiverId: string) =>
      persist(
        () => FirestoreService.updateCaregiver(caregiverId, { disabled: true }),
        () =>
          setCaregivers((prev) =>
            prev.map((cg) => (cg.id === caregiverId ? { ...cg, disabled: true } : cg)),
          ),
      ),
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
      const otherList = extra ? shift : extraListOf(shift);
      const wasAssigned = normalizeDaySchedule(scheduleByDay[key])[list]!.includes(caregiverId);
      const toggle = (day: DaySchedule): DaySchedule =>
        wasAssigned
          ? { ...day, [list]: without(day[list], caregiverId) }
          : {
              ...day,
              [list]: [...without(day[list], caregiverId), caregiverId],
              [otherList]: without(day[otherList], caregiverId),
            };

      await persist(
        () =>
          FirestoreService.updateDaySchedule(key, toggle(normalizeDaySchedule(scheduleByDay[key]))),
        () =>
          setScheduleByDay((prev) => ({ ...prev, [key]: toggle(normalizeDaySchedule(prev[key])) })),
      );

      if (!caregiver) return;
      const action = wasAssigned ? "unassigned" : "assigned";
      if (extra) {
        AnalyticsService.trackCaregiverAction(action, caregiverId, `${caregiver.name} (extra)`);
      } else {
        AnalyticsService.trackCaregiverAction(action, caregiverId, caregiver.name);
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

  const isPaidForCaregiverShift = useCallback(
    (cg: Caregiver, date: Date, shift: ShiftType, payMode: PaymentMode = "regular") => {
      const frequency = payMode === "daily-extra" ? "Diário" : cg.frequency;
      const paymentKey = buildPaymentKey({
        date,
        shift,
        frequency,
        mode: payMode,
      });

      // All frequencies now use daily payments
      const set = payments.daily[cg.id] ?? new Set<string>();
      return set.has(paymentKey);
    },
    [payments],
  );

  const markPaidForPeriod = useCallback(
    async (caregiverId: string, periodKey: string, frequency: Frequency) => {
      const cg = caregivers.find((c) => c.id === caregiverId);
      if (!cg) return;

      const periodProcessKey = `${caregiverId}::${periodKey}::${frequency}`;
      if (processingPaymentsRef.current.has(periodProcessKey)) {
        return;
      }

      processingPaymentsRef.current.add(periodProcessKey);

      try {
        const today = new Date();
        let totalAmount = 0;
        let daysMarked = 0;
        let dayShifts = 0;
        let nightShifts = 0;
        const workedDates = new Set<string>();
        const collectedPaymentKeys: string[] = [];

        if (frequency === "Diário") {
          const parsedExtraPeriod = parseExtraPeriodKey(periodKey);
          if (!parsedExtraPeriod) return;

          const targetDate = new Date(`${parsedExtraPeriod.dayKey}T12:00:00`);
          const shift = parsedExtraPeriod.shift;
          const isExtraScheduled = getExtraScheduledCaregivers(targetDate, shift).some(
            (x) => x.id === cg.id,
          );

          if (isExtraScheduled && !isPaidForCaregiverShift(cg, targetDate, shift, "daily-extra")) {
            const paymentKey = buildPaymentKey({
              date: targetDate,
              shift,
              frequency: "Diário",
              mode: "daily-extra",
            });

            if (isFirestoreConnected) {
              await FirestoreService.createPayment(caregiverId, "Diário", paymentKey);
            } else {
              setPayments((prev) => {
                const next = { ...prev, daily: { ...prev.daily } };
                const set = new Set(next.daily[caregiverId] ?? []);
                set.add(paymentKey);
                next.daily[caregiverId] = set;
                return next;
              });
            }

            collectedPaymentKeys.push(paymentKey);
            totalAmount +=
              shift === "day" ? cg.dayAmount || cg.amount : cg.nightAmount || cg.amount;
            if (shift === "day") {
              dayShifts++;
            } else {
              nightShifts++;
            }
            workedDates.add(dateKey(targetDate));
          }
        } else {
          // Find all unpaid days in this period
          for (let i = -14; i < 45; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
            const dayCaregivers = getScheduledCaregivers(d, "day");
            const nightCaregivers = getScheduledCaregivers(d, "night");

            const isDayScheduled = dayCaregivers.some((x: any) => x.id === cg.id);
            const isNightScheduled = nightCaregivers.some((x: any) => x.id === cg.id);

            if (isDayScheduled || isNightScheduled) {
              // Check if this date belongs to the period
              const datePeriodKey = resolvePeriodKey(d, frequency);

              if (datePeriodKey === periodKey) {
                // Mark unpaid shifts as paid and collect data for single history entry
                if (isDayScheduled && !isPaidForCaregiverShift(cg, d, "day")) {
                  const paymentKey = buildPaymentKey({
                    date: d,
                    shift: "day",
                    frequency,
                  });

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
                  collectedPaymentKeys.push(paymentKey);
                  totalAmount += cg.dayAmount || cg.amount;
                  dayShifts++;
                  workedDates.add(dateKey(d));
                }
                if (isNightScheduled && !isPaidForCaregiverShift(cg, d, "night")) {
                  const paymentKey = buildPaymentKey({
                    date: d,
                    shift: "night",
                    frequency,
                  });

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
                  collectedPaymentKeys.push(paymentKey);
                  totalAmount += cg.nightAmount || cg.amount;
                  nightShifts++;
                  workedDates.add(dateKey(d));
                }
              }
            }
          }
        }

        daysMarked = workedDates.size;

        // Create single payment history entry for the entire period
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

          const managerName = user?.displayName || user?.email?.split("@")[0] || "Usuário";

          const historyEntry: Omit<PaymentHistory, "id"> = {
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
            historyKey: buildHistoryKey({ caregiverId, periodKey, frequency }),
          };

          if (isFirestoreConnected) {
            await FirestoreService.addPaymentHistory(historyEntry);
          } else {
            // Fallback to local state
            const newId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            setPaymentHistory((prev) => [{ ...historyEntry, id: newId }, ...prev]);
          }
        }

        logger.log(
          `Marked ${daysMarked} days (${dayShifts} day shifts, ${nightShifts} night shifts) as paid for ${cg.name} in period ${periodKey}, total: R$ ${totalAmount.toFixed(2)}`,
        );
      } catch (error) {
        console.error("Error marking period payment:", error);
      } finally {
        processingPaymentsRef.current.delete(periodProcessKey);
      }
    },
    [
      caregivers,
      getScheduledCaregivers,
      getExtraScheduledCaregivers,
      isPaidForCaregiverShift,
      isFirestoreConnected,
      setPayments,
      setPaymentHistory,
      user,
    ],
  );

  const deletePaymentHistory = useCallback(
    async (paymentId: string) => {
      const entry = paymentHistory.find((p) => p.id === paymentId);
      if (!entry) {
        console.error("Payment history entry not found:", paymentId);
        return;
      }

      const paymentKeys = entry.paymentKeys?.length
        ? entry.paymentKeys
        : legacyPaymentKeys(entry, scheduleByDay);
      if (!paymentKeys) {
        console.error("Could not find the payments of history entry:", entry.description);
        return;
      }

      try {
        if (isFirestoreConnected) {
          await FirestoreService.deletePaymentHistory(paymentId);
          await FirestoreService.deletePaymentsByKeys(entry.caregiverId, paymentKeys);
        } else {
          setPaymentHistory((prev) => prev.filter((payment) => payment.id !== paymentId));
          setPayments((prev) => {
            const paid = new Set(prev.daily[entry.caregiverId] ?? []);
            paymentKeys.forEach((key) => paid.delete(key));
            return { ...prev, daily: { ...prev.daily, [entry.caregiverId]: paid } };
          });
        }
        logger.log(`Deleted payment history ${paymentId} and ${paymentKeys.length} payments`);
      } catch (error) {
        console.error("Error deleting payment history:", error);
        setPaymentHistory((prev) => prev.filter((payment) => payment.id !== paymentId));
      }
    },
    [isFirestoreConnected, paymentHistory, scheduleByDay],
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
