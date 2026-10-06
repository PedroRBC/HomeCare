import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runUnitTests, validateJUnitReport } from "./unit-test-helpers.mjs";

const passingSource = `import { test } from "node:test";
import assert from "node:assert/strict";
test("real Bun fixture", () => assert.equal(1, 1));
`;

function fixture(t, files, githubActions = true) {
  const cwd = mkdtempSync(path.join(tmpdir(), "homecare-real-bun-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(path.join(cwd, "src"));
  for (const [filename, source] of Object.entries(files)) {
    writeFileSync(path.join(cwd, "src", filename), source);
  }
  const calls = [];
  return {
    cwd,
    calls,
    run() {
      return runUnitTests({
        cwd,
        log: () => {},
        spawn(binary, args, options) {
          // Execute real Bun from PATH (CI pins 1.2.15), but capture expected failures.
          const result = spawnSync(binary, args, {
            ...options,
            stdio: "pipe",
            encoding: "utf8",
            timeout: 30_000,
            env: githubActions
              ? { ...process.env, CI: "1", GITHUB_ACTIONS: "true", GITHUB_SHA: "a".repeat(40) }
              : Object.fromEntries(
                  Object.entries({ ...process.env, CI: "1" }).filter(
                    ([key]) => !key.startsWith("GITHUB_"),
                  ),
                ),
          });
          calls.push({ args, result });
          return result;
        },
      });
    },
  };
}

test("GitHub integration uses the exact CI Bun version", () => {
  const version = spawnSync("bun", ["--version"], { encoding: "utf8", timeout: 10_000 });
  assert.equal(version.status, 0, version.stderr || "Bun must be available on PATH");
  if (process.env.GITHUB_ACTIONS === "true") assert.equal(version.stdout.trim(), "1.2.15");
});

for (const githubActions of [false, true]) {
  test(`validates real Bun reports with GitHub metadata ${githubActions ? "enabled" : "disabled"}`, (t) => {
    const f = fixture(t, { "a.test.ts": passingSource, "b.test.ts": passingSource }, githubActions);
    const result = f.run();
    assert.equal(result.files, 2);
    assert.equal(result.tests, 2);
    assert.equal(f.calls.length, 2);
    for (const filename of result.reports) {
      const xml = readFileSync(filename, "utf8");
      assert.deepEqual(validateJUnitReport(xml), { tests: 1, failures: 0, errors: 0, skipped: 0 });
      if (githubActions) assert.match(xml, /<property name="commit" value="a{40}"/);
    }
  });
}

test("rejects a real Bun failure and still executes the remaining file", (t) => {
  const f = fixture(t, {
    "a-fail.test.ts": passingSource.replace("assert.equal(1, 1)", "assert.equal(1, 2)"),
    "b-pass.test.ts": passingSource,
  });
  assert.throws(() => f.run(), /a-fail\.test\.ts: Bun exited with status 1/);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].result.status, 1);
  assert.equal(f.calls[1].result.status, 0);
});

test("rejects a real Bun file with no registered tests", (t) => {
  const f = fixture(t, { "empty.test.ts": "// No tests registered.\n" });
  assert.throws(
    () => f.run(),
    /empty\.test\.ts:.*(Cannot read JUnit report|zero registered tests)/,
  );
  assert.equal(f.calls.length, 1);
});
