import type { Translations } from "../../types";

const caregiverView: Translations["caregiverView"] = {
  tab: "Meus Plantões",
  title: "Meus Plantões",
  loading: "Carregando seus plantões...",
  noHouse: "Nenhuma casa vinculada",
  noHouseEmail:
    "Peça ao gerente da casa para cadastrar o email {{email}} na sua ficha de cuidadora. Seus plantões aparecerão aqui automaticamente.",
  noHouseNoEmail:
    "Sua conta não tem um email. Entre com uma conta de email para ver seus plantões.",
  acceptToSee: "Aceite um convite para ver seus plantões",
  scheduleOfHouse: "Escala de {{name}}",
  scheduleOfHouses: "Escala de {{count}} casas",
  realtime: "{{schedule}} • atualizada em tempo real",
  inviteFrom: "Convite de {{house}}",
  registeredAs:
    "Você foi cadastrada como cuidadora ({{name}}). Aceite para ver seus plantões desta casa.",
  decline: "Recusar",
  accept: "Aceitar",
  all: "Todas",
  respondError: "Não foi possível responder ao convite. Tente novamente.",
  houseFallback: "Casa",
  loadFailed: "Não foi possível carregar a escala de {{name}}.",
  disabledIn: "Você está desabilitada em {{name}}. Os plantões anteriores continuam visíveis.",
  extras_one: "{{count}} Extra",
  extras_other: "{{count}} Extras",
  upcoming: "Próximos plantões",
  noneOnDay: "Nenhum plantão neste dia.",
  noneUpcoming: "Nenhum plantão agendado a partir de hoje.",
  extraBadge: " · Extra",
  emailLabel: "Email da cuidadora (opcional)",
  emailPlaceholder: "Ex: maria@email.com",
  emailHint:
    "A cuidadora recebe um convite no app e, ao aceitar, vê os próprios plantões desta casa.",
  resend: "Reenviar convite",
  resendError: "Não foi possível reenviar o convite. Tente novamente.",
  emailInvalid: "Email inválido",
  emailTaken: "Este email já está vinculado a {{name}}",
  statusPending: "Convite pendente",
  statusAccepted: "Aceito",
  statusDeclined: "Recusado",
  unavailableTitle: "Cuidadora indisponível",
  unknownTitle: "Disponibilidade não verificada",
  shiftDayWord: "de dia",
  shiftNightWord: "de noite",
  unknownMessage:
    "Não foi possível verificar se {{name}} tem plantão {{shift}} em outra casa nesta data. Deseja escalar mesmo assim?",
  busyMessage:
    "{{name}} já tem plantão {{shift}} em outra casa nesta data. Deseja escalar mesmo assim?",
  scheduleAnyway: "Escalar mesmo assim",
  availabilityUnknown:
    "Não foi possível verificar a disponibilidade das cuidadoras em outras casas.",
  unavailableDay: "Indisponível de dia: trabalha em outra casa neste turno",
  unavailableNight: "Indisponível de noite: trabalha em outra casa neste turno",
  unavailableBoth: "Indisponível de dia e de noite: trabalha em outra casa neste turno",
  shortcutPending_one: "{{count}} convite pendente de cuidadora",
  shortcutPending_other: "{{count}} convites pendentes de cuidadora",
  shortcutHouses_one: "Você é cuidadora em {{count}} casa",
  shortcutHouses_other: "Você é cuidadora em {{count}} casas",
  shortcutHint: "É cuidadora? Veja aqui os plantões que os gerentes cadastrarem para você",
};

export default caregiverView;
