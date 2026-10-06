import type { Translations } from "../../types";

const history: Translations["history"] = {
  title: "Historial",
  subtitle: "Pagos realizados e historial de transacciones",
  exportExcel: "Exportar extracto como Excel",
  exportPdf: "Exportar extracto como PDF",
  filterCaregiver: "Filtrar por cuidadora",
  filterPeriod: "Filtrar por período",
  all: "Todas",
  allCaregivers: "Todas las cuidadoras",
  selectedCaregiver: "Cuidadora seleccionada",
  allTime: "Todo el período",
  lastWeek: "Última semana",
  last30: "Últimos 30 días",
  last90: "Últimos 90 días",
  thisMonth: "Este mes",
  lastMonth: "Mes pasado",
  selectedPeriod: "Período seleccionado",
  totalPaid: "Total pagado",
  noneFound: "No se encontraron pagos",
  noneYet:
    "Aún no has realizado ningún pago. Los pagos aparecerán aquí después de marcarse como pagados.",
  noneFiltered:
    "No se encontraron pagos con los filtros seleccionados. Intenta ajustar los filtros.",
  paidBy: "Pagado por {{name}}",
  dateAt: "{{date}} a las {{time}}",
  exportExcelError: "No se pudo exportar el extracto a Excel. Inténtalo de nuevo.",
  exportPdfError: "No se pudo generar el informe PDF. Inténtalo de nuevo.",
};

export default history;
