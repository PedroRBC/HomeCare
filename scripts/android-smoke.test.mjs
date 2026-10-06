import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./android-smoke.sh", import.meta.url));
const fakeCommand = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.COMMAND_LOG, JSON.stringify({ command, args }) + '\\n');
if (command === 'maestro') {
  const debug = args[args.indexOf('--debug-output') + 1];
  fs.mkdirSync(debug, { recursive: true });
  fs.writeFileSync(path.join(debug, 'commands.json'), '{"debug":"retained"}');
  console.log('maestro executed');
  process.exit(Number(process.env.TEST_EXIT || 0));
}
if (args[0] === 'install') {
  console.log('adb install executed');
  process.exit(Number(process.env.INSTALL_EXIT || 0));
}
if (process.env.DIAGNOSTICS_FAIL === '1') process.exit(9);
if (args.includes('packages')) {
  if (!process.env.NO_UID) console.log('package:com.pedrorbc.HomeCare uid:10234');
} else if (args.includes('pidof')) {
  if (!process.env.NO_PID) console.log('4321');
} else if (args[0] === 'logcat') {
  for (const [filter, message] of [
    ['AndroidRuntime:E', 'AndroidRuntime: app crash diagnostic'],
    ['libc:E', 'libc: Fatal signal 11'],
    ['DEBUG:V', 'DEBUG: native backtrace'],
    ['crash_dump64:V', 'crash_dump64: native dump'],
    ['crash_dump32:V', 'crash_dump32: native dump'],
    ['linker:E', 'linker: native library load failed'],
  ]) {
    if (args.includes(filter)) console.log(message);
  }
} else if (args.includes('screencap')) {
  process.stdout.write(Buffer.from([137, 80, 78, 71]));
} else if (args.includes('uiautomator')) {
  console.log('UI hierarchy dumped');
} else if (args.includes('cat')) {
  console.log('<hierarchy />');
} else {
  console.error('Unexpected fake adb command: ' + JSON.stringify(args));
  process.exit(91);
}
`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "homecare-smoke-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "fake bin");
  mkdirSync(bin);
  for (const name of ["adb", "maestro"]) {
    writeFileSync(join(bin, name), fakeCommand, { mode: 0o755 });
  }
  const apk = join(root, "release app.apk");
  const diagnostics = join(root, "smoke diagnostics");
  const flow = join(root, "custom flow.yaml");
  const log = join(root, "commands.jsonl");
  writeFileSync(apk, "fixture apk");
  writeFileSync(flow, "appId: com.pedrorbc.HomeCare\n---\n- launchApp\n");
  mkdirSync(join(root, ".maestro"));
  writeFileSync(join(root, ".maestro/auth-navigation.yaml"), readFileSync(flow));
  return {
    apk,
    diagnostics,
    flow,
    run(environment = {}, useDefaultFlow = false) {
      return spawnSync("bash", [script, apk, diagnostics, ...(useDefaultFlow ? [] : [flow])], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          COMMAND_LOG: log,
          ...environment,
        },
        timeout: 10_000,
      });
    },
    commands() {
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    },
  };
}

function assertDiagnostics(f) {
  for (const file of [
    "install.log",
    "logcat.txt",
    "screenshot.png",
    "hierarchy.xml",
    "diagnostics.log",
  ]) {
    assert.equal(existsSync(join(f.diagnostics, file)), true, file);
  }
  const logcat = f.commands().find(({ args }) => args[0] === "logcat");
  assert.ok(logcat);
  assert.ok(logcat.args.includes("--uid=10234"));
  assert.deepEqual(logcat.args.slice(-9), [
    "AndroidRuntime:E",
    "ReactNative:V",
    "ReactNativeJS:V",
    "libc:E",
    "DEBUG:V",
    "crash_dump64:V",
    "crash_dump32:V",
    "linker:E",
    "*:S",
  ]);
  assert.deepEqual(logcat.args.slice(0, 4), ["logcat", "-d", "-t", "1000"]);
}

test("native failure tags are retained without dropping app scope or original failure", (t) => {
  const f = fixture(t);
  const result = f.run({ TEST_EXIT: "42" });
  assert.equal(result.status, 42, result.stderr);
  assertDiagnostics(f);
  const logcat = readFileSync(join(f.diagnostics, "logcat.txt"), "utf8");
  for (const tag of ["libc", "DEBUG", "crash_dump64", "crash_dump32", "linker"]) {
    assert.match(logcat, new RegExp(`^${tag}:`, "m"));
  }
});

test("successful install/test uses quoted paths, stable flags, and retains diagnostics", (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const commands = f.commands();
  assert.deepEqual(commands[0], {
    command: "adb",
    args: ["install", "--no-streaming", "-r", f.apk],
  });
  assert.deepEqual(commands[1], {
    command: "maestro",
    args: [
      "test",
      "--debug-output",
      join(f.diagnostics, "maestro-debug"),
      "--flatten-debug-output",
      f.flow,
    ],
  });
  assertDiagnostics(f);
  assert.equal(
    readFileSync(join(f.diagnostics, "maestro-debug/commands.json"), "utf8"),
    '{"debug":"retained"}',
  );
});

test("install failure keeps original exit, collects diagnostics, and never runs/retries Maestro", (t) => {
  const f = fixture(t);
  assert.equal(f.run({ INSTALL_EXIT: "42" }).status, 42);
  assertDiagnostics(f);
  assert.equal(f.commands().filter(({ args }) => args[0] === "install").length, 1);
  assert.equal(
    f.commands().some(({ command }) => command === "maestro"),
    false,
  );
});

test("Maestro failure keeps pipeline command status and retains debug output without retry", (t) => {
  const f = fixture(t);
  assert.equal(f.run({ TEST_EXIT: "37" }).status, 37);
  assertDiagnostics(f);
  assert.equal(f.commands().filter(({ command }) => command === "maestro").length, 1);
  assert.equal(existsSync(join(f.diagnostics, "maestro-debug/commands.json")), true);
});

for (const [environment, status] of [
  [{}, 0],
  [{ INSTALL_EXIT: "42" }, 42],
  [{ TEST_EXIT: "37" }, 37],
]) {
  test(`diagnostic failures do not replace exit status ${status}`, (t) => {
    const f = fixture(t);
    const result = f.run({ ...environment, DIAGNOSTICS_FAIL: "1" });
    assert.equal(result.status, status, result.stderr);
    assert.match(
      readFileSync(join(f.diagnostics, "diagnostics.log"), "utf8"),
      /Screenshot collection failed/,
    );
    assert.equal(
      f.commands().some(({ args }) => args.includes("uiautomator")),
      true,
    );
  });
}

test("uses the default flow when none is supplied", (t) => {
  const f = fixture(t);
  assert.equal(f.run({}, true).status, 0);
  const maestro = f.commands().find(({ command }) => command === "maestro");
  assert.equal(basename(maestro.args.at(-1)), "auth-navigation.yaml");
});

test("falls back to PID-scoped logs if UID lookup fails", (t) => {
  const f = fixture(t);
  assert.equal(f.run({ NO_UID: "1" }).status, 0);
  const logcat = f.commands().find(({ args }) => args[0] === "logcat");
  assert.ok(logcat.args.includes("--pid=4321"));
});

test("omits unscoped logs when app identity cannot be found", (t) => {
  const f = fixture(t);
  assert.equal(f.run({ NO_UID: "1", NO_PID: "1" }).status, 0);
  assert.equal(
    f.commands().some(({ args }) => args[0] === "logcat"),
    false,
  );
  assert.match(readFileSync(join(f.diagnostics, "logcat.txt"), "utf8"), /omitted unscoped logs/);
});
