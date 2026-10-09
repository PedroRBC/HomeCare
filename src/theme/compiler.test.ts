import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { URL } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { compile } from "react-native-css/compiler";
import { lightColors, themeVariables } from "./palette";

const require = createRequire(import.meta.url);
const config = require("../../metro.config.js");
const options = config.transformer.reactNativeCSS as NonNullable<Parameters<typeof compile>[1]>;
const cssPath = new URL("../../global.css", import.meta.url);
const css = readFileSync(cssPath, "utf8");

// Test the real Tailwind -> native compiler pipeline, not just the provider's input map.
test("Metro preserves every inherited theme token from native compiler inlining", () => {
  assert.notEqual(options.inlineVariables, false);
  const inlineVariables = options.inlineVariables;
  assert.ok(inlineVariables);
  assert.deepEqual(
    [...(inlineVariables.exclude ?? [])].sort(),
    Object.keys(themeVariables(lightColors)).sort(),
  );
});

test("screen and component semantic utilities reference declared color aliases", () => {
  const aliases = new Set([...css.matchAll(/--color-([\w-]+):/g)].map(([, alias]) => alias));
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith(".tsx")) {
        const source = readFileSync(path, "utf8");
        const utilities = source.matchAll(
          /\b(?:bg|text|border|ring)-(?:app|surface|content|muted|subtle|divider|primary|on-primary|accent|success|warning|danger|info|overlay|disabled)[\w/-]*/g,
        );
        for (const [utility] of utilities) {
          const alias = utility.replace(/^(?:bg|text|border|ring)-/, "").split("/")[0];
          assert.ok(aliases.has(alias), `${path}: unknown theme utility ${utility}`);
        }
      }
    }
  };
  for (const directory of ["components", "screens", "router"]) {
    visit(new URL(`../${directory}/`, import.meta.url).pathname);
  }
});

test("semantic native utilities and opacity modifiers retain runtime variable references", async () => {
  const aliases = [...css.matchAll(/--color-([\w-]+): var\((--app-[\w-]+)\)/g)];
  const classes = [
    ...aliases.map(([, alias]) => `bg-${alias}`),
    "text-content",
    "bg-primary-soft/50",
  ];
  const result = await postcss([tailwind()]).process(
    `${css}\n@source inline("${classes.join(" ")}");`,
    { from: cssPath.pathname },
  );
  const sheet = compile(result.css, options).stylesheet();
  const rules = new Map(sheet.s);
  for (const [, alias, variable] of aliases) {
    const utility = `bg-${alias}`;
    assert.ok(rules.has(utility), `${utility} must be generated`);
    assert.ok(
      JSON.stringify(rules.get(utility)).includes(`"${variable.slice(2)}"`),
      `${utility} must read its inherited token at runtime`,
    );
  }
  assert.ok(JSON.stringify(rules.get("text-content")).includes('"app-text"'));
  const opacity = JSON.stringify(rules.get("bg-primary-soft/50"));
  assert.ok(opacity.includes('"app-primary-soft"'));
  assert.ok(opacity.includes('"colorMix"'));

  // Without the exclusion list, :root defaults would silently freeze light-mode colors.
  const frozen = new Map(compile(result.css).stylesheet().s);
  assert.ok(!JSON.stringify(frozen.get("bg-app")).includes('"app-background"'));
});
