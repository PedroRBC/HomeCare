const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  // Keep inherited theme tokens reactive instead of freezing their :root defaults.
  inlineVariables: {
    exclude: [
      "--app-background",
      "--app-surface",
      "--app-surface-elevated",
      "--app-text",
      "--app-text-secondary",
      "--app-text-muted",
      "--app-border",
      "--app-primary",
      "--app-on-primary",
      "--app-accent",
      "--app-primary-soft",
      "--app-success",
      "--app-success-soft",
      "--app-warning",
      "--app-warning-soft",
      "--app-danger",
      "--app-danger-soft",
      "--app-info",
      "--app-info-soft",
      "--app-overlay",
      "--app-disabled",
    ],
  },
});
