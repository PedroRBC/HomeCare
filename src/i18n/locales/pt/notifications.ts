import type { Translations } from "../../types";

const notifications: Translations["notifications"] = {
  overdueTitle: "Pagamento em Atraso",
  shifts_one: "{{count}} turno",
  shifts_other: "{{count}} turnos",
  channels: {
    overdue: {
      name: "Pagamentos em Atraso",
      description: "Notificações sobre pagamentos em atraso de cuidadores",
    },
    reminders: {
      name: "Lembretes de Pagamento",
      description: "Lembretes para realizar pagamentos de cuidadores",
    },
    schedule: {
      name: "Lembretes de Agenda",
      description: "Lembretes sobre horários de trabalho dos cuidadores",
    },
    updates: {
      name: "Atualizações do App",
      description: "Notificações sobre atualizações do HomeCare",
    },
    news: { name: "Novidades", description: "Novidades e atualizações do HomeCare" },
    general: { name: "Geral", description: "Notificações gerais do HomeCare" },
  },
  update: {
    required: "Uma nova versão do HomeCare está disponível. Atualize para continuar usando o app.",
    optional: "Uma nova versão do HomeCare está disponível com melhorias e correções.",
    maintenance: "O HomeCare está em manutenção. Por favor, tente novamente em alguns minutos.",
  },
  user: "Usuário",
};

export default notifications;
