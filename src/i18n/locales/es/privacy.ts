import type { Translations } from "../../types";

const privacy: Translations["privacy"] = {
  consent: {
    title: "Tu privacidad",
    titleUpdate: "Actualizamos nuestra política",
    subtitle: "Antes de continuar, mira cómo tratamos tus datos según la LGPD.",
    subtitleUpdate: "Revisa y acepta la nueva versión para seguir usando HomeCare.",
    highlightEncryption:
      "Los nombres y montos de cuidadores y pagos se cifran (AES-256) en tu dispositivo antes de enviarse.",
    highlightAccess: "Solo los administradores de cada casa tienen acceso a sus datos.",
    highlightRights:
      "Puedes exportar o eliminar tus datos cuando quieras, aquí o en Ajustes › Privacidad y Datos.",
    acceptLabel: "He leído y acepto los Términos de Uso y la Política de Privacidad",
    acceptBefore: "He leído y acepto los ",
    terms: "Términos de Uso",
    acceptAnd: " y la ",
    privacy: "Política de Privacidad",
    required: "(obligatorio)",
    optional: "Opcional",
    optionalHint: "Desactivados por defecto. Puedes cambiarlos en cualquier momento.",
    saveError: "No se pudieron guardar tus elecciones. Revisa tu conexión e inténtalo de nuevo.",
    continue: "Continuar",
    decline: "No estoy de acuerdo, cerrar sesión",
    rightsTitle: "Tus datos",
    exportLink: "Exportar mis datos",
    deleteLink: "Eliminar mi cuenta",
  },
  telemetry: {
    analyticsTitle: "Estadísticas de uso",
    analyticsDescription:
      "Pantallas visitadas y acciones en la app, sin nombre, correo ni montos (Google Analytics).",
    crashTitle: "Informes de errores",
    crashDescription:
      "Información técnica sobre fallos, para corregir problemas (Firebase Crashlytics).",
  },
  center: {
    partialExportTitle: "Datos exportados con casas no disponibles",
    partialExportMessage:
      "Se han exportado tus datos legibles. {{count}} registro(s) antiguo(s) de casas necesitan una reparación de acceso y se incluyen en el archivo. La exportación no estará completa hasta reparar estos registros.",
    menuHint: "Consentimientos, exportación y eliminación de tus datos (LGPD)",
    title: "Privacidad y Datos",
    protectionTitle: "Cómo se protegen tus datos",
    protectionEncryption:
      "Los nombres y montos de cuidadores y pagos se cifran con AES-256-GCM en el dispositivo, antes del envío",
    protectionKeys: "Cada casa tiene su propia clave, accesible solo para sus administradores",
    protectionTls: "Toda la comunicación con el servidor usa una conexión cifrada (TLS)",
    protectionDeletion:
      "Al eliminar una casa o la cuenta, se borran los datos y las claves de cifrado",
    consentsTitle: "Consentimientos",
    policies: "Términos y Política de Privacidad",
    acceptedOn: "Aceptados el {{date}} (versión {{version}})",
    rightsTitle: "Tus derechos (LGPD)",
    export: "Exportar mis datos",
    exportHint: "Copia completa en JSON: cuenta, casas, cuidadores y pagos",
    correct: "Corregir mis datos",
    correctHint: "Cambiar el nombre y el ícono del perfil",
    privacyPolicyHint: "Qué datos tratamos, por qué y con quién",
    dpo: "Contactar al Encargado de Datos (DPO)",
    dpoSubject: "LGPD - Solicitud del titular",
    delete: "Eliminar cuenta y datos",
    deleteHint: "Elimina tu cuenta y las casas que posees",
    exportedTitle: "Datos exportados",
    exportedMessage:
      "Tu archivo incluye tu cuenta, consentimientos, {{houses}} casa(s), {{caregivers}} cuidador(es) y {{payments}} pago(s), en formato JSON.",
    exportError: "No se pudieron exportar tus datos. Revisa tu conexión e inténtalo de nuevo.",
    consentError:
      "No se pudo guardar tu elección en la cuenta. Lo que desactivaste sigue desactivado en este dispositivo. Inténtalo de nuevo.",
  },
};

export default privacy;
