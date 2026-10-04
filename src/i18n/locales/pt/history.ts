import type { Translations } from "../../types";

const history: Translations["history"] = {
  title: "Histórico",
  subtitle: "Pagamentos realizados e histórico de transações",
  exportExcel: "Exportar extrato como Excel",
  exportPdf: "Exportar extrato como PDF",
  filterCaregiver: "Filtrar por cuidadora",
  filterPeriod: "Filtrar por período",
  all: "Todas",
  allCaregivers: "Todas as cuidadoras",
  selectedCaregiver: "Cuidadora selecionada",
  allTime: "Todo período",
  lastWeek: "Última semana",
  last30: "Últimos 30 dias",
  last90: "Últimos 90 dias",
  thisMonth: "Este mês",
  lastMonth: "Mês passado",
  selectedPeriod: "Período selecionado",
  totalPaid: "Total pago",
  noneFound: "Nenhum pagamento encontrado",
  noneYet:
    "Você ainda não realizou nenhum pagamento. Os pagamentos aparecerão aqui após serem marcados como pagos.",
  noneFiltered:
    "Nenhum pagamento encontrado com os filtros selecionados. Tente ajustar os filtros.",
  paidBy: "Pago por {{name}}",
  dateAt: "{{date}} às {{time}}",
  exportExcelError: "Não foi possível exportar o extrato em Excel. Tente novamente.",
  exportPdfError: "Não foi possível gerar o relatório PDF. Tente novamente.",
};

export default history;
