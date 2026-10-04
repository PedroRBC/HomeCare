import type { DaySchedule, PaymentHistory } from "@/context/ScheduleContext";
import { dateKey, parseCalendarDate } from "@/utils/date";
import { buildPaymentKey, parseExtraPeriodKey, type PaymentFrequency } from "@/utils/paymentDomain";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// Recovers a history entry's period from its description, e.g.
// "Semana de 03/10/2026 a 09/10/2026", "1ª Quinzena de outubro de 2026" or
// "outubro de 2026 (4 Dias)". Only needed for entries saved without `paymentKeys`.
export function periodFromDescription(
  description: string,
): { frequency: PaymentFrequency; start: Date; end: Date } | null {
  const week = description.match(/Semana de (\d{2})\/(\d{2})\/(\d{4}) a (\d{2})\/(\d{2})\/(\d{4})/);
  if (week) {
    const [, d1, m1, y1, d2, m2, y2] = week.map(Number);
    return {
      frequency: "Semanal",
      start: new Date(y1, m1 - 1, d1, 12),
      end: new Date(y2, m2 - 1, d2, 12),
    };
  }

  const month = description.match(/(?:(\d)ª Quinzena de )?([a-zà-ú]+) (?:de )?(\d{4})/i);
  const monthIndex = month ? MONTHS.indexOf(month[2].toLowerCase()) : -1;
  if (!month || monthIndex === -1) return null;

  const [, half, , year] = month;
  const at = (day: number, monthOffset = 0) =>
    new Date(Number(year), monthIndex + monthOffset, day, 12);

  if (half === "1") return { frequency: "Quinzenal", start: at(1), end: at(15) };
  if (half === "2") return { frequency: "Quinzenal", start: at(16), end: at(0, 1) };
  return { frequency: "Mensal", start: at(1), end: at(0, 1) };
}

// Payment keys of an entry saved without `paymentKeys`: the caregiver's shifts
// scheduled within the entry's period. Null when the period can't be recovered.
export function legacyPaymentKeys(
  entry: PaymentHistory,
  scheduleByDay: Record<string, DaySchedule>,
): string[] | null {
  if (entry.frequency === "Diário" || entry.description.includes("Extra")) {
    const extra = entry.periodKey ? parseExtraPeriodKey(entry.periodKey) : null;
    if (!extra) return null;

    const daySchedule = scheduleByDay[extra.dayKey];
    const extras = extra.shift === "day" ? daySchedule?.dayExtra : daySchedule?.nightExtra;
    if (!extras?.includes(entry.caregiverId)) return [];

    const date = parseCalendarDate(extra.dayKey);
    return [
      buildPaymentKey({ date, shift: extra.shift, frequency: "Diário", mode: "daily-extra" }),
    ];
  }

  const period = periodFromDescription(entry.description);
  if (!period) return null;

  const keys: string[] = [];
  for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
    const daySchedule = scheduleByDay[dateKey(d)];
    (["day", "night"] as const).forEach((shift) => {
      if (daySchedule?.[shift]?.includes(entry.caregiverId)) {
        keys.push(buildPaymentKey({ date: d, shift, frequency: period.frequency }));
      }
    });
  }
  return keys;
}
