import type { Caregiver, DaySchedule, ShiftType } from "@/context/ScheduleContext";

// Link between a house caregiver record and the email the caregiver logs in with
export type CaregiverLink = {
  id: string;
  houseId: string;
  houseName: string;
  caregiverId: string;
  caregiverName: string;
  email: string;
  disabled?: boolean;
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
  if (!isValidEmail(normalized)) return "Email inválido";
  const owner = caregivers.find(
    (c) => c.id !== caregiverId && normalizeEmail(c.email) === normalized,
  );
  return owner ? `Este email já está vinculado a ${owner.name}` : null;
}

export function caregiverLinkId(houseId: string, caregiverId: string) {
  return `${houseId}__${caregiverId}`;
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
