import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./android-release.sh", import.meta.url));
const verifyAab = fileURLToPath(new URL("./verify-android-aab.sh", import.meta.url));

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

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return result.stdout;
}

function signingKey(root, alias) {
  const keystore = join(root, `${alias}.p12`);
  const pass = ["-storepass", "test-pass"];
  run("keytool", [
    ...["-genkeypair", "-keystore", keystore, "-storetype", "PKCS12", "-alias", alias],
    ...["-keyalg", "RSA", "-keysize", "2048", "-validity", "1", "-dname", `CN=${alias}`, ...pass],
  ]);
  const listing = run("keytool", ["-list", "-v", "-keystore", keystore, "-alias", alias, ...pass]);
  const sha256 = listing.match(/SHA256: ([0-9A-F:]+)/)[1];
  return {
    sha256,
    sign: (file) => run("jarsigner", ["-keystore", keystore, ...pass, file, alias]),
  };
}

// A ZIP is enough here: AABs carry the same JAR signature that jarsigner checks.
function bundle(root, contents = "bundle module") {
  const aab = join(root, "app-release.aab");
  run("python3", [
    "-I",
    "-c",
    "import sys, zipfile\nwith zipfile.ZipFile(sys.argv[1], 'w') as z: z.writestr('base/manifest/AndroidManifest.xml', sys.argv[2])",
    aab,
    contents,
  ]);
  return aab;
}

test("accepts only an intact AAB signed solely by the expected certificate", (t) => {
  const root = mkdtempSync(join(tmpdir(), "homecare-aab-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const upload = signingKey(root, "upload");
  const other = signingKey(root, "other");
  const verify = (aab, sha256) => spawnSync("bash", [verifyAab, aab, sha256], { encoding: "utf8" });

  const aab = bundle(root);
  assert.equal(verify(aab, upload.sha256).status, 1, "unsigned");
  upload.sign(aab);
  assert.equal(verify(aab, upload.sha256).status, 0, verify(aab, upload.sha256).stderr);
  assert.equal(verify(aab, upload.sha256.replaceAll(":", "").toLowerCase()).status, 0);
  const wrong = verify(aab, other.sha256);
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /not signed only with the upload certificate/);

  other.sign(aab);
  // One of them is listed first, so this reaches the second-signer check.
  for (const key of [upload, other]) {
    assert.equal(verify(aab, key.sha256).status, 1, "second signer");
  }

  const tampered = bundle(root, "original");
  upload.sign(tampered);
  run("python3", [
    "-I",
    "-c",
    [
      "import sys, zipfile",
      "entries = [(i, zipfile.ZipFile(sys.argv[1]).read(i)) for i in zipfile.ZipFile(sys.argv[1]).infolist()]",
      "with zipfile.ZipFile(sys.argv[1], 'w') as z:",
      "    for info, data in entries:",
      "        z.writestr(info, b'changed' if info.filename.startswith('base/') else data)",
    ].join("\n"),
    tampered,
  ]);
  assert.equal(verify(tampered, upload.sha256).status, 1, "tampered");
});
