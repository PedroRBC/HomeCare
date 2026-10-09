import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { darkColors, lightColors, palettes, themeVariables } from "./palette";

const luminance = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string) => {
  const pair = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (pair[0] + 0.05) / (pair[1] + 0.05);
};

const css = readFileSync(new URL("../../global.css", import.meta.url), "utf8");

describe("semantic palette", () => {
  test("preserves the supplied Figma light colors and the solid brand action", () => {
    assert.equal(lightColors.background, "#F3F6FC");
    assert.equal(lightColors.surface, "#FFFFFF");
    assert.equal(lightColors.text, "#172B4D");
    assert.equal(lightColors.textSecondary, "#68768C");
    assert.equal(lightColors.border, "#DFE6F1");
    assert.equal(lightColors.primarySoft, "#E8EEFE");
    for (const colors of Object.values(palettes)) {
      assert.equal(colors.primary, "#2E5BDE");
      assert.equal(colors.onPrimary, "#FFFFFF");
    }
    assert.equal(darkColors.accent, "#8BAAFF");
    assert.equal(darkColors.primarySoft, "#22365D");
  });

  for (const [scheme, colors] of Object.entries(palettes)) {
    test(`${scheme}: content and branded action text meet WCAG AA`, () => {
      for (const background of [colors.background, colors.surface, colors.surfaceElevated]) {
        assert.ok(contrast(colors.text, background) >= 4.5);
      }
      assert.ok(contrast(colors.onPrimary, colors.primary) >= 4.5);
      assert.ok(contrast(colors.accent, colors.primarySoft) >= 4.5);
      assert.ok(contrast(colors.textSecondary, colors.surface) >= 4.5);
      assert.ok(contrast(colors.textMuted, colors.surface) >= 4.5);
    });

    test(`${scheme}: status labels are readable on their paired soft surfaces`, () => {
      for (const role of ["success", "warning", "danger", "info"] as const) {
        assert.ok(contrast(colors[role], colors[`${role}Soft`]) >= 4.5);
        assert.ok(contrast(colors[role], colors.surface) >= 4.5);
      }
    });

    test(`${scheme}: every inline color has an identical runtime CSS variable`, () => {
      const variables = themeVariables(colors);
      assert.equal(Object.keys(variables).length, Object.keys(colors).length);
      for (const [name, value] of Object.entries(colors)) {
        const variable = `--app-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        assert.equal(variables[variable as keyof typeof variables], value);
      }
    });
  }

  test("every Tailwind color alias is backed by a runtime palette variable", () => {
    const variables = themeVariables(lightColors);
    const aliases = [...css.matchAll(/--color-([\w-]+): var\((--app-[\w-]+)\)/g)];
    assert.equal(aliases.length, Object.keys(variables).length);
    for (const [, , variable] of aliases) {
      assert.ok(Object.hasOwn(variables, variable));
    }
  });

  test("CSS runtime defaults match the light palette before a provider mounts", () => {
    const root = /:root\s*\{([^}]+)\}/.exec(css)?.[1];
    assert.ok(root);
    const defaults = Object.fromEntries(
      [...root.matchAll(/(--app-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
        name,
        value.trim(),
      ]),
    );
    const normalized = (values: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(values).map(([name, value]) => [name, value.toLowerCase()]),
      );
    assert.deepEqual(normalized(defaults), normalized(themeVariables(lightColors)));
  });
});
