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

function localAabCheckout(t) {
  const root = mkdtempSync(join(tmpdir(), "homecare local-aab-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of [
    "bin",
    "scripts",
    "src/utils",
    "node_modules/expo/bin",
    "android/build",
  ]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  for (const path of [
    "scripts/build-aab.mjs",
    "scripts/android-release.sh",
    "scripts/verify-android-aab.sh",
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
  writeFileSync(join(root, "firebase-local.json"), JSON.stringify(config));
  for (const name of ["eas", "bunx"]) {
    writeFileSync(
      join(root, "bin", name),
      "#!/bin/sh\nprintf 'Unexpected remote/bootstrap command\\n' >&2\nexit 97\n",
      { mode: 0o755 },
    );
  }
  writeFileSync(join(root, "uncommitted-source.txt"), "local source changes");
  writeFileSync(join(root, "android/build/cache-sentinel"), "preserved");
  const record = `
const fs = require("node:fs");
fs.appendFileSync("calls.jsonl", JSON.stringify({
  args: process.argv.slice(2), cwd: process.cwd(),
  versionCode: process.env.ANDROID_VERSION_CODE,
  dotenv: process.env.EXPO_NO_DOTENV,
  source: fs.readFileSync("uncommitted-source.txt", "utf8"),
}) + "\\n");
`;
  writeFileSync(join(root, "node_modules/expo/bin/cli"), record);
  writeFileSync(
    join(root, "android/mock-gradle.cjs"),
    `${record}
if (process.env.AAB_TEST_GRADLE_EXIT) process.exit(Number(process.env.AAB_TEST_GRADLE_EXIT));
const output = "android/app/build/outputs/bundle/release";
fs.mkdirSync(output, {recursive: true});
fs.copyFileSync("app-release.aab", output + "/app-release.aab");
`,
  );
  writeFileSync(
    join(root, "android/gradlew"),
    `#!/bin/sh\nexec "${process.execPath}" android/mock-gradle.cjs "$@"\n`,
  );
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(ANDROID_|GOOGLE_|FACEBOOK_|FIREBASE_|EXPO_|AAB_TEST_)/.test(name),
    ),
  );
  writeFileSync(
    join(root, ".env"),
    [
      "GOOGLE_SERVICES_JSON=./firebase-local.json",
      "FIREBASE_EXPECTED_PROJECT_ID=example-homecare-release",
      "FACEBOOK_ENABLED=false",
      "ANDROID_VERSION_CODE=31",
      "ANDROID_KEYSTORE_PATH=./upload.p12",
      "ANDROID_KEYSTORE_PASSWORD=test-pass",
      "ANDROID_KEY_ALIAS=upload",
      `ANDROID_HOME=${root}`,
    ].join("\n"),
  );
  baseEnv.PATH = `${join(root, "bin")}:${baseEnv.PATH}`;
  return {
    root,
    env: baseEnv,
    invoke: (env = {}, args = []) =>
      spawnSync(process.execPath, ["--env-file-if-exists=.env", "scripts/build-aab.mjs", ...args], {
        cwd: root,
        env: { ...baseEnv, ...env },
        encoding: "utf8",
      }),
    calls: () => readFileSync(join(root, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse),
  };
}

test("local AAB command uses current sources, local env and only bundleRelease without cleaning", (t) => {
  const { root, invoke, calls } = localAabCheckout(t);
  const key = signingKey(root, "upload");
  key.sign(bundle(root));
  const result = invoke(
    { ANDROID_EXPECTED_UPLOAD_CERT_SHA256: key.sha256, ANDROID_VERSION_CODE: "32" },
    ["--stacktrace"],
  );
  assert.equal(result.status, 0, result.stderr);
  const [expo, gradle] = calls();
  assert.deepEqual(expo.args, ["prebuild", "--platform", "android", "--no-install"]);
  assert.deepEqual(gradle.args, [
    "-p",
    "android",
    "--no-daemon",
    "--no-parallel",
    "--max-workers=2",
    "--stacktrace",
    "bundleRelease",
  ]);
  for (const call of [expo, gradle]) {
    assert.equal(call.cwd, root);
    assert.equal(call.versionCode, "32", "exported environment overrides .env");
    assert.equal(call.dotenv, "1");
    assert.equal(call.source, "local source changes");
  }
  assert.equal(readFileSync(join(root, "android/build/cache-sentinel"), "utf8"), "preserved");
  const output = join(root, "reports/android-release");
  assert.deepEqual(
    readFileSync(join(output, "app-release.aab")),
    readFileSync(join(root, "app-release.aab")),
  );
  assert.match(
    readFileSync(join(output, "app-release.aab.sha256"), "utf8"),
    /^[a-f0-9]{64}  app-release\.aab\n$/,
  );
  assert.match(result.stdout, /Signed AAB staged/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-pass/);
  const checksum = spawnSync("sha256sum", ["--check", "app-release.aab.sha256"], {
    cwd: output,
    encoding: "utf8",
  });
  assert.equal(checksum.status, 0, checksum.stderr);

  const base64 = invoke({
    ANDROID_EXPECTED_UPLOAD_CERT_SHA256: key.sha256,
    ANDROID_KEYSTORE_BASE64: readFileSync(join(root, "upload.p12")).toString("base64"),
    ANDROID_KEYSTORE_PATH: "./nonexistent.jks",
  });
  assert.equal(base64.status, 0, base64.stderr);
  assert.equal(calls().at(-1).versionCode, "31", ".env supplies the local version code");
});

test("local AAB command validates config and signing before prebuild, without debug fallback", (t) => {
  const { root, invoke } = localAabCheckout(t);
  const invalid = invoke({ FIREBASE_EXPECTED_PROJECT_ID: "wrong-project" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /does not match FIREBASE_EXPECTED_PROJECT_ID/);
  assert.equal(existsSync(join(root, "calls.jsonl")), false);
  const missing = invoke();
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /ANDROID_EXPECTED_UPLOAD_CERT_SHA256/);
  assert.equal(existsSync(join(root, "calls.jsonl")), false);
  signingKey(root, "upload");
  const mismatch = invoke({ ANDROID_EXPECTED_UPLOAD_CERT_SHA256: "0".repeat(64) });
  assert.equal(mismatch.status, 1, mismatch.stderr);
  assert.match(mismatch.stderr, /does not match ANDROID_EXPECTED_UPLOAD_CERT_SHA256/);
  assert.equal(existsSync(join(root, "calls.jsonl")), false);
});

test("local AAB command propagates build/signature failures and does not stage an artifact", (t) => {
  const { root, invoke } = localAabCheckout(t);
  const key = signingKey(root, "upload");
  bundle(root);
  const env = { ANDROID_EXPECTED_UPLOAD_CERT_SHA256: key.sha256 };
  const failed = invoke({ ...env, AAB_TEST_GRADLE_EXIT: "73" });
  assert.equal(failed.status, 73, failed.stderr);
  assert.equal(existsSync(join(root, "reports/android-release/app-release.aab")), false);
  const unsigned = invoke(env);
  assert.equal(unsigned.status, 1, unsigned.stderr);
  assert.match(unsigned.stderr, /not signed only with the upload certificate/);
  assert.equal(existsSync(join(root, "reports/android-release/app-release.aab")), false);
});

test("default local release still builds and inspects both APK and AAB without cleaning", (t) => {
  const { root, env, calls } = localAabCheckout(t);
  const key = signingKey(root, "upload");
  key.sign(bundle(root));
  writeFileSync(
    join(root, "bin/bunx"),
    `#!/bin/sh\nshift\nexec "${process.execPath}" node_modules/expo/bin/cli "$@"\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(root, "scripts/inspect-android-apk.py"),
    "from pathlib import Path\nPath('apk-inspected').write_text('yes')\n",
  );
  const result = spawnSync("bash", ["scripts/android-release.sh", "reports/default-release"], {
    cwd: root,
    env: {
      ...env,
      ANDROID_HOME: root,
      ANDROID_KEYSTORE_PATH: "./upload.p12",
      ANDROID_KEYSTORE_PASSWORD: "test-pass",
      ANDROID_KEY_ALIAS: "upload",
      ANDROID_EXPECTED_UPLOAD_CERT_SHA256: key.sha256,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const [expo, gradle] = calls();
  assert.deepEqual(expo.args, ["prebuild", "--platform", "android", "--no-install"]);
  assert.deepEqual(gradle.args, [
    "-p",
    "android",
    "--no-daemon",
    "assembleRelease",
    "bundleRelease",
  ]);
  assert.equal(existsSync(join(root, "apk-inspected")), true);
  assert.equal(existsSync(join(root, "reports/default-release/app-release.aab")), true);
});

test("local AAB help does not require credentials or start a build", (t) => {
  const { root, invoke } = localAabCheckout(t);
  const result = invoke({}, ["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Builds the current checkout locally/);
  assert.equal(existsSync(join(root, "calls.jsonl")), false);
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
