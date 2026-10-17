import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import type { PaymentHistory } from "@/context/ScheduleContext";

let xml = "";
let html = "";
let deleted = 0;
let shared = 0;
mock.module("expo-file-system", () => ({
  Paths: { cache: "cache" },
  File: class {
    uri: string;
    exists = true;
    constructor(...parts: string[]) {
      this.uri = parts.join("/");
    }
    create() {}
    write(contents: string) {
      xml = contents;
    }
    delete() {
      this.exists = false;
      deleted += 1;
    }
  },
}));
mock.module("expo-sharing", () => ({
  shareAsync: async () => {
    shared += 1;
  },
}));
mock.module("expo-print", () => ({
  printToFileAsync: async (options: { html: string }) => {
    html = options.html;
    return { uri: "cache/report.pdf" };
  },
}));
mock.module("i18next", () => ({
  default: { language: "pt" },
  t: (key: string, options?: { amount?: string }) =>
    options?.amount ? `${key}: ${options.amount}` : key,
}));
mock.module("@/i18n/locale", () => ({ currentLocale: () => "pt-BR" }));
mock.module("@/i18n/format", () => ({
  formatMoney: (amount: number) => amount.toFixed(2),
  frequencyLabel: (frequency: string) => frequency,
  localizedDescription: (description: string) => description,
}));
const { exportPaymentHistoryExcel, exportPaymentHistoryPDF } = await import("./exportService");
const payment: PaymentHistory = {
  id: "h1",
  caregiverId: "c1",
  caregiverName: "Test <Caregiver>",
  date: "2026-10-01",
  frequency: "Mensal",
  description: "outubro de 2026",
  amount: 125,
  paidAt: "2026-10-16T12:00:00.000Z",
  paymentKeys: ["day-2026-10-01-2026-10", "day-2026-10-01-additional-2026-10"],
  dayRate: 100,
  additionalRate: 25,
};

beforeEach(() => {
  xml = "";
  html = "";
  deleted = 0;
  shared = 0;
});

test("Excel discriminates snapshots without adding components twice to recorded totals", async () => {
  await exportPaymentHistoryExcel([payment]);
  const summary = xml.split('<Worksheet ss:Name="exportDoc.sheetDetail">')[0];
  const detail = xml.split('<Worksheet ss:Name="exportDoc.sheetDetail">')[1];
  assert.match(summary, /exportDoc.grandTotal<\/Data><\/Cell><Cell><Data ss:Type="Number">125\.00/);
  assert.match(detail, /ss:Type="Number">100\.00/);
  assert.match(detail, /ss:Type="Number">25\.00/);
  assert.match(detail, /ss:Type="Number">125\.00/);
  assert.match(detail, /Test &lt;Caregiver&gt;/);
  assert.equal(shared, 1);
  assert.equal(deleted, 1);
});

test("PDF uses saved composition and leaves legacy rates unknown", async () => {
  await exportPaymentHistoryPDF([payment]);
  assert.match(html, /exportDoc.regularAmount: 100\.00<br\/>exportDoc.additionalAmount: 25\.00/);
  assert.match(html, /exportDoc.totalLine: 125\.00/);
  assert.match(html, /Test &lt;Caregiver&gt;/);
  assert.equal(shared, 1);
  assert.equal(deleted, 1);

  await exportPaymentHistoryPDF([{ ...payment, dayRate: undefined, additionalRate: undefined }]);
  assert.doesNotMatch(html, /exportDoc.regularAmount:/);
  assert.doesNotMatch(html, /exportDoc.additionalAmount:/);
  assert.match(html, /exportDoc.totalLine: 125\.00/);
});

test("locked history cannot be exported or shared", async () => {
  await assert.rejects(exportPaymentHistoryExcel([{ ...payment, locked: true }]));
  await assert.rejects(exportPaymentHistoryPDF([{ ...payment, locked: true }]));
  assert.equal(shared, 0);
  assert.equal(xml, "");
  assert.equal(html, "");
});
