import type { Translations } from "../../types";

const privacy: Translations["privacy"] = {
  consent: {
    title: "Tu privacidad",
    titleUpdate: "Actualizamos nuestra política",
    subtitle: "Antes de continuar, mira cómo tratamos tus datos según la LGPD.",
    subtitleUpdate: "Revisa y acepta la nueva versión para seguir usando HomeCare.",
    highlightEncryption:
      "Los datos sensibles y textos de notas del turno se cifran en el dispositivo; los metadatos de acceso y horarios pueden permanecer sin cifrar.",
    highlightAccess:
      "Administradores y familia acceden a mensajes. Las entregas clínicas y su clave son exclusivas de cuidadores activos y aceptados de la casa.",
    highlightRights:
      "Puedes exportar tus datos y solicitar la eliminación de la cuenta en Ajustes › Privacidad y Datos. Hay límites para los datos en casas de otras personas y las copias ya realizadas.",
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
      "Eventos de uso con parámetros filtrados para evitar nombres, correos, montos y mensajes personales. Las estadísticas pueden no ser anónimas (Google Analytics).",
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
      "Los datos sensibles de cuidadores y pagos se cifran con AES-256-GCM en tu dispositivo antes del envío. Esto no cubre todos los campos: la información necesaria para invitaciones y acceso a los horarios puede permanecer sin cifrar.",
    protectionKeys:
      "Cada casa tiene claves separadas para datos financieros, mensajes y entregas clínicas. La familia no recibe la clave clínica.",
    protectionTls: "Toda la comunicación con el servidor usa una conexión cifrada (TLS)",
    socialLogin:
      "El inicio de sesión opcional con Facebook puede proporcionar datos básicos de identidad, como nombre y correo, que pueden no estar disponibles. HomeCare no comparte datos de cuidado con Meta, no usa el SDK de Facebook para publicidad ni activa analítica automática mediante él.",
    protectionDeletion:
      "Cuando se completa la eliminación de la cuenta, eliminamos tu cuenta y las casas que posees. En casas de otras personas, se revoca tu acceso, pero algunos vínculos pueden permanecer como rechazados; las copias de seguridad y otras copias pueden persistir.",
    protectionSupport:
      "Los comentarios e informes de problemas voluntarios se almacenan por separado, con acceso para ti y el personal de soporte autorizado. Se incluyen en la exportación de tus datos y se eliminan al borrar la cuenta. No incluyas información de pacientes ni datos médicos.",
    consentsTitle: "Consentimientos",
    policies: "Términos y Política de Privacidad",
    acceptedOn: "Aceptados el {{date}} (versión {{version}})",
    rightsTitle: "Tus derechos (LGPD)",
    export: "Exportar mis datos",
    exportHint: "Copia en JSON: cuenta, casas, cuidadores, pagos, notas e informes enviados",
    correct: "Corregir mis datos",
    correctHint: "Cambiar el nombre y el ícono del perfil",
    privacyPolicyHint: "Qué datos tratamos, por qué y con quién",
    dpo: "Contactar al Encargado de Datos (DPO)",
    dpoSubject: "LGPD - Solicitud del titular",
    delete: "Eliminar cuenta y datos",
    deleteHint: "Elimina tu cuenta y las casas que posees",
    exportedTitle: "Datos exportados",
    exportedMessage:
      "Tu archivo incluye tu cuenta, consentimientos, {{houses}} casa(s), {{caregivers}} cuidador(es) y {{payments}} pago(s), además de tus informes enviados, en formato JSON.",
    exportError: "No se pudieron exportar tus datos. Revisa tu conexión e inténtalo de nuevo.",
    consentError:
      "No se pudo guardar tu elección en la cuenta. Lo que desactivaste sigue desactivado en este dispositivo. Inténtalo de nuevo.",
  },
};

export default privacy;
