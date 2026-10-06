import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const testFilePattern = /(?:\.|_)(?:test|spec)\.(?:js|jsx|ts|tsx)$/;
const countNames = ["tests", "failures", "errors", "skipped"];
const emptyCounts = () => ({ tests: 0, failures: 0, errors: 0, skipped: 0 });

export function discoverTestFiles(cwd) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      // Authorization tests have their own mandatory emulator-backed CI job.
      if (entry.isDirectory() && filename !== path.join(cwd, "src", "security")) visit(filename);
      else if (entry.isFile() && testFilePattern.test(entry.name)) {
        files.push(path.relative(cwd, filename));
      }
    }
  }
  visit(path.join(cwd, "src"));
  return files.sort();
}

// Validate Bun's JUnit subset without an XML dependency. Count testcase elements,
// not just the advertised total, so empty or truncated reports cannot pass.
export function validateJUnitReport(xml) {
  const fail = (message) => {
    throw new Error(`Invalid JUnit report: ${message}`);
  };
  const text = xml
    .replace(/^﻿/, "")
    .trim()
    .replace(/^<\?xml version=(?:"1\.0"|'1\.0')(?: encoding=(?:"UTF-8"|'UTF-8'))?\?>\s*/, "");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/u.test(text)) fail("invalid XML character");
  const tokens =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[a-zA-Z_][\w-]*(?:\s+[a-zA-Z_][\w-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>|[^<]+/gy;
  const attributes = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const parents = {
    testsuites: [],
    testsuite: ["testsuites", "testsuite"],
    testcase: ["testsuite"],
    properties: ["testsuite"],
    property: ["properties"],
    failure: ["testcase"],
    error: ["testcase"],
    skipped: ["testcase"],
    "system-out": ["testsuite", "testcase"],
    "system-err": ["testsuite", "testcase"],
  };
  const stack = [];
  let result;
  let position = 0;

  function validateEntities(value) {
    if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value)) fail("invalid XML entity");
    for (const match of value.matchAll(/&#(x[\da-fA-F]+|\d+);/g)) {
      const code = match[1].startsWith("x") ? parseInt(match[1].slice(1), 16) : Number(match[1]);
      if (
        ![9, 10, 13].includes(code) &&
        !(
          code >= 32 &&
          code <= 0x10ffff &&
          !(code >= 0xd800 && code <= 0xdfff) &&
          code !== 0xfffe &&
          code !== 0xffff
        )
      ) {
        fail("invalid XML character reference");
      }
    }
  }

  function close(name) {
    const frame = stack.pop();
    if (!frame || frame.name !== name) fail(`mismatched closing tag ${name}`);
    if (name === "testsuites" || name === "testsuite") {
      for (const key of countNames) {
        const declared = frame.attrs[key] ?? (key === "tests" ? undefined : "0");
        if (!/^\d+$/.test(declared ?? "") || Number(declared) !== frame.counts[key]) {
          fail(`${name} ${key} count does not match its testcases`);
        }
      }
    }
    const parent = stack.at(-1);
    if (name === "failure" || name === "error" || name === "skipped") {
      const key = name === "failure" ? "failures" : name === "error" ? "errors" : "skipped";
      if (parent.counts.failures + parent.counts.errors + parent.counts.skipped) {
        fail("testcase has multiple outcomes");
      }
      parent.counts[key] = 1;
    } else if (name === "testcase" || name === "testsuite") {
      for (const key of countNames) parent.counts[key] += frame.counts[key];
    } else if (name === "testsuites") {
      result = frame.counts;
    }
  }

  for (let match; (match = tokens.exec(text));) {
    position = tokens.lastIndex;
    const token = match[0];
    if (token.startsWith("<!--")) {
      if (/--|-$/.test(token.slice(4, -3))) fail("invalid XML comment");
      continue;
    }
    if (!token.startsWith("<") || token.startsWith("<![CDATA[")) {
      const cdata = token.startsWith("<![CDATA[");
      if (!cdata) {
        validateEntities(token);
        if (token.includes("]]>")) fail("invalid XML text");
      }
      if (
        (cdata || token.trim()) &&
        !["failure", "error", "system-out", "system-err"].includes(stack.at(-1)?.name)
      ) {
        fail("unexpected text");
      }
      continue;
    }
    const name = /^<\/?([\w-]+)/.exec(token)[1];
    if (token.startsWith("</")) {
      if (token !== `</${name}>`) fail("invalid closing tag");
      close(name);
      continue;
    }
    const parent = stack.at(-1);
    if (
      !Object.hasOwn(parents, name) ||
      (parent ? !parents[name].includes(parent.name) : name !== "testsuites" || result)
    ) {
      fail(`unexpected element ${name}`);
    }
    const attrs = Object.create(null);
    for (const attribute of token.matchAll(attributes)) {
      const value = attribute[2] ?? attribute[3];
      if (Object.hasOwn(attrs, attribute[1])) fail("duplicate attribute");
      validateEntities(value);
      attrs[attribute[1]] = value;
    }
    const counts = emptyCounts();
    if (name === "testcase") counts.tests = 1;
    stack.push({ name, attrs, counts });
    if (token.endsWith("/>")) close(name);
  }
  if (position !== text.length || stack.length || !result) fail("malformed or incomplete XML");
  if (result.tests === 0) fail("zero registered tests");
  if (result.failures || result.errors) fail("report contains failed tests");
  return result;
}

export function runUnitTests({
  cwd,
  bunExecutable = "bun",
  reportDirectory = path.join(cwd, "reports", "unit-tests"),
  spawn = spawnSync,
  log = console.log,
}) {
  const files = discoverTestFiles(cwd);
  if (!files.length) throw new Error("No unit test files discovered under src");
  const reports = [];
  const failures = [];
  let tests = 0;

  for (const file of files) {
    const reportPath = path.join(reportDirectory, `${file}.xml`);
    log(`[unit-tests] Running ${file}`);
    try {
      mkdirSync(path.dirname(reportPath), { recursive: true });
      rmSync(reportPath, { force: true });
      const child = spawn(
        bunExecutable,
        ["test", path.join(cwd, file), "--reporter=junit", `--reporter-outfile=${reportPath}`],
        { cwd, stdio: "inherit" },
      );
      if (child.error) throw child.error;
      if (child.signal || child.status !== 0) {
        throw new Error(
          `Bun exited with ${child.signal ? `signal ${child.signal}` : `status ${child.status}`}`,
        );
      }
      let xml;
      try {
        xml = readFileSync(reportPath, "utf8");
      } catch (error) {
        throw new Error(`Cannot read JUnit report ${reportPath}`, { cause: error });
      }
      const counts = validateJUnitReport(xml);
      tests += counts.tests;
      reports.push(reportPath);
      log(`[unit-tests] ${file}: ${counts.tests} registered tests`);
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
  if (failures.length) {
    throw new Error(
      `Unit tests failed in ${failures.length} of ${files.length} files:\n${failures.join("\n")}`,
    );
  }
  log(`[unit-tests] Passed ${tests} registered tests across ${files.length} files`);
  return { files: files.length, tests, reports };
}
