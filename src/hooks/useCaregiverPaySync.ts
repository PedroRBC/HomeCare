import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { useSchedule } from "@/context/ScheduleContext";
import { useHouseCaregiverLinks } from "@/hooks/useCaregiverLinks";
import { CaregiverPayService } from "@/services/caregiverPay";
import { buildCaregiverPay } from "@/utils/caregiverPay";
import { linkStatus, normalizeEmail } from "@/utils/caregiverShifts";
import { dateKey } from "@/utils/date";
import { toPaidShifts } from "@/utils/paymentDomain";
import { logger } from "@/utils/logger";
import { createSerialQueue } from "@/utils/serialQueue";

/** Keeps each linked caregiver's encrypted pay (rates and paid shifts) in step with the house. */
export function useCaregiverPaySync() {
  const { user } = useAuth();
  const { caregivers, payments, isLoading, hasLoadError, isFirestoreConnected } = useSchedule();
  const { currentHouse } = useHouse();
  const linksByCaregiver = useHouseCaregiverLinks();
  const userId = user?.uid;
  const today = dateKey(new Date());
  // One sync at a time, so an older pay never lands after a newer one
  const [enqueue] = useState(createSerialQueue);
  // linkId -> what was last sent, so unchanged pay doesn't cost a transaction
  const sent = useRef(new Map<string, string>());

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
      const email = normalizeEmail(caregiver.email);
      const state = JSON.stringify([userId, email, pay]);
      // The link may have lost its pay elsewhere (e.g. moved to another email and back)
      if (sent.current.get(link.id) === state && !pay === !link.pay) continue;
      sent.current.set(link.id, state);
      enqueue(() => CaregiverPayService.sync(link.id, email, userId, pay)).catch((error) => {
        // Retried on the next change, unless a newer pay was sent meanwhile
        if (sent.current.get(link.id) === state) sent.current.delete(link.id);
        logger.warn("Could not sync caregiver pay:", error);
      });
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
    enqueue,
  ]);
}
