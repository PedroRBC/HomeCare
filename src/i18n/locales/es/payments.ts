import type { Translations } from "../../types";

const payments: Translations["payments"] = {
  title: "Pagos",
  subtitle: "Gestiona los pagos pendientes y futuros",
  pendingTitle: "Pagos Pendientes",
  upcomingTitle: "Próximos Pagos",
  items_one: "{{count}} elemento",
  items_other: "{{count}} elementos",
  nonePending: "Ningún pago pendiente",
  allUpToDate: "¡Todos los pagos están al día!",
  noneUpcoming: "Ningún pago futuro",
  nothingScheduled: "No hay pagos programados",
  quickActions: "Acciones Rápidas",
  markAsPaid: "Marcar como Pagado",
  regularAmount: "Turnos",
  additionalAmount: "Adicionales",
  totalAmount: "Total",
  registered: "Pago Registrado",
  registeredMessage: "¡Pago de {{name}} registrado con éxito!",
  registerError: "No se pudo registrar el pago. Inténtalo de nuevo.",
};

export default payments;
