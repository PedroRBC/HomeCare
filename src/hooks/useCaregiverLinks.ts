import { useEffect, useMemo, useState } from "react";
import { useHouse } from "@/context/HouseContext";
import { useSchedule } from "@/context/ScheduleContext";
import { FirestoreService } from "@/services/firestore";
import { busyShiftsByEmail, normalizeEmail, type CaregiverLink } from "@/utils/caregiverShifts";

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

// Tells whether a caregiver of the current house already works a shift in another house.
// `isUnknown` is set while other houses can't be checked, so callers don't take
// "no conflict" for granted.
export function useCaregiverAvailability() {
  const { currentHouse } = useHouse();
  const { caregivers } = useSchedule();
  const houseId = currentHouse?.id;
  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [isUnknown, setIsUnknown] = useState(false);

  const emailsKey = useMemo(
    () =>
      [...new Set(caregivers.map((c) => normalizeEmail(c.email)).filter(Boolean))].sort().join(","),
    [caregivers],
  );

  useEffect(() => {
    setLinks([]);
    setIsUnknown(false);
    if (!houseId || !emailsKey) return;
    return FirestoreService.subscribeToAcceptedLinksByEmail(
      emailsKey.split(","),
      setLinks,
      setIsUnknown,
    );
  }, [houseId, emailsKey]);

  const busy = useMemo(() => busyShiftsByEmail(links, houseId ?? ""), [links, houseId]);

  const isBusy = (email: string | undefined, key: string) =>
    busy[normalizeEmail(email)]?.has(key) ?? false;
  return { isBusy, isUnknown };
}
