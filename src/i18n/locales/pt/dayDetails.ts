import type { Translations } from "../../types";

const dayDetails: Translations["dayDetails"] = {
  subtitle: "Defina quem trabalha nesse dia",
  disabled: "Desabilitada",
  dayShift: "Turno Dia",
  nightShift: "Turno Noite",
  extra: "Extra legado",
  legacyExtraMessage:
    "Este é um Extra legado. Cancele pelo botão Extra legado; ele não será convertido em turno regular nem em adicional.",
  additional: "Adicional",
  additionalUnavailable:
    "Configure um valor adicional no cadastro da cuidadora para adicioná-lo aqui.",
  additionalTotal: "{{regular}} + {{additional}} = {{total}}",
  additionalPaid: "Este adicional já foi pago. Faça o estorno pelo histórico de pagamentos.",
  additionalRequiresRegular: "Selecione o turno regular antes de adicionar um adicional.",
  toggleError: "Não foi possível alterar o turno. Tente novamente.",
  back: "Voltar",
};

export default dayDetails;
