import type { Caregiver, DaySchedule, ShiftType } from "@/context/ScheduleContext";
import { t as translate } from "i18next";

// The caregiver accepts a house before seeing its schedule
export type CaregiverLinkStatus = "pending" | "accepted" | "declined";

// Link between a house caregiver record and the email the caregiver logs in with
export type CaregiverLink = {
  id: string;
  houseId: string;
  houseName: string;
  caregiverId: string;
  caregiverName: string;
  email: string;
  disabled?: boolean;
  status?: CaregiverLinkStatus; // Missing means pending
  shifts?: string[]; // shiftKey() of every shift she has in this house
};

export type CaregiverShift = {
  date: string; // YYYY-MM-DD
  houseId: string;
  houseName: string;
  shift: ShiftType;
  extra: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

// Error for the optional login email of a caregiver, or null when it can be saved
export function caregiverEmailError(
  email: string,
  caregivers: Caregiver[],
  caregiverId?: string,
): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (!isValidEmail(normalized)) return translate("caregiverView.emailInvalid");
  const owner = caregivers.find(
    (c) => c.id !== caregiverId && normalizeEmail(c.email) === normalized,
  );
  return owner ? translate("caregiverView.emailTaken", { name: owner.name }) : null;
}

export function caregiverLinkId(houseId: string, caregiverId: string) {
  return `${houseId}__${caregiverId}`;
}

export function linkStatus(link: Pick<CaregiverLink, "status">): CaregiverLinkStatus {
  return link.status ?? "pending";
}

export function shiftKey(date: string, shift: ShiftType) {
  return `${date}:${shift}`;
}

// Shifts (regular or extra) of a caregiver in a single day, as shiftKey()
export function dayShiftKeys(caregiverId: string, date: string, day: Partial<DaySchedule>) {
  return (["day", "night"] as const)
    .filter((shift) =>
      [
        ...(day[shift] ?? []),
        ...((shift === "day" ? day.dayExtra : day.nightExtra) ?? []),
      ].includes(caregiverId),
    )
    .map((shift) => shiftKey(date, shift));
}

// Shifts of a caregiver in a whole house schedule, as shiftKey()
export function scheduleShiftKeys(
  caregiverId: string,
  schedule: Record<string, Partial<DaySchedule>>,
) {
  return Object.entries(schedule)
    .flatMap(([date, day]) => dayShiftKeys(caregiverId, date, day))
    .sort();
}

// email -> shifts she already works in other houses. Only houses she accepted and
// that did not disable her make her unavailable.
export function busyShiftsByEmail(links: CaregiverLink[], houseId: string) {
  const busy: Record<string, Set<string>> = {};
  links
    .filter((l) => l.houseId !== houseId && linkStatus(l) === "accepted" && !l.disabled)
    .forEach((l) => {
      const set = (busy[normalizeEmail(l.email)] ??= new Set());
      (l.shifts ?? []).forEach((key) => set.add(key));
    });
  return busy;
}

// Every shift of each linked caregiver, sorted by date, house and shift (day first).
// A caregiver listed in both the regular and extra list of a shift counts once, as regular.
export function buildCaregiverShifts(
  links: CaregiverLink[],
  schedulesByHouse: Record<string, Record<string, Partial<DaySchedule>>>,
): CaregiverShift[] {
  const shifts: CaregiverShift[] = [];

  links.forEach((link) => {
    const schedule = schedulesByHouse[link.houseId] ?? {};
    Object.entries(schedule).forEach(([date, day]) => {
      (["day", "night"] as const).forEach((shift) => {
        const extraList = shift === "day" ? day.dayExtra : day.nightExtra;
        const regular = (day[shift] ?? []).includes(link.caregiverId);
        if (!regular && !(extraList ?? []).includes(link.caregiverId)) return;
        shifts.push({
          date,
          houseId: link.houseId,
          houseName: link.houseName,
          shift,
          extra: !regular,
        });
      });
    });
  });

  return shifts.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.houseName.localeCompare(b.houseName) ||
      a.houseId.localeCompare(b.houseId) ||
      (a.shift === b.shift ? 0 : a.shift === "day" ? -1 : 1),
  );
}

export function groupShiftsByDate(shifts: CaregiverShift[]) {
  const byDate: Record<string, CaregiverShift[]> = {};
  shifts.forEach((s) => {
    (byDate[s.date] ??= []).push(s);
  });
  return byDate;
}
