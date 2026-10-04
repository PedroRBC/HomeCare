import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FirestoreService } from "@/services/firestore";
import type { DaySchedule } from "./ScheduleContext";
import { useAuth } from "./AuthContext";
import {
  buildCaregiverShifts,
  normalizeEmail,
  type CaregiverLink,
  type CaregiverShift,
} from "@/utils/caregiverShifts";

type CaregiverContextValue = {
  // Houses where a manager registered the logged in user's email as a caregiver
  links: CaregiverLink[];
  shifts: CaregiverShift[];
  isLoading: boolean;
  // Houses whose schedule could not be loaded (e.g. no permission anymore)
  unavailableHouseIds: string[];
};

const CaregiverContext = createContext<CaregiverContextValue | undefined>(undefined);

export const CaregiverProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const email = normalizeEmail(user?.email);

  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [schedules, setSchedules] = useState<Record<string, Record<string, DaySchedule>>>({});
  const [unavailableHouseIds, setUnavailableHouseIds] = useState<string[]>([]);

  useEffect(() => {
    setLinks([]);
    setSchedules({});
    setUnavailableHouseIds([]);
    if (!email) {
      setLinksLoaded(true);
      return;
    }

    setLinksLoaded(false);
    return FirestoreService.subscribeToCaregiverLinks(
      email,
      (next) => {
        setLinks(next);
        setLinksLoaded(true);
      },
      () => setLinksLoaded(true),
    );
  }, [email]);

  // One schedule listener per house, even if she is linked to it more than once
  const houseIdsKey = useMemo(
    () => [...new Set(links.map((l) => l.houseId))].sort().join(","),
    [links],
  );

  useEffect(() => {
    if (!houseIdsKey) return;
    const houseIds = houseIdsKey.split(",");

    const unsubscribes = houseIds.map((houseId) =>
      FirestoreService.subscribeToHouseSchedule(
        houseId,
        (schedule) => {
          setSchedules((prev) => ({ ...prev, [houseId]: schedule as Record<string, DaySchedule> }));
          setUnavailableHouseIds((prev) => prev.filter((id) => id !== houseId));
        },
        () =>
          setUnavailableHouseIds((prev) => (prev.includes(houseId) ? prev : [...prev, houseId])),
      ),
    );

    // Schedules of houses she is no longer linked to are ignored by buildCaregiverShifts
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [houseIdsKey]);

  const shifts = useMemo(() => buildCaregiverShifts(links, schedules), [links, schedules]);

  const value = useMemo<CaregiverContextValue>(
    () => ({
      links,
      shifts,
      isLoading: !linksLoaded,
      unavailableHouseIds: unavailableHouseIds.filter((id) => links.some((l) => l.houseId === id)),
    }),
    [links, shifts, linksLoaded, unavailableHouseIds],
  );

  return <CaregiverContext.Provider value={value}>{children}</CaregiverContext.Provider>;
};

export function useCaregiver() {
  const ctx = useContext(CaregiverContext);
  if (!ctx) throw new Error("useCaregiver must be used within CaregiverProvider");
  return ctx;
}
