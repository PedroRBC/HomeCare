export type ThemeScheme = "light" | "dark";

export const lightColors = {
  background: "#F3F6FC",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  text: "#172B4D",
  textSecondary: "#68768C",
  textMuted: "#68768C",
  border: "#DFE6F1",
  primary: "#2E5BDE",
  onPrimary: "#FFFFFF",
  accent: "#2E5BDE",
  primarySoft: "#E8EEFE",
  success: "#137A48",
  successSoft: "#E6F5EC",
  warning: "#946000",
  warningSoft: "#FFF3D6",
  danger: "#BF3030",
  dangerSoft: "#FDEBEC",
  info: "#245BBB",
  infoSoft: "#E8F0FE",
  night: "#6A5899",
  nightSoft: "#EEEAF7",
  overlay: "rgba(15, 23, 42, 0.6)",
  disabled: "#DFE6F1",
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  background: "#101827",
  surface: "#182337",
  surfaceElevated: "#223047",
  text: "#EDF2FC",
  textSecondary: "#A9B6CC",
  textMuted: "#92A1BB",
  border: "#35445E",
  primary: "#2E5BDE",
  onPrimary: "#FFFFFF",
  accent: "#8BAAFF",
  primarySoft: "#22365D",
  success: "#6CDBA3",
  successSoft: "#163D30",
  warning: "#F3C66C",
  warningSoft: "#45371C",
  danger: "#FF9C9C",
  dangerSoft: "#482C36",
  info: "#94BFFF",
  infoSoft: "#243A5B",
  night: "#B9A6F5",
  nightSoft: "#2C2645",
  overlay: "rgba(0, 0, 0, 0.7)",
  disabled: "#35445E",
};

export const palettes: Record<ThemeScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

// Tailwind's semantic aliases point to these inherited runtime variables.
export const themeVariables = (colors: ThemeColors): Record<`--app-${string}`, string> =>
  Object.fromEntries(
    Object.entries(colors).map(([name, value]) => [
      `--app-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  );
