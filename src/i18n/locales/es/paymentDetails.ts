import type { Translations } from "../../types";

const paymentDetails: Translations["paymentDetails"] = {
  confirmDelete: "Confirmar Eliminación",
  confirmDeleteMessage:
    "¿Seguro que quieres eliminar este pago?\n\n{{caregiver}} - {{description}}\n{{amount}}",
  deleteError: "No se pudo eliminar el pago. Inténtalo de nuevo.",
  period: "Período",
  workedDays: "Días Trabajados",
  additional: "Adicional",
  legacyExtra: "Extra legado",
  noSpecificDays: "No se encontró ningún día específico",
  total: "Monto Total",
  paidOn: "Fecha de Pago",
  delete: "Eliminar Pago",
};

export default paymentDetails;
