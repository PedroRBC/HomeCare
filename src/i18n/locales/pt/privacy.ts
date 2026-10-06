import type { Translations } from "../../types";

const privacy: Translations["privacy"] = {
  consent: {
    title: "Sua privacidade",
    titleUpdate: "Atualizamos nossa política",
    subtitle: "Antes de continuar, veja como tratamos seus dados, conforme a LGPD.",
    subtitleUpdate: "Revise e aceite a nova versão para continuar usando o HomeCare.",
    highlightEncryption:
      "Nomes e valores de cuidadores e pagamentos são criptografados (AES-256) no seu aparelho antes de serem enviados.",
    highlightAccess: "Somente os gerentes de cada casa têm acesso aos dados dela.",
    highlightRights:
      "Você pode exportar ou excluir seus dados quando quiser, aqui ou em Configurações › Privacidade e Dados.",
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
      "Telas visitadas e ações no app, sem nome, email ou valores (Google Analytics).",
    crashTitle: "Relatórios de erro",
    crashDescription:
      "Informações técnicas sobre falhas, para corrigirmos problemas (Firebase Crashlytics).",
  },
  center: {
    menuHint: "Consentimentos, exportação e exclusão dos seus dados (LGPD)",
    title: "Privacidade e Dados",
    protectionTitle: "Proteção dos seus dados",
    protectionEncryption:
      "Nomes e valores de cuidadores e pagamentos são criptografados com AES-256-GCM no aparelho, antes do envio",
    protectionKeys: "Cada casa tem sua própria chave, acessível somente aos gerentes da casa",
    protectionTls: "Toda comunicação com o servidor usa conexão criptografada (TLS)",
    protectionDeletion:
      "Ao excluir uma casa ou a conta, os dados e as chaves de criptografia são apagados",
    consentsTitle: "Consentimentos",
    policies: "Termos e Política de Privacidade",
    acceptedOn: "Aceitos em {{date}} (versão {{version}})",
    rightsTitle: "Seus direitos (LGPD)",
    export: "Exportar meus dados",
    exportHint: "Cópia completa em JSON: conta, casas, cuidadores e pagamentos",
    correct: "Corrigir meus dados",
    correctHint: "Alterar nome e ícone do perfil",
    privacyPolicyHint: "Quais dados tratamos, por quê e com quem",
    dpo: "Falar com o Encarregado (DPO)",
    dpoSubject: "LGPD - Solicitação de titular",
    delete: "Excluir conta e dados",
    deleteHint: "Remove sua conta e as casas que você possui",
    exportedTitle: "Dados exportados",
    exportedMessage:
      "Seu arquivo inclui sua conta, consentimentos, {{houses}} casa(s), {{caregivers}} cuidador(es) e {{payments}} pagamento(s), em formato JSON.",
    exportError: "Não foi possível exportar seus dados. Verifique sua conexão e tente novamente.",
    consentError:
      "Não foi possível salvar sua escolha na conta. O que você desativou continua desativado neste aparelho. Tente novamente.",
  },
};

export default privacy;
