import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FirestoreService } from "@/services/firestore";
import type { DaySchedule } from "./ScheduleContext";
import { useAuth } from "./AuthContext";
import {
  buildCaregiverShifts,
  linkStatus,
  normalizeEmail,
  type CaregiverLink,
  type CaregiverShift,
} from "@/utils/caregiverShifts";

type CaregiverContextValue = {
  // Houses where a manager registered the logged in user's email, minus declined ones
  links: CaregiverLink[];
  // Houses she accepted: only these show their schedule
  acceptedLinks: CaregiverLink[];
  // Houses waiting for her answer
  pendingLinks: CaregiverLink[];
  respondToLink: (linkId: string, accept: boolean) => Promise<void>;
  shifts: CaregiverShift[];
  isLoading: boolean;
  // Houses whose schedule could not be loaded (e.g. no permission anymore)
  unavailableHouseIds: string[];
};

const CaregiverContext = createContext<CaregiverContextValue | undefined>(undefined);

export const CaregiverProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  // Links are found by email, so an unverified one finds none (see firestore.rules)
  const email = user?.emailVerified ? normalizeEmail(user.email) : "";

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

  const acceptedLinks = useMemo(() => links.filter((l) => linkStatus(l) === "accepted"), [links]);
  const pendingLinks = useMemo(() => links.filter((l) => linkStatus(l) === "pending"), [links]);
  const visibleLinks = useMemo(() => links.filter((l) => linkStatus(l) !== "declined"), [links]);

  // One schedule listener per accepted house, even if she is linked to it more than once.
  // Each entry is "houseId:linkId", the link that grants her access to the schedule.
  const houseIdsKey = useMemo(() => {
    const byHouse = new Map(acceptedLinks.map((l) => [l.houseId, l.id]));
    return [...byHouse]
      .map(([houseId, linkId]) => `${houseId}:${linkId}`)
      .sort()
      .join(",");
  }, [acceptedLinks]);

  useEffect(() => {
    if (!houseIdsKey || !user?.uid) return;
    const entries = houseIdsKey.split(",").map((entry) => entry.split(":"));

    const unsubscribes = entries.map(([houseId, linkId]) =>
      FirestoreService.subscribeToHouseSchedule(
        houseId,
        { userId: user.uid, linkId },
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
  }, [houseIdsKey, user?.uid]);

  const shifts = useMemo(
    () => buildCaregiverShifts(acceptedLinks, schedules),
    [acceptedLinks, schedules],
  );

  const respondToLink = useCallback(
    async (linkId: string, accept: boolean) => {
      if (!user?.uid) throw new Error("User not authenticated");
      await FirestoreService.respondToCaregiverLink(
        linkId,
        accept ? "accepted" : "declined",
        user.uid,
      );
    },
    [user?.uid],
  );

  const value = useMemo<CaregiverContextValue>(
    () => ({
      links: visibleLinks,
      acceptedLinks,
      pendingLinks,
      respondToLink,
      shifts,
      isLoading: !linksLoaded,
      unavailableHouseIds: unavailableHouseIds.filter((id) =>
        acceptedLinks.some((l) => l.houseId === id),
      ),
    }),
    [
      visibleLinks,
      acceptedLinks,
      pendingLinks,
      respondToLink,
      shifts,
      linksLoaded,
      unavailableHouseIds,
    ],
  );

  return <CaregiverContext.Provider value={value}>{children}</CaregiverContext.Provider>;
};

export function useCaregiver() {
  const ctx = useContext(CaregiverContext);
  if (!ctx) throw new Error("useCaregiver must be used within CaregiverProvider");
  return ctx;
}
