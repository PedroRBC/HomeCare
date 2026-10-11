import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./android-release.sh", import.meta.url));

function release(t, environment) {
  const root = mkdtempSync(join(tmpdir(), "homecare-release-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("ANDROID_")),
  );
  const result = spawnSync("bash", [script, join(root, "out")], {
    env: { ...env, TMPDIR: root, ...environment(root) },
    encoding: "utf8",
  });
  return { ...result, root };
}

test("lists every missing signing variable before building", (t) => {
  const result = release(t, () => ({}));
  assert.equal(result.status, 2);
  for (const name of [
    "ANDROID_KEYSTORE_BASE64 or ANDROID_KEYSTORE_PATH",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_HOME",
  ]) {
    assert.match(result.stderr, new RegExp(name));
  }
});

test("rejects an unreadable keystore without leaking the password", (t) => {
  const password = "do-not-print-this";
  const result = release(t, (root) => {
    writeFileSync(join(root, "upload.jks"), "not a keystore");
    return {
      ANDROID_KEYSTORE_PATH: join(root, "upload.jks"),
      ANDROID_KEYSTORE_PASSWORD: password,
      ANDROID_KEY_ALIAS: "upload",
      ANDROID_HOME: root,
    };
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot read the key alias/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(password));
});

test("rejects a keystore secret that is not base64", (t) => {
  const result = release(t, (root) => ({
    ANDROID_KEYSTORE_BASE64: "%%%",
    ANDROID_KEYSTORE_PASSWORD: "secret",
    ANDROID_KEY_ALIAS: "upload",
    ANDROID_HOME: root,
  }));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not valid base64/);
});
