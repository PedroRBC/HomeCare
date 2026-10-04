import type { Translations } from "../../types";

const create: Translations["create"] = {
  title: "Nova Cuidadora",
  subtitle: "Adicione uma nova cuidadora ao sistema",
  name: "Nome",
  namePlaceholder: "Ex: Maria Souza",
  frequency: "Frequência",
  dayAmount: "Valor Dia (R$)",
  nightAmount: "Valor Noite (R$)",
  dayPlaceholder: "Ex: 50,00",
  nightPlaceholder: "Ex: 60,00",
  save: "Salvar Cuidadora",
  success: "Sucesso",
  added: "Cuidadora {{name}} adicionada com sucesso!",
  addError: "Não foi possível adicionar a cuidadora. Tente novamente.",
};

export default create;
