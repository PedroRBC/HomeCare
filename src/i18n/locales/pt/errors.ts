import type { Translations } from "../../types";

const errors: Translations["errors"] = {
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
};

export default errors;
