import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
    "ANDROID_EXPECTED_UPLOAD_CERT_SHA256",
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
      ANDROID_EXPECTED_UPLOAD_CERT_SHA256: "0".repeat(64),
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
    ANDROID_EXPECTED_UPLOAD_CERT_SHA256: "0".repeat(64),
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

function fakeBunx(root) {
  const bin = join(root, "bin");
  const sentinel = join(root, "bunx-invoked");
  mkdirSync(bin);
  writeFileSync(join(bin, "bunx"), `#!/bin/sh\nprintf invoked > "${sentinel}"\nexit 73\n`, {
    mode: 0o755,
  });
  return { bin, sentinel };
}

test("preflight validates the pinned upload key without invoking Bun", (t) => {
  const root = mkdtempSync(join(tmpdir(), "homecare-release-preflight-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const key = signingKey(root, "upload");
  const { bin, sentinel } = fakeBunx(root);
  const result = spawnSync("bash", [script, "--preflight"], {
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("ANDROID_")),
      ),
      PATH: `${bin}:${process.env.PATH}`,
      TMPDIR: root,
      ANDROID_KEYSTORE_PATH: join(root, "upload.p12"),
      ANDROID_KEYSTORE_PASSWORD: "test-pass",
      ANDROID_KEY_ALIAS: "upload",
      ANDROID_HOME: root,
      ANDROID_EXPECTED_UPLOAD_CERT_SHA256: key.sha256.toLowerCase(),
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /matches the pinned certificate/);
  assert.equal(existsSync(sentinel), false);
});

test("rejects invalid or mismatched expected upload fingerprints before Bun", (t) => {
  const root = mkdtempSync(join(tmpdir(), "homecare-release-fingerprint-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const key = signingKey(root, "upload");
  const other = signingKey(root, "other");
  const { bin, sentinel } = fakeBunx(root);
  const invoke = (expected) =>
    spawnSync("bash", [script, join(root, "out")], {
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !name.startsWith("ANDROID_")),
        ),
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: root,
        ANDROID_KEYSTORE_PATH: join(root, "upload.p12"),
        ANDROID_KEYSTORE_PASSWORD: "test-pass",
        ANDROID_KEY_ALIAS: "upload",
        ANDROID_HOME: root,
        ANDROID_EXPECTED_UPLOAD_CERT_SHA256: expected,
      },
      encoding: "utf8",
    });

  const invalid = invoke("not-a-fingerprint");
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /ANDROID_EXPECTED_UPLOAD_CERT_SHA256/);
  assert.doesNotMatch(invalid.stdout + invalid.stderr, /test-pass/);
  assert.equal(existsSync(sentinel), false);

  const mismatch = invoke(other.sha256);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match ANDROID_EXPECTED_UPLOAD_CERT_SHA256/);
  assert.doesNotMatch(mismatch.stdout + mismatch.stderr, /test-pass/);
  assert.equal(existsSync(sentinel), false);

  const matching = invoke(key.sha256.toLowerCase());
  assert.equal(matching.status, 73, matching.stderr);
  assert.equal(existsSync(sentinel), true, "matching fingerprint should reach Bun");
});

test("local build checks the pinned upload key before prebuild, but permits debug previews", (t) => {
  const root = mkdtempSync(join(tmpdir(), "homecare-local-build-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of [".devcontainer", "scripts", "src/utils"]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  for (const path of [
    ".devcontainer/build-android.sh",
    "scripts/android-release.sh",
    "scripts/verify-build-config.mjs",
    "src/utils/googleSignInConfig.js",
    "src/utils/facebookSignInConfig.js",
  ]) {
    copyFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), join(root, path));
  }
  const config = JSON.parse(
    readFileSync(new URL("./fixtures/firebase-ci.json", import.meta.url), "utf8"),
  );
  config.project_info.project_id = "example-homecare-release";
  const configPath = join(root, "firebase-local.json");
  writeFileSync(configPath, JSON.stringify(config));
  const key = signingKey(root, "upload");
  const other = signingKey(root, "other");
  const { bin, sentinel } = fakeBunx(root);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(ANDROID_|GOOGLE_|FACEBOOK_|FIREBASE_)/.test(name),
    ),
  );
  const invoke = (signing) =>
    spawnSync("bash", [join(root, ".devcontainer/build-android.sh"), "local", "apk"], {
      env: {
        ...env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: root,
        GOOGLE_SERVICES_JSON: configPath,
        FIREBASE_EXPECTED_PROJECT_ID: config.project_info.project_id,
        FACEBOOK_ENABLED: "false",
        ...signing,
      },
      encoding: "utf8",
    });
  const signing = {
    ANDROID_KEYSTORE_PATH: join(root, "upload.p12"),
    ANDROID_KEYSTORE_PASSWORD: "test-pass",
    ANDROID_KEY_ALIAS: "upload",
    ANDROID_HOME: root,
  };
  const wrong = invoke({ ...signing, ANDROID_EXPECTED_UPLOAD_CERT_SHA256: other.sha256 });
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /does not match ANDROID_EXPECTED_UPLOAD_CERT_SHA256/);
  assert.equal(existsSync(sentinel), false);

  const missing = invoke(signing);
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /ANDROID_EXPECTED_UPLOAD_CERT_SHA256/);
  assert.equal(existsSync(sentinel), false);

  const partial = invoke({ ANDROID_KEYSTORE_PATH: signing.ANDROID_KEYSTORE_PATH });
  assert.equal(partial.status, 2, partial.stderr);
  assert.match(partial.stderr, /ANDROID_KEYSTORE_PASSWORD/);
  assert.equal(existsSync(sentinel), false);

  const correct = invoke({ ...signing, ANDROID_EXPECTED_UPLOAD_CERT_SHA256: key.sha256 });
  assert.equal(correct.status, 73, correct.stderr);
  assert.equal(existsSync(sentinel), true);
  rmSync(sentinel);

  const debugPreview = invoke({});
  assert.equal(debugPreview.status, 73, debugPreview.stderr);
  assert.equal(existsSync(sentinel), true);
  for (const result of [wrong, missing, partial, correct, debugPreview]) {
    assert.doesNotMatch(result.stdout + result.stderr, /test-pass/);
  }
});

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
