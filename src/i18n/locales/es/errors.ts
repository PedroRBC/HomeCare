import type { Translations } from "../../types";

const errors: Translations["errors"] = {
  houseAccessRepair:
    "Algunos registros antiguos de casas necesitan una reparación de acceso antes de eliminar esta cuenta. No se ha eliminado ningún dato. Contacta con el responsable de la aplicación para reparar estos registros y vuelve a intentarlo.",
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
  additionalInvalidAmount: "Introduce un adicional válido y no negativo, con hasta dos decimales.",
  additionalAlreadyPaid: "Este adicional ya se pagó. Reviértelo desde el historial de pagos.",
  legacyExtraAlreadyPaid: "Este Extra legado ya se pagó. Reviértelo desde el historial de pagos.",
  additionalRegularRequired: "Selecciona un turno regular antes de añadir un adicional.",
  additionalCaregiverUnavailable:
    "Esta cuidadora está deshabilitada o no tiene un importe adicional configurado.",
  additionalPending:
    "Elimina o paga los adicionales pendientes antes de poner el importe adicional a cero.",
  additionalReversalRequiresAmount:
    "Configura un importe adicional mayor que cero para esta cuidadora antes de revertir este pago.",
  additionalScheduleChanged:
    "El horario o las tarifas cambiaron. Actualiza antes de registrar este pago.",
  providerSyncFailed:
    "El método de inicio de sesión cambió, pero no se pudo actualizar la lista de seguridad de la cuenta. Vuelve a abrir esta pantalla e inténtalo de nuevo.",
  providerOperationInProgress:
    "Ya hay una operación de inicio de sesión en curso. Espera e inténtalo de nuevo.",
  providerNotLinked: "Este método de inicio de sesión no está vinculado a tu cuenta.",
  socialCredentialInvalid: "No se pudo verificar ese inicio de sesión social. Inténtalo de nuevo.",
  socialUserMismatch: "Usa la misma cuenta social vinculada actualmente a HomeCare.",
  facebookAlreadyLinked: "Esta cuenta de Facebook ya está vinculada a otro usuario.",
  alreadyLinkedFacebook: "Esta cuenta ya está vinculada a Facebook",
};

export default errors;
