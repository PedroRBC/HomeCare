export default {
  consent: {
    title: "Your privacy",
    titleUpdate: "We updated our policy",
    subtitle: "Before continuing, see how we handle your data under the LGPD.",
    subtitleUpdate: "Review and accept the new version to keep using HomeCare.",
    highlightEncryption:
      "Sensitive data and shift-note text are encrypted on your device; access and schedule metadata may remain unencrypted.",
    highlightAccess:
      "Managers and family can read messages. Clinical handovers and their key are restricted to active, accepted caregivers of the house.",
    highlightRights:
      "You can export your data and request account deletion in Settings › Privacy and Data. Limits apply to data in other people's houses and copies already made.",
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
      "Usage events with parameters filtered to avoid names, emails, amounts and personal messages. Statistics may not be anonymous (Google Analytics).",
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
      "Sensitive caregiver and payment data is encrypted with AES-256-GCM on your device before being sent. This does not cover every field: information needed for invitations and schedule access may remain unencrypted.",
    protectionKeys:
      "Each house has separate keys for financial data, messages and clinical handovers. Family does not receive the clinical key.",
    protectionTls: "All communication with the server uses an encrypted connection (TLS)",
    socialLogin:
      "Optional Facebook login may provide basic identity information such as your name and email, which may be unavailable. HomeCare does not share care data with Meta, use the Facebook SDK for advertising, or enable automatic analytics through it.",
    protectionDeletion:
      "After account deletion completes, we remove your account and the houses you own. In other people's houses, access is revoked, but some links may remain marked as declined; backups and copies may persist.",
    protectionSupport:
      "Voluntary feedback and bug reports are stored separately, accessible to you and approved support staff. They are included in your data export and removed when you delete your account. Do not include patient or medical information.",
    consentsTitle: "Consents",
    policies: "Terms and Privacy Policy",
    acceptedOn: "Accepted on {{date}} (version {{version}})",
    rightsTitle: "Your rights (LGPD)",
    export: "Export my data",
    exportHint: "JSON copy: account, houses, caregivers, payments, notes and submitted reports",
    correct: "Correct my data",
    correctHint: "Change your profile name and icon",
    privacyPolicyHint: "Which data we handle, why and with whom",
    dpo: "Contact the Data Protection Officer (DPO)",
    dpoSubject: "LGPD - Data subject request",
    delete: "Delete account and data",
    deleteHint: "Removes your account and the houses you own",
    exportedTitle: "Data exported",
    exportedMessage:
      "Your file includes your account, consents, {{houses}} house(s), {{caregivers}} caregiver(s) and {{payments}} payment(s), plus your submitted reports, in JSON format.",
    exportError: "Could not export your data. Check your connection and try again.",
    consentError:
      "Could not save your choice to your account. Anything you turned off stays off on this device. Please try again.",
  },
};
