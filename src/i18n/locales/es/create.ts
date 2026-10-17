import type { Translations } from "../../types";

const create: Translations["create"] = {
  title: "Nueva Cuidadora",
  subtitle: "Agrega una nueva cuidadora al sistema",
  name: "Nombre",
  namePlaceholder: "Ej: María Souza",
  frequency: "Frecuencia",
  dayAmount: "Tarifa Día (R$)",
  nightAmount: "Tarifa Noche (R$)",
  dayPlaceholder: "Ej: 50,00",
  nightPlaceholder: "Ej: 60,00",
  additionalAmount: "Adicional por turno (R$)",
  additionalPlaceholder: "Opcional",
  additionalHint:
    "Para festivos, bonificaciones y otras situaciones. Déjalo vacío o introduce cero para no configurarlo.",
  additionalInvalid: "Introduce un valor no negativo con hasta dos decimales.",
  save: "Guardar Cuidadora",
  success: "Éxito",
  added: "¡Cuidadora {{name}} agregada con éxito!",
  addError: "No se pudo agregar la cuidadora. Inténtalo de nuevo.",
};

export default create;
