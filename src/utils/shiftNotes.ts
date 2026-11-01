import { z } from "zod";
import type { DaySchedule } from "@/context/ScheduleContext";

export const shiftContextSchema = z.object({
  houseId: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^/]+$/)
    .refine((id) => id !== "." && id !== ".."),
  date: z.iso.date(),
  shift: z.enum(["day", "night"]),
});
export type ShiftContext = z.infer<typeof shiftContextSchema>;

export const notePayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    authorName: z.string().trim().min(1).max(200).optional(),
    text: z.string().trim().min(1).max(1000),
  }),
  z
    .object({
      kind: z.literal("handover"),
      authorName: z.string().trim().min(1).max(200).optional(),
      medication: z.boolean(),
      meals: z.boolean(),
      activities: z.boolean(),
      pending: z
        .array(
          z.object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            text: z.string().trim().min(1).max(300),
          }),
        )
        .max(20)
        .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
      observations: z.string().trim().max(2000),
    })
    .refine(
      (note) =>
        note.medication ||
        note.meals ||
        note.activities ||
        note.pending.length > 0 ||
        note.observations,
    ),
]);
export type NotePayload = z.infer<typeof notePayloadSchema>;
export type ShiftNote = {
  id: string;
  shiftKey: string;
  authorUid: string;
  caregiverId: string | null;
  pendingStatus: Record<string, "open" | "done">;
  revision: number;
  generation: string;
  createdAt: string;
  payload: NotePayload;
};

export function previousScheduledShift(
  schedule: Record<string, Partial<DaySchedule>>,
  current: string,
): string | null {
  const keys = Object.entries(schedule).flatMap(([date, day]) =>
    (["day", "night"] as const)
      .filter((shift) => (day[shift]?.length ?? 0) + (day[`${shift}Extra`]?.length ?? 0) > 0)
      .map((shift) => `${date}:${shift}`),
  );
  return (
    keys
      .filter((key) => key < current)
      .sort()
      .at(-1) ?? null
  );
}
