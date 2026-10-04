import type { Translations } from "../../types";

const caregivers: Translations["caregivers"] = {
  title: "Cuidadoras",
  summaryAll: "{{count}} en total",
  summaryActive: "{{count}} activas",
  summaryDisabled: "{{count}} deshabilitadas",
  disabled: "Deshabilitada",
  day: "Día",
  night: "Noche",
  total: "Total",
  showDisabled: "Mostrar Deshabilitadas",
  hideDisabled: "Ocultar Deshabilitadas",
  none: "Ninguna cuidadora registrada",
  noneHint: "Agrega una cuidadora para empezar",
  add: "Agregar Cuidadora",
  noneActive: "Ninguna cuidadora activa",
  allDisabled: "Todas las cuidadoras están deshabilitadas",
  edit: {
    title: "Editar Cuidadora",
    subtitle: "Modifica la información de la cuidadora",
    notFound: "Cuidadora no encontrada",
    back: "Volver",
    save: "Guardar Cambios",
    reEnable: "Rehabilitar Cuidadora",
    disable: "Deshabilitar Cuidadora",
    updateError: "No se pudo actualizar la cuidadora. Inténtalo de nuevo.",
    confirmDisable: "Confirmar Deshabilitación",
    confirmDisableMessage:
      "¿Seguro que quieres deshabilitar a {{name}}?\n\nLa cuidadora no podrá asignarse a nuevos días, pero se conservará el historial de pagos y de días trabajados.",
    disableConfirmButton: "Deshabilitar",
    disableError: "No se pudo deshabilitar la cuidadora. Inténtalo de nuevo.",
    reEnableError: "No se pudo rehabilitar la cuidadora. Inténtalo de nuevo.",
  },
};

export default caregivers;
