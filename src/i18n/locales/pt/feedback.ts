import type { Translations } from "../../types";

const feedback: Translations["feedback"] = {
  title: "Enviar feedback",
  subtitle: "Ajude-nos a melhorar o HomeCare",
  back: "Voltar",
  typeLabel: "O que você gostaria de enviar?",
  typeFeedback: "Sugestão",
  typeBug: "Relatar um problema",
  titleLabel: "Título",
  titlePlaceholder: "Um breve resumo",
  descriptionLabel: "Descrição",
  descriptionPlaceholder: "Conte o que aconteceu ou o que poderia melhorar",
  stepsLabel: "Etapas para reproduzir (opcional)",
  stepsPlaceholder: "1. Abra…  2. Toque em…",
  expectedLabel: "Resultado esperado (opcional)",
  expectedPlaceholder: "O que você esperava que acontecesse?",
  actualLabel: "Resultado obtido (opcional)",
  actualPlaceholder: "O que aconteceu?",
  privacyNote:
    "Não inclua informações médicas de pacientes, senhas ou registros técnicos. O texto do relato e dados básicos do app e dispositivo serão enviados à equipe HomeCare.",
  submit: "Enviar relato",
  sending: "Enviando…",
  successTitle: "Relato enviado",
  successMessage: "Obrigado. Sua referência é {{id}}.",
  errorTitle: "Não foi possível enviar",
  errorMessage: "Verifique sua conexão e tente novamente. O envio do relato não foi confirmado.",
  signInRequired: "Entre na sua conta para enviar um relato.",
  validation: {
    title: "Digite um título entre 3 e 120 caracteres.",
    description: "Digite uma descrição entre 10 e 5.000 caracteres.",
    details: "Este campo é muito longo.",
  },
};

export default feedback;
