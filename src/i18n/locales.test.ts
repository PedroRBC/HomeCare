import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "./locales/en";
import pt from "./locales/pt";
import es from "./locales/es";
import { matchSupportedLanguage } from "./locale";

const flatten = (obj: object, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );

const enKeys = flatten(en).sort();

test("every locale has exactly the same keys as English", () => {
  assert.deepEqual(flatten(pt).sort(), enKeys);
  assert.deepEqual(flatten(es).sort(), enKeys);
});

test("interpolation placeholders match across languages", () => {
  const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
  const get = (obj: any, key: string) => key.split(".").reduce((o, k) => o[k], obj) as string;
  for (const key of enKeys) {
    assert.deepEqual(placeholders(get(pt, key)), placeholders(get(en, key)), `pt: ${key}`);
    assert.deepEqual(placeholders(get(es, key)), placeholders(get(en, key)), `es: ${key}`);
  }
});

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "i18n" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });

test("every t(...) key used in the source exists", () => {
  const known = new Set(enKeys.map((key) => key.replace(/_(one|other)$/, "")));
  const missing: string[] = [];
  for (const file of [...sourceFiles("src"), "App.tsx"]) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
      if (!known.has(match[1])) missing.push(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("device language codes map to a supported language", () => {
  assert.equal(matchSupportedLanguage("pt-BR"), "pt");
  assert.equal(matchSupportedLanguage("pt-PT"), "pt");
  assert.equal(matchSupportedLanguage("es_MX"), "es");
  assert.equal(matchSupportedLanguage("EN-gb"), "en");
  assert.equal(matchSupportedLanguage("fr"), null);
  assert.equal(matchSupportedLanguage("zh-Hans-CN"), null);
  assert.equal(matchSupportedLanguage(""), null);
  assert.equal(matchSupportedLanguage(undefined), null);
});
