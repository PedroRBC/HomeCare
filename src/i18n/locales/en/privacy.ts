export default {
  consent: {
    title: "Your privacy",
    titleUpdate: "We updated our policy",
    subtitle: "Before continuing, see how we handle your data under the LGPD.",
    subtitleUpdate: "Review and accept the new version to keep using HomeCare.",
    highlightEncryption:
      "Caregiver and payment names and amounts are encrypted (AES-256) on your device before being sent.",
    highlightAccess: "Only the managers of each house can access its data.",
    highlightRights:
      "You can export or delete your data at any time, here or in Settings › Privacy and Data.",
    acceptLabel: "I have read and agree to the Terms of Use and the Privacy Policy",
    acceptBefore: "I have read and agree to the ",
    terms: "Terms of Use",
    acceptAnd: " and the ",
    privacy: "Privacy Policy",
    required: "(required)",
    optional: "Optional",
    optionalHint: "Off by default. You can change them at any time.",
    saveError: "Could not save your choices. Check your connection and try again.",
    continue: "Continue",
    decline: "I don't agree, sign out",
    rightsTitle: "Your data",
    exportLink: "Export my data",
    deleteLink: "Delete my account",
  },
  telemetry: {
    analyticsTitle: "Usage statistics",
    analyticsDescription:
      "Screens visited and actions in the app, without name, email or amounts (Google Analytics).",
    crashTitle: "Error reports",
    crashDescription:
      "Technical information about failures, so we can fix problems (Firebase Crashlytics).",
  },
  center: {
    partialExportTitle: "Data exported with unavailable houses",
    partialExportMessage:
      "Your readable data was exported. {{count}} older house record(s) need access repair and are listed in the file. The export is not complete until these records are repaired.",
    title: "Privacy and Data",
    menuHint: "Consent choices, data export and deletion (LGPD)",
    protectionTitle: "How your data is protected",
    protectionEncryption:
      "Caregiver and payment names and amounts are encrypted with AES-256-GCM on the device, before being sent",
    protectionKeys: "Each house has its own key, available only to the house's managers",
    protectionTls: "All communication with the server uses an encrypted connection (TLS)",
    protectionDeletion: "Deleting a house or the account erases its data and encryption keys",
    consentsTitle: "Consents",
    policies: "Terms and Privacy Policy",
    acceptedOn: "Accepted on {{date}} (version {{version}})",
    rightsTitle: "Your rights (LGPD)",
    export: "Export my data",
    exportHint: "Full copy in JSON: account, houses, caregivers and payments",
    correct: "Correct my data",
    correctHint: "Change your profile name and icon",
    privacyPolicyHint: "Which data we handle, why and with whom",
    dpo: "Contact the Data Protection Officer (DPO)",
    dpoSubject: "LGPD - Data subject request",
    delete: "Delete account and data",
    deleteHint: "Removes your account and the houses you own",
    exportedTitle: "Data exported",
    exportedMessage:
      "Your file includes your account, consents, {{houses}} house(s), {{caregivers}} caregiver(s) and {{payments}} payment(s), in JSON format.",
    exportError: "Could not export your data. Check your connection and try again.",
    consentError:
      "Could not save your choice to your account. Anything you turned off stays off on this device. Please try again.",
  },
};
