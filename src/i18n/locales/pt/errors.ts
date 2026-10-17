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
  additionalInvalidAmount:
    "Informe um adicional válido e não negativo, com até duas casas decimais.",
  additionalAlreadyPaid: "Este adicional já foi pago. Faça o estorno pelo histórico de pagamentos.",
  legacyExtraAlreadyPaid:
    "Este Extra legado já foi pago. Faça o estorno pelo histórico de pagamentos.",
  additionalRegularRequired: "Selecione um turno regular antes de adicionar um adicional.",
  additionalCaregiverUnavailable:
    "Esta cuidadora está desabilitada ou não tem valor adicional configurado.",
  additionalPending: "Remova ou pague os adicionais pendentes antes de zerar o valor adicional.",
  additionalScheduleChanged:
    "A escala ou os valores mudaram. Atualize antes de registrar este pagamento.",
  providerSyncFailed:
    "O método de login mudou, mas a lista de segurança da conta não pôde ser atualizada. Reabra esta tela e tente novamente.",
  providerOperationInProgress:
    "Já existe uma operação de login em andamento. Aguarde e tente novamente.",
  providerNotLinked: "Este método de login não está vinculado à sua conta.",
  socialCredentialInvalid: "Não foi possível verificar esse login social. Tente novamente.",
  socialUserMismatch: "Use a mesma conta social atualmente vinculada ao HomeCare.",
  facebookAlreadyLinked: "Esta conta do Facebook já está vinculada a outro usuário.",
  alreadyLinkedFacebook: "Esta conta já está vinculada ao Facebook",
};

export default errors;
