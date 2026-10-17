import { useMemo } from "react";
import { useSchedule } from "@/context/ScheduleContext";
import { buildUpcomingPayments } from "@/utils/upcomingPayments";

export type { UpcomingPayment } from "@/utils/upcomingPayments";

export const useUpcomingPayments = () => {
  const { caregivers, scheduleByDay, isPaidForCaregiverShift } = useSchedule();
  return useMemo(
    () => buildUpcomingPayments(caregivers, scheduleByDay, isPaidForCaregiverShift),
    [caregivers, isPaidForCaregiverShift, scheduleByDay],
  );
};
