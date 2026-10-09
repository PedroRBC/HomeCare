import type { Translations } from "../../types";

const errors: Translations["errors"] = {
  houseAccessRepair:
    "Alguns registros antigos de casas precisam de correção de acesso antes de excluir esta conta. Nenhum dado foi excluído. Contate o responsável pelo aplicativo para corrigir esses registros e tente novamente.",
  googleAlreadyLinked: "Esta conta Google já está vinculada a outro usuário",
  alreadyLinkedGoogle: "Esta conta já está vinculada ao Google",
  passwordAlreadySet: "Esta conta já possui senha configurada",
  cannotUnlinkOnly: "Não é possível desvincular o único método de login",
  currentPasswordWrong: "Senha atual incorreta",
  wrongPasswordRetry: "Senha incorreta. Por favor, verifique sua senha e tente novamente.",
  tooManyAttempts: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
  requiresRecentLogin:
    "Esta operação requer autenticação recente. Por favor, faça login novamente.",
  inviteAlreadySent: "Um convite já foi enviado para este email",
  googleUserMismatch: "Confirme com a mesma conta Google usada neste login.",
  noEmailForPassword: "Esta conta não possui email para confirmar a senha.",
  houseNotReady:
    "Os dados da casa ainda não carregaram ou não puderam ser acessados. Verifique sua conexão e tente novamente.",
  ratesUnavailable:
    "Os dados desta cuidadora não podem ser lidos neste aparelho, então ela não pode ser editada nem paga agora.",
  paymentUnresolved:
    "Não foi possível encontrar os plantões deste pagamento, então ele não foi excluído.",
};

export default errors;
