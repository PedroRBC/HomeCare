import type { Translations } from "../../types";

const payments: Translations["payments"] = {
  title: "Pagamentos",
  subtitle: "Gerencie pagamentos pendentes e futuros",
  pendingTitle: "Pagamentos Pendentes",
  upcomingTitle: "Próximos Pagamentos",
  items_one: "{{count}} item",
  items_other: "{{count}} itens",
  nonePending: "Nenhum pagamento pendente",
  allUpToDate: "Todos os pagamentos estão em dia!",
  noneUpcoming: "Nenhum pagamento futuro",
  nothingScheduled: "Não há pagamentos programados",
  quickActions: "Ações Rápidas",
  markAsPaid: "Marcar como Pago",
  regularAmount: "Turnos",
  additionalAmount: "Adicionais",
  totalAmount: "Total",
  registered: "Pagamento Registrado",
  registeredMessage: "Pagamento de {{name}} registrado com sucesso!",
  registerError: "Não foi possível registrar o pagamento. Tente novamente.",
};

export default payments;
