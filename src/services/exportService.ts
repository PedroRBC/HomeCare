import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import type { PaymentHistory } from "@/context/ScheduleContext";

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

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  return monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
  const periodLabel = meta?.periodLabel || "Todo período";
  const caregiverLabel = meta?.caregiverLabel || "Todas as cuidadoras";

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
    .map(
      (entry) => `
		<Row>
			<Cell><Data ss:Type="String">${escapeXml(formatDate(entry.paidAt))}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(entry.caregiverName)}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(entry.frequency)}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(entry.description)}</Data></Cell>
			<Cell><Data ss:Type="Number">${entry.amount.toFixed(2)}</Data></Cell>
			<Cell><Data ss:Type="String">${escapeXml(entry.managerName || "-")}</Data></Cell>
		</Row>`,
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
	xmlns:o="urn:schemas-microsoft-com:office:office"
	xmlns:x="urn:schemas-microsoft-com:office:excel"
	xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
	xmlns:html="http://www.w3.org/TR/REC-html40">
	<Worksheet ss:Name="Resumo">
		<Table>
			<Row><Cell><Data ss:Type="String">HomeCare - Extrato de Pagamentos</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Casa</Data></Cell><Cell><Data ss:Type="String">${escapeXml(meta?.houseName || "-")}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Período</Data></Cell><Cell><Data ss:Type="String">${escapeXml(periodLabel)}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Cuidadora</Data></Cell><Cell><Data ss:Type="String">${escapeXml(caregiverLabel)}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Gerado em</Data></Cell><Cell><Data ss:Type="String">${escapeXml(new Date().toLocaleString("pt-BR"))}</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Total geral</Data></Cell><Cell><Data ss:Type="Number">${totalAmount.toFixed(2)}</Data></Cell></Row>
			<Row></Row>
			<Row><Cell><Data ss:Type="String">Resumo por cuidadora</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Cuidadora</Data></Cell><Cell><Data ss:Type="String">Pagamentos</Data></Cell><Cell><Data ss:Type="String">Total</Data></Cell></Row>
			${summaryRowsXml}
			<Row></Row>
			<Row><Cell><Data ss:Type="String">Resumo por mês</Data></Cell></Row>
			<Row><Cell><Data ss:Type="String">Mês</Data></Cell><Cell><Data ss:Type="String">Pagamentos</Data></Cell><Cell><Data ss:Type="String">Total</Data></Cell></Row>
			${monthRowsXml}
		</Table>
	</Worksheet>
	<Worksheet ss:Name="Detalhado">
		<Table>
			<Row><Cell><Data ss:Type="String">Data pagamento</Data></Cell><Cell><Data ss:Type="String">Cuidadora</Data></Cell><Cell><Data ss:Type="String">Frequência</Data></Cell><Cell><Data ss:Type="String">Descrição</Data></Cell><Cell><Data ss:Type="String">Valor</Data></Cell><Cell><Data ss:Type="String">Registrado por</Data></Cell></Row>
			${detailRowsXml}
		</Table>
	</Worksheet>
</Workbook>`;

  const name = `homecare-extrato-${new Date().toISOString().split("T")[0]}`;
  const file = new File(Paths.cache, `${name}.xls`);
  file.create({ overwrite: true });
  file.write(xml);

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/vnd.ms-excel",
    dialogTitle: "Exportar extrato em Excel",
    UTI: "com.microsoft.excel.xls",
  });
}

export async function exportPaymentHistoryPDF(
  history: PaymentHistory[],
  meta?: ExportMeta,
): Promise<void> {
  const { sorted, totalAmount, caregiverRows, monthRows } = buildSummary(history);
  const periodLabel = meta?.periodLabel || "Todo período";
  const caregiverLabel = meta?.caregiverLabel || "Todas as cuidadoras";

  const rows = sorted
    .map(
      (entry) => `
		<tr>
			<td>${escapeHtml(formatDate(entry.paidAt))}</td>
			<td>${escapeHtml(entry.caregiverName)}</td>
			<td>${escapeHtml(entry.frequency)}</td>
			<td>${escapeHtml(entry.description)}</td>
			<td style="text-align:right">${formatCurrency(entry.amount)}</td>
		</tr>`,
    )
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
	<html>
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
		<p class="subtitle">Relatório de Pagamentos${meta?.houseName ? ` — ${escapeHtml(meta.houseName)}` : ""}</p>
		<p class="subtitle">Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
		<p class="subtitle"><strong>Período:</strong> ${escapeHtml(periodLabel)}</p>
		<p class="subtitle"><strong>Cuidadora:</strong> ${escapeHtml(caregiverLabel)}</p>

		<h2>Resumo por Cuidadora</h2>
		<table>
			<tr><th>Cuidadora</th><th style="text-align:center">Pagamentos</th><th style="text-align:right">Total</th></tr>
			${summaryRows}
		</table>

		<h2>Resumo por Mês</h2>
		<table>
			<tr><th>Mês</th><th style="text-align:center">Pagamentos</th><th style="text-align:right">Total</th></tr>
			${monthSummaryRows}
		</table>

		<p class="total">Total: ${formatCurrency(totalAmount)}</p>

		<h2>Histórico Detalhado</h2>
		<table>
			<tr><th>Data</th><th>Cuidadora</th><th>Freq.</th><th>Descrição</th><th style="text-align:right">Valor</th></tr>
			${rows}
		</table>

		<p class="footer">Relatório gerado pelo HomeCare</p>
	</body>
	</html>`;

  const { uri } = await Print.printToFileAsync({ html });

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Exportar relatório de pagamentos",
    UTI: "com.adobe.pdf",
  });
}
