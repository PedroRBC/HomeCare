import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import fs, { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isForbiddenPath, inspectEntry, checkTrackedFiles } from "./check-secret-files.mjs";

const script = fileURLToPath(new URL("./check-secret-files.mjs", import.meta.url));

test("rejects real local configuration and private material, not examples or demo fixtures", () => {
  for (const path of [
    ".env",
    ".env.production",
    "config/.env.test",
    ".secrets/config.json",
    "google-services.json",
    "config/GoogleService-Info.plist",
    "credentials.json",
    "service-account-play.json",
    "firebase-service-account.json",
    "upload.jks",
    "upload.keystore",
    "key.pem",
    "private.key",
    "private.p12",
    "private.pfx",
  ])
    assert.equal(isForbiddenPath(path), true, path);
  for (const path of [
    ".env.example",
    "scripts/fixtures/firebase-ci.json",
    "firebase.json",
    "eas.json",
  ]) {
    assert.equal(isForbiddenPath(path), false, path);
  }
});

test("reports only credential categories", () => {
  const privateKey = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const cases = [
    [privateKey, "private-key"],
    ["ghp_" + "A".repeat(36), "github-token"],
    ["GOCSPX-" + "a".repeat(24), "google-oauth-secret"],
    ["AKIA" + "A".repeat(16), "aws-access-key"],
    [JSON.stringify({ type: "service_account", private_key: "sentinel-value" }), "service-account"],
  ];
  for (const [secret, category] of cases) {
    assert.deepEqual(inspectEntry("config.json", secret), [category]);
  }
  assert.deepEqual(inspectEntry("config.json", '{"public_project_id":"demo-homecare-ci"}'), []);
});

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), "homecare-secret-check-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

test("fails for tracked forbidden files without revealing their content", (t) => {
  const root = repository(t);
  const sentinel = "never-print-this-password";
  writeFileSync(join(root, ".env.production"), `PASSWORD=${sentinel}`);
  execFileSync("git", ["add", ".env.production"], { cwd: root });
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /forbidden-file/);
  assert.equal((result.stdout + result.stderr).includes(sentinel), false);
});

test("ignores untracked local files and does not follow symlinks", (t) => {
  const root = repository(t);
  writeFileSync(join(root, ".env"), "local-only");
  mkdirSync(join(root, "fixtures"));
  writeFileSync(join(root, "fixtures", "demo.json"), '{"project_id":"demo-homecare-ci"}');
  symlinkSync(join(root, "not-present-outside-checkout"), join(root, "link"));
  execFileSync("git", ["add", "fixtures/demo.json", "link"], { cwd: root });
  assert.deepEqual(checkTrackedFiles(root), { files: 2, findings: [] });
});

test("a file replaced by a symlink before reading cannot expose external credentials", (t) => {
  const root = repository(t);
  const tracked = join(root, "tracked.txt");
  const outside = join(root, ".env");
  writeFileSync(tracked, "public fixture");
  writeFileSync(outside, "ghp_" + "A".repeat(36));
  execFileSync("git", ["add", "tracked.txt"], { cwd: root });
  const readFile = fs.readFileSync;
  const read = t.mock.method(fs, "readFileSync", (path, ...args) => {
    rmSync(tracked);
    symlinkSync(outside, tracked);
    return readFile(path, ...args);
  });
  syncBuiltinESMExports();
  try {
    assert.deepEqual(checkTrackedFiles(root), { files: 1, findings: [] });
  } finally {
    read.mock.restore();
    syncBuiltinESMExports();
  }
});
