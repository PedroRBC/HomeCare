/**
 * Builds the personal data export (LGPD art. 18, II and V): everything the app
 * stores about the user, in a structured and readable format.
 */

import type { HouseAccessIssue } from "@/types/house.types";

export const DATA_EXPORT_FORMAT_VERSION = 1;

type AnyRecord = Record<string, unknown>;

export type HouseExportInput = {
  house: AnyRecord & { id: string };
  role?: string;
  caregivers: AnyRecord[];
  schedule: Record<string, AnyRecord>;
  payments: AnyRecord[];
  paymentHistory: AnyRecord[];
};

export type DataExportInput = {
  profile: AnyRecord | null;
  houses: HouseExportInput[];
  invitationsSent: AnyRecord[];
  invitationsReceived: AnyRecord[];
  // Houses that registered the user as a caregiver
  caregiverLinks?: AnyRecord[];
  houseAccessIssues?: HouseAccessIssue[];
  exportedAt?: Date;
};

export type DataExport = ReturnType<typeof buildDataExport>;

// Fields that only make sense inside the database (or must never leave it)
const INTERNAL_FIELDS = new Set(["key", "legacyAccessId", "historyKey", "paymentKeys"]);

const clean = (record: AnyRecord): AnyRecord =>
  Object.fromEntries(Object.entries(record).filter(([field]) => !INTERNAL_FIELDS.has(field)));

const SHIFT_KEY = /^(\d{4}-\d{2}-\d{2}):(day|night)$/;

// A house where the user works as a caregiver: her own shifts there, readable, and
// nothing about the rest of that house's schedule
const caregiverLinkExport = (link: AnyRecord): AnyRecord => {
  const { shifts, ownShifts, ...rest } = clean(link);
  return {
    ...rest,
    status: rest.status ?? "pending",
    shifts: Array.isArray(ownShifts)
      ? ownShifts
      : (Array.isArray(shifts) ? shifts : []).flatMap((key) => {
          const match = typeof key === "string" ? SHIFT_KEY.exec(key) : null;
          return match ? [{ date: match[1], shift: match[2], extra: null }] : [];
        }),
  };
};

export function buildDataExport(input: DataExportInput) {
  const issues = input.houseAccessIssues ?? [];
  return {
    format: "homecare-personal-data",
    formatVersion: DATA_EXPORT_FORMAT_VERSION,
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    account: input.profile ? clean(input.profile) : null,
    houses: input.houses.map(({ house, role, caregivers, schedule, payments, paymentHistory }) => ({
      ...clean(house),
      yourRole: role ?? null,
      caregivers: caregivers.map(clean),
      schedule,
      payments: payments.map(clean),
      paymentHistory: paymentHistory.map(clean),
    })),
    invitations: {
      sent: input.invitationsSent.map(clean),
      received: input.invitationsReceived.map(clean),
    },
    caregiverLinks: (input.caregiverLinks ?? []).map(caregiverLinkExport),
    ...(issues.length > 0 && { complete: false as const, unavailableHouses: issues }),
  };
}

export function summarizeDataExport(data: DataExport) {
  return {
    houses: data.houses.length,
    caregivers: data.houses.reduce((total, house) => total + house.caregivers.length, 0),
    payments: data.houses.reduce((total, house) => total + house.paymentHistory.length, 0),
  };
}
