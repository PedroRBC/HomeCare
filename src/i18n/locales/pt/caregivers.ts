import type { Translations } from "../../types";

const caregivers: Translations["caregivers"] = {
  title: "Cuidadoras",
  summaryAll: "{{count}} total",
  summaryActive: "{{count}} ativas",
  summaryDisabled: "{{count}} desabilitadas",
  disabled: "Desabilitada",
  day: "Dia",
  night: "Noite",
  total: "Total",
  additionalAmount: "Adicional por turno",
  showDisabled: "Mostrar Desabilitadas",
  hideDisabled: "Ocultar Desabilitadas",
  none: "Nenhuma cuidadora cadastrada",
  noneHint: "Adicione uma cuidadora para começar",
  add: "Adicionar Cuidadora",
  noneActive: "Nenhuma cuidadora ativa",
  allDisabled: "Todas as cuidadoras estão desabilitadas",
  edit: {
    title: "Editar Cuidadora",
    subtitle: "Modifique as informações da cuidadora",
    notFound: "Cuidadora não encontrada",
    back: "Voltar",
    save: "Salvar Alterações",
    reEnable: "Reabilitar Cuidadora",
    disable: "Desabilitar Cuidadora",
    updateError: "Não foi possível atualizar a cuidadora. Tente novamente.",
    confirmDisable: "Confirmar Desabilitação",
    confirmDisableMessage:
      "Tem certeza que deseja desabilitar {{name}}?\n\nA cuidadora não poderá ser atribuída a novos dias, mas o histórico de pagamentos e dias trabalhados será preservado.",
    disableConfirmButton: "Desabilitar",
    disableError: "Não foi possível desabilitar a cuidadora. Tente novamente.",
    reEnableError: "Não foi possível reabilitar a cuidadora. Tente novamente.",
  },
};

export default caregivers;
