// Quick picks and defaults; the first is the brand primary
export const HOUSE_COLORS = [
  "#2E5BDE",
  "#C2410C",
  "#047857",
  "#7C3AED",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
  "#B91C1C",
];

const DARK_TEXT = "#172B4D";
const HEX = /^#[0-9A-F]{6}$/;

// "#abc123", "abc123" or "#ABC" as "#ABC123"; null when not a color
export function normalizeHex(input: string) {
  let hex = input.trim().toUpperCase().replace(/^#?/, "#");
  if (/^#[0-9A-F]{3}$/.test(hex)) hex = `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  return HEX.test(hex) ? hex : null;
}

// Chosen color of each house, or a different default by position
export function houseColorMap(houseIds: string[], chosen: Record<string, string>) {
  return Object.fromEntries(
    houseIds.map((id, i) => [
      id,
      HEX.test(chosen[id] ?? "") ? chosen[id] : HOUSE_COLORS[i % HOUSE_COLORS.length],
    ]),
  );
}

// Colors of the distinct houses of a day, in the houses' order
export function dayHouseColors(dayHouseIds: string[], colorByHouse: Record<string, string>) {
  return Object.keys(colorByHouse)
    .filter((id) => dayHouseIds.includes(id))
    .map((id) => colorByHouse[id]);
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// White or dark text, whichever stays most readable over every fill of the cell. When
// neither does (e.g. a dark and a light half), an outline in the other color keeps it legible.
export function readableTextOn(fills: string[]) {
  const worst = (text: string) => Math.min(...fills.map((fill) => contrast(text, fill)));
  const [color, other] =
    worst("#FFFFFF") >= worst(DARK_TEXT) ? ["#FFFFFF", DARK_TEXT] : [DARK_TEXT, "#FFFFFF"];
  return worst(color) >= 3
    ? { color }
    : {
        color,
        textShadowColor: other,
        textShadowRadius: 3,
        textShadowOffset: { width: 0, height: 0 },
      };
}

export type Hsl = { h: number; s: number; l: number }; // h 0-360, s and l 0-100

export function hslToHex({ h, s, l }: Hsl) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: Math.round((h * 60 + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
