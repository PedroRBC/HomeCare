import type { Translations } from "../../types";

const notifications: Translations["notifications"] = {
  overdueTitle: "Pago Atrasado",
  shifts_one: "{{count}} turno",
  shifts_other: "{{count}} turnos",
  channels: {
    overdue: {
      name: "Pagos Atrasados",
      description: "Notificaciones sobre pagos atrasados a cuidadores",
    },
    reminders: {
      name: "Recordatorios de Pago",
      description: "Recordatorios para pagar a los cuidadores",
    },
    schedule: {
      name: "Recordatorios de Agenda",
      description: "Recordatorios sobre los horarios de trabajo de los cuidadores",
    },
    updates: {
      name: "Actualizaciones de la App",
      description: "Notificaciones sobre actualizaciones de HomeCare",
    },
    news: { name: "Novedades", description: "Novedades y actualizaciones de HomeCare" },
    general: { name: "General", description: "Notificaciones generales de HomeCare" },
  },
  update: {
    required: "Hay una nueva versión de HomeCare disponible. Actualiza para seguir usando la app.",
    optional: "Hay una nueva versión de HomeCare disponible con mejoras y correcciones.",
    maintenance: "HomeCare está en mantenimiento. Por favor, inténtalo de nuevo en unos minutos.",
  },
  user: "Usuario",
};

export default notifications;
