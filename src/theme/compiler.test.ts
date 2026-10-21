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

test("native typography utilities use the Inter fonts actually loaded by the app", async () => {
  const result = await postcss([tailwind()]).process(
    `${css}\n@source inline("font-heading font-subtitle font-body");`,
    { from: cssPath.pathname },
  );
  const rules = new Map(compile(result.css, options).stylesheet().s);
  for (const [utility, family] of [
    ["font-heading", "Inter_700Bold"],
    ["font-subtitle", "Inter_500Medium"],
    ["font-body", "Inter_400Regular"],
  ]) {
    assert.ok(
      (JSON.stringify(rules.get(utility)) ?? "").includes(family),
      `${utility} must use ${family}`,
    );
  }
});

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
          /\b(?:bg|text|border|ring)-(?:app|surface|content|muted|subtle|divider|primary|on-primary|accent|success|warning|danger|info|night|overlay|disabled)[\w/-]*/g,
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

test("Metro's native CSS transform applies the exclusion list", async () => {
  // Run the transformer Metro loads, so options that never reach the compiler fail here.
  const { getTransformOptions, transformVariants, unstable_workerThreads, ...transformerConfig } =
    config.transformer;
  const { transform } = require(config.transformerPath);
  const result = await transform(transformerConfig, config.projectRoot, "global.css", css, {
    dev: false,
    hot: false,
    minify: false,
    platform: "android",
    type: "module",
    unstable_transformProfile: "default",
    customTransformOptions: {},
    inlineRequires: false,
    experimentalImportSupport: false,
    inlinePlatform: true,
    unstable_disableES6Transforms: false,
    nonInlinedRequires: [],
  });
  const code: string = result.output[0].data.code;
  // Tailwind only emits utilities the app uses; check every emitted semantic color utility.
  const aliases = new Map(
    [...css.matchAll(/--color-([\w-]+): var\(--(app-[\w-]+)\)/g)].map(([, a, v]) => [a, v]),
  );
  const emitted = [...code.matchAll(/\["(?:bg|text|border)-([\w-]+)", \[\{/g)].filter(([, alias]) =>
    aliases.has(alias),
  );
  const names = emitted.map(([utility]) => utility);
  for (const utility of ['["bg-app",', '["bg-surface",', '["text-content",']) {
    assert.ok(
      names.some((name) => name.startsWith(utility)),
      `${utility} must be bundled`,
    );
  }
  for (const { 0: utility, 1: alias, index } of emitted) {
    const rule = code.slice(index, code.indexOf("}]]", index));
    assert.ok(rule.includes(`"${aliases.get(alias)}"`), `${utility} froze its :root value`);
  }
});
