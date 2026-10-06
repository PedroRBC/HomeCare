import type { Translations } from "../../types";

const errors: Translations["errors"] = {
  googleAlreadyLinked: "Esta cuenta de Google ya está vinculada a otro usuario",
  alreadyLinkedGoogle: "Esta cuenta ya está vinculada a Google",
  passwordAlreadySet: "Esta cuenta ya tiene una contraseña configurada",
  cannotUnlinkOnly: "No se puede desvincular el único método de inicio de sesión",
  currentPasswordWrong: "La contraseña actual es incorrecta",
  wrongPasswordRetry: "Contraseña incorrecta. Verifica tu contraseña e inténtalo de nuevo.",
  tooManyAttempts: "Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.",
  requiresRecentLogin:
    "Esta operación requiere autenticación reciente. Por favor, inicia sesión de nuevo.",
  inviteAlreadySent: "Ya se envió una invitación a este correo",
  googleUserMismatch: "Confirma con la misma cuenta de Google usada en este inicio de sesión.",
  noEmailForPassword: "Esta cuenta no tiene correo para confirmar la contraseña.",
  houseNotReady:
    "Los datos de la casa aún no se cargaron o no se pudo acceder a ellos. Revisa tu conexión e inténtalo de nuevo.",
  ratesUnavailable:
    "Los datos de esta cuidadora no se pueden leer en este dispositivo, así que no se puede editar ni pagar ahora.",
  paymentUnresolved: "No se encontraron los turnos de este pago, así que no se eliminó.",
};

export default errors;
