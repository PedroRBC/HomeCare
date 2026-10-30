import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FirestoreService } from "@/services/firestore";
import { CaregiverPayService } from "@/services/caregiverPay";
import { caregiverUpcomingPayments, type CaregiverPay } from "@/utils/caregiverPay";
import type { UpcomingPayment } from "@/utils/upcomingPayments";
import type { DaySchedule } from "./ScheduleContext";
import { useAuth } from "./AuthContext";
import {
  buildCaregiverShifts,
  linkStatus,
  normalizeEmail,
  type CaregiverLink,
  type CaregiverShift,
} from "@/utils/caregiverShifts";

export type CaregiverUpcomingPayment = UpcomingPayment & { houseId: string; houseName: string };

type CaregiverContextValue = {
  // Houses where a manager registered the logged in user's email, minus declined ones
  links: CaregiverLink[];
  // Houses she accepted: only these show their schedule
  acceptedLinks: CaregiverLink[];
  // Houses waiting for her answer
  pendingLinks: CaregiverLink[];
  respondToLink: (linkId: string, accept: boolean) => Promise<void>;
  shifts: CaregiverShift[];
  // Estimate of her unpaid shifts already in the schedule, oldest period first
  payments: CaregiverUpcomingPayment[];
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

  // linkId -> her decrypted pay in that house, for links whose managers shared it
  const [pays, setPays] = useState<Record<string, CaregiverPay>>({});
  useEffect(() => {
    let active = true;
    Promise.all(
      acceptedLinks.map(async (l) => {
        try {
          return [l.id, await CaregiverPayService.read(l.id, l.pay)] as const;
        } catch {
          return [l.id, undefined] as const; // Couldn't fetch the key: keep the last estimate
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setPays((previous) => {
        const next: Record<string, CaregiverPay> = {};
        for (const [id, pay] of entries) {
          const kept = pay === undefined ? previous[id] : pay;
          if (kept) next[id] = kept;
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [acceptedLinks]);

  const payments = useMemo(
    () =>
      acceptedLinks
        .flatMap((l) =>
          // A disabled caregiver sees her past shifts, not estimates
          pays[l.id] && !l.disabled
            ? caregiverUpcomingPayments(l.caregiverId, pays[l.id], schedules[l.houseId] ?? {}).map(
                (p) => ({ ...p, houseId: l.houseId, houseName: l.houseName }),
              )
            : [],
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [acceptedLinks, pays, schedules],
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
      payments,
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
      payments,
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
