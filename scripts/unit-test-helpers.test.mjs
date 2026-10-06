import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { discoverTestFiles, runUnitTests, validateJUnitReport } from "./unit-test-helpers.mjs";

function fixture(t, files = []) {
  const cwd = mkdtempSync(path.join(tmpdir(), "homecare-unit-tests-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(path.join(cwd, "src"));
  for (const file of files) {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), "// Fixture only; never executed.\n");
  }
  return cwd;
}

function report(tests = 1) {
  const cases = Array.from(
    { length: tests },
    (_, index) => `<testcase name="test ${index}" />`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${tests}" failures="0" skipped="0">
  <testsuite name="fixture" tests="${tests}" failures="0" skipped="0">${cases}</testsuite>
</testsuites>`;
}

function fakeBun(writeReport = () => report(), result = { status: 0, signal: null }) {
  const calls = [];
  const spawn = (executable, args, options) => {
    calls.push({ executable, args, options });
    const xml = writeReport(args[1]);
    if (xml !== undefined) {
      writeFileSync(
        args
          .find((arg) => arg.startsWith("--reporter-outfile="))
          .split("=")
          .slice(1)
          .join("="),
        xml,
      );
    }
    return result;
  };
  return { spawn, calls };
}

const quiet = () => {};

test("discovers supported Bun test filenames under src in deterministic path order", (t) => {
  const cwd = fixture(t, [
    "src/z/last.test.ts",
    "src/a/middle.spec.jsx",
    "src/a/first_test.js",
    "src/a/another_spec.tsx",
    "src/a/not-a-test.ts",
    "src/a/fake.test.ts.txt",
    "scripts/ignored.test.js",
  ]);
  assert.deepEqual(discoverTestFiles(cwd), [
    "src/a/another_spec.tsx",
    "src/a/first_test.js",
    "src/a/middle.spec.jsx",
    "src/z/last.test.ts",
  ]);
});

test("launches one Bun process per sorted file, with individual reports and accumulated counts", (t) => {
  const cwd = fixture(t, ["src/z.test.ts", "src/a.test.ts"]);
  const fake = fakeBun((file) => report(file.endsWith("a.test.ts") ? 2 : 3));
  const result = runUnitTests({ cwd, bunExecutable: "/tools/bun", spawn: fake.spawn, log: quiet });
  assert.equal(result.files, 2);
  assert.equal(result.tests, 5);
  assert.deepEqual(result.reports, [
    path.join(cwd, "reports/unit-tests/src/a.test.ts.xml"),
    path.join(cwd, "reports/unit-tests/src/z.test.ts.xml"),
  ]);
  assert.deepEqual(
    fake.calls.map((call) => call.args[1]),
    [path.join(cwd, "src/a.test.ts"), path.join(cwd, "src/z.test.ts")],
  );
  for (const [index, call] of fake.calls.entries()) {
    assert.equal(call.executable, "/tools/bun");
    assert.deepEqual(call.args, [
      "test",
      path.join(cwd, index === 0 ? "src/a.test.ts" : "src/z.test.ts"),
      "--reporter=junit",
      `--reporter-outfile=${result.reports[index]}`,
    ]);
    assert.deepEqual(call.options, { cwd, stdio: "inherit" });
  }
});

test("fails an empty discovery before launching Bun", (t) => {
  const cwd = fixture(t, ["src/helper.ts"]);
  const fake = fakeBun();
  assert.throws(
    () => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }),
    /No unit test files discovered/,
  );
  assert.equal(fake.calls.length, 0);
});

test("fails if any discovered file registers zero tests, even when another file passes", (t) => {
  const cwd = fixture(t, ["src/empty.test.ts", "src/pass.test.ts"]);
  const fake = fakeBun((file) => report(file.endsWith("empty.test.ts") ? 0 : 1));
  assert.throws(
    () => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }),
    /empty\.test\.ts:.*zero registered tests/,
  );
  assert.equal(fake.calls.length, 2);
});

test("requires fresh per-file reports instead of trusting old output", (t) => {
  const cwd = fixture(t, ["src/sample.test.ts"]);
  const directory = path.join(cwd, "reports/unit-tests/src");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "sample.test.ts.xml"), report());
  const fake = fakeBun(() => undefined);
  assert.throws(
    () => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }),
    /Cannot read JUnit report/,
  );
});

test("propagates malformed report failures", (t) => {
  const cwd = fixture(t, ["src/sample.test.ts"]);
  const fake = fakeBun(() => '<testsuites tests="1">');
  assert.throws(() => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }), /Invalid JUnit report/);
});

for (const [name, result, expected] of [
  ["nonzero exit", { status: 1, signal: null }, /status 1/],
  ["termination signal", { status: null, signal: "SIGTERM" }, /signal SIGTERM/],
  ["missing exit status", { status: null, signal: null }, /status null/],
  ["spawn error", { error: new Error("ENOENT: Bun not found"), status: null }, /Bun not found/],
]) {
  test(`propagates ${name}, even if a successful report exists`, (t) => {
    const cwd = fixture(t, ["src/sample.test.ts"]);
    const fake = fakeBun(() => report(), result);
    assert.throws(() => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }), expected);
  });
}

test("continues to the remaining files and identifies each failed file", (t) => {
  const cwd = fixture(t, ["src/b.test.ts", "src/a.test.ts"]);
  const fake = fakeBun(() => report(), { status: 2, signal: null });
  assert.throws(
    () => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }),
    (error) => {
      assert.match(error.message, /failed in 2 of 2 files/);
      assert.match(error.message, /src\/a\.test\.ts:.*status 2/);
      assert.match(error.message, /src\/b\.test\.ts:.*status 2/);
      return true;
    },
  );
  assert.equal(fake.calls.length, 2);
});

test("validates nested suites without double-counting testcases", () => {
  assert.deepEqual(
    validateJUnitReport(`<testsuites tests="2" skipped="1">
    <testsuite tests="2" skipped="1">
      <testcase name="escaped &lt; &amp; &#10;" />
      <testsuite tests="1" skipped="1">
        <testcase name="skip"><skipped /></testcase>
      </testsuite>
    </testsuite>
  </testsuites>`),
    { tests: 2, failures: 0, errors: 0, skipped: 1 },
  );
});

for (const [name, xml] of [
  ["empty report", ""],
  ["zero registered tests", report(0)],
  ["missing testcase despite positive advertised count", report().replace(/<testcase[^>]*\/>/, "")],
  ["missing count", report().replace('tests="1"', "")],
  ["nonnumeric count", report().replace('tests="1"', 'tests="nope"')],
  [
    "inconsistent nested suite count",
    report().replace('name="fixture" tests="1"', 'name="fixture" tests="2"'),
  ],
  ["truncated XML", report().replace("</testsuites>", "")],
  ["mismatched tags", report().replace("</testsuite>", "</testcase>")],
  ["trailing text", `${report()}junk`],
  ["multiple roots", `${report()}${report().replace(/<\?xml[^?]*\?>/, "")}`],
  ["malformed XML declaration", report().replace('version="1.0"', 'version="broken"')],
  ["malformed attributes", report().replace('tests="1"', "tests=1")],
  ["invalid attribute name", report().replace('tests="1"', '9invalid="yes" tests="1"')],
  ["duplicate attributes", report().replace('tests="1"', 'tests="1" tests="1"')],
  ["invalid entity", report().replace('name="test 0"', 'name="test &unknown;"')],
  ["invalid character reference", report().replace('name="test 0"', 'name="test &#0;"')],
  ["invalid control character", report().replace('name="test 0"', 'name="test \u0001"')],
  ["malformed comment", `${report()}<!-- broken -- comment -->`],
  ["unexpected element", report().replace("<testcase", "<not-a-testcase")],
  [
    "failure elements",
    '<testsuites tests="1" failures="1"><testsuite tests="1" failures="1"><testcase><failure message="bad"><![CDATA[bad < value]]></failure></testcase></testsuite></testsuites>',
  ],
  [
    "error elements",
    '<testsuites tests="1" errors="1"><testsuite tests="1" errors="1"><testcase><error>bad</error></testcase></testsuite></testsuites>',
  ],
]) {
  test(`rejects ${name}`, () =>
    assert.throws(() => validateJUnitReport(xml), /Invalid JUnit report/));
}

test("does not trust a zero exit when the report contains failures", (t) => {
  const cwd = fixture(t, ["src/sample.test.ts"]);
  const fake = fakeBun(
    () =>
      '<testsuites tests="1" failures="1"><testsuite tests="1" failures="1"><testcase><failure>bad</failure></testcase></testsuite></testsuites>',
  );
  assert.throws(
    () => runUnitTests({ cwd, spawn: fake.spawn, log: quiet }),
    /report contains failed tests/,
  );
});
