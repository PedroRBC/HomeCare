import type { Translations } from "../../types";

const dayDetails: Translations["dayDetails"] = {
  subtitle: "Define quién trabaja este día",
  disabled: "Deshabilitada",
  dayShift: "Turno de Día",
  nightShift: "Turno de Noche",
  extra: "Extra legado",
  legacyExtraMessage:
    "Este es un Extra legado. Cancélalo con el botón Extra legado; no se convertirá en un turno regular ni en un adicional.",
  additional: "Adicional",
  additionalUnavailable:
    "Configura un importe adicional en el perfil de la cuidadora para añadirlo aquí.",
  additionalTotal: "{{regular}} + {{additional}} = {{total}}",
  additionalPaid: "Este adicional ya se pagó. Reviértelo desde el historial de pagos.",
  additionalRequiresRegular: "Selecciona el turno regular antes de añadir un adicional.",
  toggleError: "No se pudo cambiar el turno. Inténtalo de nuevo.",
  back: "Volver",
};

export default dayDetails;
