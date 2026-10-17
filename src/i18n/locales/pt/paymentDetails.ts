import type { Translations } from "../../types";

const paymentDetails: Translations["paymentDetails"] = {
  confirmDelete: "Confirmar Exclusão",
  confirmDeleteMessage:
    "Tem certeza que deseja excluir este pagamento?\n\n{{caregiver}} - {{description}}\n{{amount}}",
  deleteError: "Não foi possível excluir o pagamento. Tente novamente.",
  period: "Período",
  workedDays: "Dias Trabalhados",
  additional: "Adicional",
  legacyExtra: "Extra legado",
  noSpecificDays: "Nenhum dia específico encontrado",
  total: "Valor Total",
  paidOn: "Data do Pagamento",
  delete: "Excluir Pagamento",
};

export default paymentDetails;
