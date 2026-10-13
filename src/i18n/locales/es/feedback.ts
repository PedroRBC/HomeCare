import type { Translations } from "../../types";

const feedback: Translations["feedback"] = {
  title: "Enviar comentarios",
  subtitle: "Ayúdanos a mejorar HomeCare",
  back: "Volver",
  typeLabel: "¿Qué te gustaría enviar?",
  typeFeedback: "Comentario",
  typeBug: "Informar de un error",
  titleLabel: "Título",
  titlePlaceholder: "Un breve resumen",
  descriptionLabel: "Descripción",
  descriptionPlaceholder: "Cuéntanos qué ocurrió o qué podría mejorar",
  stepsLabel: "Pasos para reproducirlo (opcional)",
  stepsPlaceholder: "1. Abre…  2. Pulsa…",
  expectedLabel: "Resultado esperado (opcional)",
  expectedPlaceholder: "¿Qué esperabas que ocurriera?",
  actualLabel: "Resultado real (opcional)",
  actualPlaceholder: "¿Qué ocurrió en su lugar?",
  privacyNote:
    "No incluyas información médica de pacientes, contraseñas ni registros técnicos. El texto del informe y datos básicos de la app y el dispositivo se enviarán al equipo de HomeCare.",
  submit: "Enviar informe",
  sending: "Enviando…",
  successTitle: "Informe enviado",
  successMessage: "Gracias. Tu referencia es {{id}}.",
  errorTitle: "No se pudo enviar",
  errorMessage:
    "Comprueba tu conexión e inténtalo de nuevo. No se ha confirmado el envío del informe.",
  signInRequired: "Inicia sesión para enviar un informe.",
  validation: {
    title: "Escribe un título de entre 3 y 120 caracteres.",
    description: "Escribe una descripción de entre 10 y 5.000 caracteres.",
    details: "Este campo es demasiado largo.",
  },
};

export default feedback;
