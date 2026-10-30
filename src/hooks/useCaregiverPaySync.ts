import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { useSchedule } from "@/context/ScheduleContext";
import { useHouseCaregiverLinks } from "@/hooks/useCaregiverLinks";
import { CaregiverPayService } from "@/services/caregiverPay";
import { buildCaregiverPay } from "@/utils/caregiverPay";
import { linkStatus } from "@/utils/caregiverShifts";
import { dateKey } from "@/utils/date";
import { toPaidShifts } from "@/utils/paymentDomain";
import { logger } from "@/utils/logger";

/** Keeps each linked caregiver's encrypted pay (rates and paid shifts) in step with the house. */
export function useCaregiverPaySync() {
  const { user } = useAuth();
  const { caregivers, payments, isLoading, hasLoadError, isFirestoreConnected } = useSchedule();
  const { currentHouse } = useHouse();
  const linksByCaregiver = useHouseCaregiverLinks();
  const userId = user?.uid;
  const today = dateKey(new Date());

  useEffect(() => {
    // Partial data (e.g. payments not loaded yet) would publish wrong estimates
    if (!userId || isLoading || hasLoadError || !isFirestoreConnected) return;
    for (const caregiver of caregivers) {
      const link = linksByCaregiver[caregiver.id];
      // Locked records have unknown rates; declined or disabled links get nothing
      if (!link || link.houseId !== currentHouse?.id || caregiver.locked) continue;
      const pay =
        caregiver.disabled || linkStatus(link) === "declined"
          ? null
          : buildCaregiverPay(caregiver, toPaidShifts(payments.daily[caregiver.id] ?? []));
      CaregiverPayService.sync(link.id, userId, link.pay, pay).catch((error) =>
        logger.warn("Could not sync caregiver pay:", error),
      );
    }
  }, [
    userId,
    currentHouse?.id,
    caregivers,
    payments,
    linksByCaregiver,
    isLoading,
    hasLoadError,
    isFirestoreConnected,
    today,
  ]);
}
