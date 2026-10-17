import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import type { PaymentHistory } from "@/context/ScheduleContext";
import type { DataExport } from "@/utils/dataExport";
import { paymentComposition } from "@/utils/paymentHistory";
import i18n, { t as translate } from "i18next";
import { currentLocale } from "@/i18n/locale";
import { formatMoney, frequencyLabel, localizedDescription } from "@/i18n/format";

const t = translate;

type ExportMeta = {
  houseName?: string;
  periodLabel?: string;
  caregiverLabel?: string;
};

type CaregiverSummary = {
  name: string;
  total: number;
  count: number;
};

type MonthSummary = {
  key: string;
  label: string;
  total: number;
  count: number;
};

type ReportSummary = {
  sorted: PaymentHistory[];
  totalAmount: number;
  caregiverRows: CaregiverSummary[];
  monthRows: MonthSummary[];
};

// Exported files hold personal data in plain text, so they only live in the
// cache for as long as the share sheet needs them
async function shareAndDelete(file: File, options: Sharing.SharingOptions): Promise<void> {
  try {
    await Sharing.shareAsync(file.uri, options);
  } finally {
    if (file.exists) file.delete();
  }
}

const formatCurrency = formatMoney;

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(currentLocale());
}

function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  return monthDate.toLocaleDateString(currentLocale(), { month: "long", year: "numeric" });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSummary(history: PaymentHistory[]): ReportSummary {
  if (history.some((entry) => entry.locked)) {
    throw new Error(t("errors.ratesUnavailable"));
  }
  const sorted = [...history].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );

  const totalAmount = sorted.reduce((sum, entry) => sum + entry.amount, 0);
  const caregiverMap: Record<string, CaregiverSummary> = {};
  const monthMap: Record<string, MonthSummary> = {};

  for (const entry of sorted) {
    if (!caregiverMap[entry.caregiverId]) {
      caregiverMap[entry.caregiverId] = {
        name: entry.caregiverName,
        total: 0,
        count: 0,
      };
    }

    caregiverMap[entry.caregiverId].total += entry.amount;
    caregiverMap[entry.caregiverId].count += 1;

    const monthKey = formatMonthKey(new Date(entry.paidAt));
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        key: monthKey,
        label: formatMonthLabel(monthKey),
        total: 0,
        count: 0,
      };
    }

    monthMap[monthKey].total += entry.amount;
    monthMap[monthKey].count += 1;
  }

  const caregiverRows = Object.values(caregiverMap).sort((a, b) => b.total - a.total);
  const monthRows = Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key));

  return {
    sorted,
    totalAmount,
    caregiverRows,
    monthRows,
  };
}

export async function exportPaymentHistoryExcel(
  history: PaymentHistory[],
  meta?: ExportMeta,
): Promise<void> {
  const { sorted, totalAmount, caregiverRows, monthRows } = buildSummary(history);
  const periodLabel = meta?.periodLabel || t("exportDoc.allTime");
  const caregiverLabel = meta?.caregiverLabel || t("exportDoc.allCaregivers");

  const summaryRowsXml = caregiverRows
    .map(
      (row) => `
		<Row>
			<Cell><Data ss:Type="String">${escapeXml(row.name)}</Data></Cell>
			<Cell><Data ss:Type="Number">${row.count}</Data></Cell>
			<Cell><Data ss:Type="Number">${row.total.toFixed(2)}</Data></Cell>
		</Row>`,
    )
    .join("");

  const monthRowsXml = monthRows
    .map(
      (row) => `
		<Row>
			<Cell><Data ss:Type="String">${escapeXml(row.label)}</Data></Cell>
			<Cell><Data ss:Type="Number">${row.count}</Data></Cell>
			<Cell><Data ss:Type="Number">${row.total.toFixed(2)}</Data></Cell>
		</Row>`,
    )
    .join("");

  const detailRowsXml = sorted
    .map((entry) => {
      const composition = paymentComposition(entry);
      const amountCell = (amount?: number) =>
        amount === undefined
          ? "<Cell/>"
          : `<Cell><Data ss:Type="Number">${amount.toFixed(2)}</Data></Cell>`;
      return `
		<Row>
			<Cell><Data ss:Type="String">${escapeXml(formatDate(entry.paidAt))}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(entry.caregiverName)}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(frequencyLabel(entry.frequency))}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(localizedDescription(entry.description))}</Data></Cell>
			${amountCell(composition.regularAmount)}
			${amountCell(composition.additionalAmount)}
			${amountCell(composition.legacyExtraAmount)}
			<Cell><Data ss:Type="Number">${entry.amount.toFixed(2)}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(entry.managerName || "-")}</Data></Cell>
		</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
	xmlns:o="urn:schemas-microsoft-com:office:office"
	xmlns:x="urn:schemas-microsoft-com:office:excel"
	xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
	xmlns:html="http://www.w3.org/TR/REC-html40">
	<Worksheet ss:Name="${escapeXml(t("exportDoc.sheetSummary"))}">
		<Table>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.statementTitle"))}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.house"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(meta?.houseName || "-")}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.period"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(periodLabel)}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.caregiver"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(caregiverLabel)}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.generatedOn"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(new Date().toLocaleString(currentLocale()))}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.grandTotal"))}</Data></Cell><Cell><Data ss:Type="Number">${totalAmount.toFixed(2)}</Data></Cell></Row>
			<Row></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.summaryByCaregiver"))}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.caregiver"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.payments"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.total"))}</Data></Cell></Row>
			${summaryRowsXml}
			<Row></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.summaryByMonth"))}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.month"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.payments"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.total"))}</Data></Cell></Row>
			${monthRowsXml}
		</Table>
	</Worksheet>
	<Worksheet ss:Name="${escapeXml(t("exportDoc.sheetDetail"))}">
		<Table>
			<Row><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.paymentDate"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.caregiver"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.frequency"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.description"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.regularAmount"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.additionalAmount"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.legacyExtraAmount"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.amount"))}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t("exportDoc.registeredBy"))}</Data></Cell></Row>
			${detailRowsXml}
		</Table>
	</Worksheet>
</Workbook>`;

  const name = `${t("exportDoc.fileName")}-${new Date().toISOString().split("T")[0]}`;
  const file = new File(Paths.cache, `${name}.xls`);
  file.create({ overwrite: true });
  file.write(xml);

  await shareAndDelete(file, {
    mimeType: "application/vnd.ms-excel",
    dialogTitle: t("exportDoc.excelDialog"),
    UTI: "com.microsoft.excel.xls",
  });
}

export async function exportPaymentHistoryPDF(
  history: PaymentHistory[],
  meta?: ExportMeta,
): Promise<void> {
  const { sorted, totalAmount, caregiverRows, monthRows } = buildSummary(history);
  const periodLabel = meta?.periodLabel || t("exportDoc.allTime");
  const caregiverLabel = meta?.caregiverLabel || t("exportDoc.allCaregivers");

  const rows = sorted
    .map((entry) => {
      const composition = paymentComposition(entry);
      const breakdown = [
        composition.regularAmount === undefined
          ? ""
          : `${escapeHtml(t("exportDoc.regularAmount"))}: ${formatCurrency(composition.regularAmount)}`,
        composition.additionalAmount === undefined
          ? ""
          : `${escapeHtml(t("exportDoc.additionalAmount"))}: ${formatCurrency(composition.additionalAmount)}`,
        composition.legacyExtraAmount === undefined
          ? ""
          : `${escapeHtml(t("exportDoc.legacyExtraAmount"))}: ${formatCurrency(composition.legacyExtraAmount)}`,
      ]
        .filter(Boolean)
        .join("<br/>");
      return `
		<tr>
			<td>${escapeHtml(formatDate(entry.paidAt))}</td>
			<td>${escapeHtml(entry.caregiverName)}</td>
			<td>${escapeHtml(frequencyLabel(entry.frequency))}</td>
			<td>${escapeHtml(localizedDescription(entry.description))}</td>
			<td>${breakdown}</td>
			<td style="text-align:right">${formatCurrency(entry.amount)}</td>
		</tr>`;
    })
    .join("");

  const summaryRows = caregiverRows
    .map(
      (cg) => `
		<tr>
			<td>${escapeHtml(cg.name)}</td>
			<td style="text-align:center">${cg.count}</td>
			<td style="text-align:right">${formatCurrency(cg.total)}</td>
		</tr>`,
    )
    .join("");

  const monthSummaryRows = monthRows
    .map(
      (month) => `
		<tr>
			<td>${escapeHtml(month.label)}</td>
			<td style="text-align:center">${month.count}</td>
			<td style="text-align:right">${formatCurrency(month.total)}</td>
		</tr>`,
    )
    .join("");

  const html = `
	<html lang="${i18n.language}">
	<head>
		<meta charset="utf-8" />
		<style>
			body { font-family: sans-serif; padding: 24px; color: #222; }
			h1 { color: #059669; margin-bottom: 4px; }
			h2 { color: #333; margin-top: 32px; }
			.subtitle { color: #666; margin-bottom: 24px; }
			table { width: 100%; border-collapse: collapse; font-size: 13px; }
			th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; text-align: left; }
			th { background: #059669; color: white; }
			.total { font-size: 18px; font-weight: bold; color: #059669; margin-top: 16px; }
			.footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
		</style>
	</head>
	<body>
		<h1>HomeCare</h1>
		<p class="subtitle">${t("exportDoc.reportTitle")}${meta?.houseName ? ` — ${escapeHtml(meta.houseName)}` : ""}</p>
		<p class="subtitle">${t("exportDoc.generatedOn")} ${new Date().toLocaleDateString(currentLocale())}</p>
		<p class="subtitle"><strong>${t("exportDoc.period")}:</strong> ${escapeHtml(periodLabel)}</p>
		<p class="subtitle"><strong>${t("exportDoc.caregiver")}:</strong> ${escapeHtml(caregiverLabel)}</p>

		<h2>${t("exportDoc.summaryByCaregiverTitle")}</h2>
		<table>
			<tr><th>${escapeXml(t("exportDoc.caregiver"))}</th><th style="text-align:center">${escapeXml(t("exportDoc.payments"))}</th><th style="text-align:right">${escapeXml(t("exportDoc.total"))}</th></tr>
			${summaryRows}
		</table>

		<h2>${t("exportDoc.summaryByMonthTitle")}</h2>
		<table>
			<tr><th>${escapeXml(t("exportDoc.month"))}</th><th style="text-align:center">${escapeXml(t("exportDoc.payments"))}</th><th style="text-align:right">${escapeXml(t("exportDoc.total"))}</th></tr>
			${monthSummaryRows}
		</table>

		<p class="total">${t("exportDoc.totalLine", { amount: formatCurrency(totalAmount) })}</p>

		<h2>${t("exportDoc.detailedHistory")}</h2>
		<table>
			<tr><th>${escapeHtml(t("exportDoc.date"))}</th><th>${escapeXml(t("exportDoc.caregiver"))}</th><th>${escapeHtml(t("exportDoc.freqShort"))}</th><th>${escapeXml(t("exportDoc.description"))}</th><th>${escapeXml(t("exportDoc.breakdown"))}</th><th style="text-align:right">${escapeXml(t("exportDoc.amount"))}</th></tr>
			${rows}
		</table>

		<p class="footer">${t("exportDoc.footer")}</p>
	</body>
	</html>`;

  const { uri } = await Print.printToFileAsync({ html });

  await shareAndDelete(new File(uri), {
    mimeType: "application/pdf",
    dialogTitle: t("exportDoc.pdfDialog"),
    UTI: "com.adobe.pdf",
  });
}

// Personal data export (LGPD art. 18, V): a JSON file with everything stored about the user
export async function exportPersonalData(data: DataExport): Promise<void> {
  const name = `homecare-meus-dados-${data.exportedAt.split("T")[0]}`;
  const file = new File(Paths.cache, `${name}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));

  await shareAndDelete(file, {
    mimeType: "application/json",
    dialogTitle: t("privacy.center.export"),
    UTI: "public.json",
  });
}
