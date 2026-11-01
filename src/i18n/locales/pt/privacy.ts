import type { Translations } from "../../types";

const privacy: Translations["privacy"] = {
  consent: {
    title: "Sua privacidade",
    titleUpdate: "Atualizamos nossa política",
    subtitle: "Antes de continuar, veja como tratamos seus dados, conforme a LGPD.",
    subtitleUpdate: "Revise e aceite a nova versão para continuar usando o HomeCare.",
    highlightEncryption:
      "Dados sensíveis e textos das notas do turno são criptografados no aparelho; metadados de acesso e escala podem permanecer em texto claro.",
    highlightAccess:
      "Gerentes e família acessam recados. Passagens clínicas e sua chave são exclusivas de cuidadores aceitos e ativos na casa.",
    highlightRights:
      "Você pode exportar seus dados e solicitar a exclusão da conta no app, em Configurações › Privacidade e Dados. Há limites para dados em casas de terceiros e cópias já feitas.",
    acceptLabel: "Li e concordo com os Termos de Uso e a Política de Privacidade",
    acceptBefore: "Li e concordo com os ",
    terms: "Termos de Uso",
    acceptAnd: " e a ",
    privacy: "Política de Privacidade",
    required: "(obrigatório)",
    optional: "Opcional",
    optionalHint: "Desativados por padrão. Você pode mudar a qualquer momento.",
    saveError: "Não foi possível salvar suas escolhas. Verifique sua conexão e tente novamente.",
    continue: "Continuar",
    decline: "Não concordo, sair da conta",
    rightsTitle: "Seus dados",
    exportLink: "Exportar meus dados",
    deleteLink: "Excluir minha conta",
  },
  telemetry: {
    analyticsTitle: "Estatísticas de uso",
    analyticsDescription:
      "Eventos de uso com parâmetros filtrados para evitar nomes, e-mails, valores e mensagens pessoais. As estatísticas podem não ser anônimas (Google Analytics).",
    crashTitle: "Relatórios de erro",
    crashDescription:
      "Informações técnicas sobre falhas, para corrigirmos problemas (Firebase Crashlytics).",
  },
  center: {
    partialExportTitle: "Dados exportados com casas indisponíveis",
    partialExportMessage:
      "Os dados legíveis foram exportados. {{count}} registro(s) antigo(s) de casas precisam de correção de acesso e estão listados no arquivo. A exportação não estará completa até corrigir esses registros.",
    menuHint: "Consentimentos, exportação e exclusão dos seus dados (LGPD)",
    title: "Privacidade e Dados",
    protectionTitle: "Proteção dos seus dados",
    protectionEncryption:
      "Dados sensíveis de cuidadores e pagamentos são criptografados com AES-256-GCM no aparelho antes do envio. Isso não abrange todos os campos: dados necessários para convites e acesso à escala podem permanecer em texto claro.",
    protectionKeys:
      "Cada casa tem chaves separadas para dados financeiros, recados e passagens clínicas. A família não recebe a chave clínica.",
    protectionTls: "Toda comunicação com o servidor usa conexão criptografada (TLS)",
    socialLogin:
      "O login opcional com Facebook pode fornecer dados básicos de identidade, como nome e email, que podem não estar disponíveis. O HomeCare não compartilha dados de cuidado com a Meta, não usa o SDK do Facebook para publicidade nem ativa analytics automático por ele.",
    protectionDeletion:
      "Após a exclusão da conta ser concluída, removemos sua conta e as casas que você possui. Em casas de terceiros, o acesso é revogado, mas alguns vínculos podem permanecer como recusados; backups e cópias podem persistir.",
    protectionSupport:
      "Feedbacks e relatos de problemas voluntários são armazenados separadamente, com acesso seu e da equipe de suporte autorizada. Eles fazem parte da exportação dos seus dados e são removidos ao excluir a conta. Não inclua informações de pacientes ou dados médicos.",
    consentsTitle: "Consentimentos",
    policies: "Termos e Política de Privacidade",
    acceptedOn: "Aceitos em {{date}} (versão {{version}})",
    rightsTitle: "Seus direitos (LGPD)",
    export: "Exportar meus dados",
    exportHint: "Cópia em JSON: conta, casas, cuidadores, pagamentos, notas e relatos enviados",
    correct: "Corrigir meus dados",
    correctHint: "Alterar nome e ícone do perfil",
    privacyPolicyHint: "Quais dados tratamos, por quê e com quem",
    dpo: "Falar com o Encarregado (DPO)",
    dpoSubject: "LGPD - Solicitação de titular",
    delete: "Excluir conta e dados",
    deleteHint: "Remove sua conta e as casas que você possui",
    exportedTitle: "Dados exportados",
    exportedMessage:
      "Seu arquivo inclui sua conta, consentimentos, {{houses}} casa(s), {{caregivers}} cuidador(es) e {{payments}} pagamento(s), além dos seus relatos enviados, em formato JSON.",
    exportError: "Não foi possível exportar seus dados. Verifique sua conexão e tente novamente.",
    consentError:
      "Não foi possível salvar sua escolha na conta. O que você desativou continua desativado neste aparelho. Tente novamente.",
  },
};

export default privacy;
