import { useEffect, useMemo, useState } from "react";
import { useHouse } from "@/context/HouseContext";
import { useSchedule } from "@/context/ScheduleContext";
import { FirestoreService } from "@/services/firestore";
import { hasUncheckedAvailability, type CaregiverLink } from "@/utils/caregiverShifts";

// caregiverId -> link of the current house, to show whether she accepted
export function useHouseCaregiverLinks() {
  const { currentHouse } = useHouse();
  const houseId = currentHouse?.id;
  const [links, setLinks] = useState<CaregiverLink[]>([]);

  useEffect(() => {
    setLinks([]);
    if (!houseId) return;
    return FirestoreService.subscribeToHouseCaregiverLinks(houseId, setLinks);
  }, [houseId]);

  return useMemo(() => Object.fromEntries(links.map((l) => [l.caregiverId, l])), [links]);
}

// Tells whether a caregiver of the current house may work a shift in another house.
// Other houses' links are private to them and to the caregiver (see firestore.rules),
// so managers never learn where else she works: `isUnknown` is set whenever a linked
// caregiver could work elsewhere, so the list can show a non-blocking reminder.
export function useCaregiverAvailability() {
  const { caregivers } = useSchedule();
  const isUnknown = caregivers.some(hasUncheckedAvailability);
  // No house can see another house's shifts, so nothing is ever known to be busy
  const isBusy = (_email: string | undefined, _key: string) => false;
  return { isBusy, isUnknown };
}
