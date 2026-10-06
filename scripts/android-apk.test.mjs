import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const inspector = fileURLToPath(new URL("./inspect-android-apk.py", import.meta.url));
const entries = [
  ["assets/index.android.bundle", "bundled javascript"],
  ["lib/arm64-v8a/libreactnative.so", "arm runtime"],
  ["lib/x86_64/libreactnative.so", "x86 runtime"],
];
const fixtureCode = `
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', compression=zipfile.ZIP_STORED) as archive:
    for name, contents in json.loads(sys.argv[2]):
        archive.writestr(name, contents)
`;

function fixture(t, contents = entries) {
  const root = mkdtempSync(join(tmpdir(), "homecare-apk-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const apk = join(root, "input release.apk");
  const output = join(root, "artifact output");
  const created = spawnSync("python3", ["-I", "-c", fixtureCode, apk, JSON.stringify(contents)], {
    encoding: "utf8",
  });
  assert.equal(created.status, 0, created.stderr);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("APK_") && !key.startsWith("GITHUB_"),
    ),
  );
  return {
    apk,
    output,
    inspect(options = [], environment = {}) {
      return spawnSync("python3", ["-I", inspector, apk, output, ...options], {
        env: { ...env, ...environment },
        encoding: "utf8",
      });
    },
  };
}

function assertRejected(f, message) {
  const result = f.inspect();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, message);
  assert.equal(existsSync(join(f.output, "app-release.apk")), false);
  assert.equal(existsSync(join(f.output, "metadata.json")), false);
}

test("stages identical APK, matching SHA-256, and supplied workflow metadata", (t) => {
  const f = fixture(t);
  const signer = "AB".repeat(32);
  const result = f.inspect(
    ["--version-name", "2.5.0", "--version-code", "25", "--signer-sha256", signer],
    { APK_PACKAGE_NAME: "com.pedrorbc.HomeCare", GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "123" },
  );
  assert.equal(result.status, 0, result.stderr);
  const apk = readFileSync(f.apk);
  assert.deepEqual(readFileSync(join(f.output, "app-release.apk")), apk);
  const sha256 = createHash("sha256").update(apk).digest("hex");
  assert.equal(
    readFileSync(join(f.output, "app-release.apk.sha256"), "utf8"),
    `${sha256}  app-release.apk\n`,
  );
  const metadata = JSON.parse(readFileSync(join(f.output, "metadata.json"), "utf8"));
  assert.equal(metadata.apk.sha256, sha256);
  assert.equal(metadata.apk.size_bytes, apk.length);
  assert.deepEqual(metadata.apk.abis, ["arm64-v8a", "x86_64"]);
  assert.equal(metadata.apk.bundle.size_bytes, Buffer.byteLength(entries[0][1]));
  assert.deepEqual(metadata.workflow_inputs, {
    package_name: "com.pedrorbc.HomeCare",
    version_name: "2.5.0",
    version_code: 25,
    signer_sha256: signer.toLowerCase(),
    commit: "a".repeat(40),
    run_id: "123",
  });
});

test("metadata is optional and does not claim ZIP signer verification", (t) => {
  const f = fixture(t);
  assert.equal(f.inspect().status, 0);
  const metadata = JSON.parse(readFileSync(join(f.output, "metadata.json"), "utf8"));
  assert.deepEqual(metadata.workflow_inputs, {});
  assert.equal("signer_verified" in metadata, false);
});

for (const abi of ["arm64-v8a", "x86_64"]) {
  test(`rejects missing ${abi} libraries`, (t) => {
    assertRejected(
      fixture(
        t,
        entries.filter(([name]) => !name.startsWith(`lib/${abi}/`)),
      ),
      new RegExp(abi),
    );
  });
}

for (const contents of [
  entries.slice(1),
  [["assets/index.android.bundle", ""], ...entries.slice(1)],
]) {
  test(`rejects ${contents.length === 2 ? "missing" : "empty"} offline bundle`, (t) => {
    assertRejected(fixture(t, contents), /nonempty assets\/index.android.bundle/);
  });
}

test("rejects an empty runtime library or unrelated .so placeholder", (t) => {
  for (const library of [
    ["lib/arm64-v8a/libreactnative.so", ""],
    ["lib/arm64-v8a/unrelated.so", "native"],
  ]) {
    assertRejected(fixture(t, [entries[0], library, entries[2]]), /arm64-v8a/);
  }
});

test("rejects invalid ZIP and corrupt entry payload", (t) => {
  const invalid = fixture(t);
  writeFileSync(invalid.apk, "not a zip");
  assertRejected(invalid, /APK inspection failed/);
  const corrupt = fixture(t);
  const bytes = readFileSync(corrupt.apk);
  bytes[bytes.indexOf(Buffer.from(entries[0][1]))] ^= 1;
  writeFileSync(corrupt.apk, bytes);
  assertRejected(corrupt, /corrupt ZIP entry/);
});

test("rejects duplicate ZIP entries", (t) => {
  assertRejected(fixture(t, [...entries, entries[0]]), /duplicate ZIP entries/);
});

test("rejects invalid workflow metadata and honors CLI over environment", (t) => {
  for (const options of [
    ["--package-name", "other.app"],
    ["--version-code", "not-a-number"],
    ["--signer-sha256", "not-a-digest"],
  ]) {
    const f = fixture(t);
    assert.equal(f.inspect(options).status, 1);
    assert.equal(existsSync(join(f.output, "app-release.apk")), false);
  }
  const f = fixture(t);
  assert.equal(f.inspect(["--version-name", "cli"], { APK_VERSION_NAME: "env" }).status, 0);
  const metadata = JSON.parse(readFileSync(join(f.output, "metadata.json"), "utf8"));
  assert.equal(metadata.workflow_inputs.version_name, "cli");
});

const certificateReport = `Signer #1 certificate SHA-1 digest: ${"ab".repeat(20)}
Signer #1 certificate SHA-256 digest: ${"cd".repeat(32)}
`;
const manifestReport =
  "package: name='com.pedrorbc.HomeCare' versionCode='1' versionName='2.5.0' platformBuildVersionName='16'";

function fakeBuildTools(
  f,
  {
    signing = certificateReport,
    manifest = manifestReport,
    signerStatus = 0,
    manifestStatus = 0,
  } = {},
) {
  const directory = join(f.output, "..", "SDK Build Tools");
  mkdirSync(directory);
  for (const [name, output, status] of [
    ["apksigner", signing, signerStatus],
    ["aapt", manifest, manifestStatus],
  ]) {
    writeFileSync(
      join(directory, name),
      `#!/bin/sh\ncat <<'REPORT'\n${output}\nREPORT\nexit ${status}\n`,
      { mode: 0o700 },
    );
  }
  return ["--build-tools", directory];
}

test("verifies via SDK tools and records observed package, version, certificate and PR metadata", (t) => {
  const f = fixture(t);
  const result = f.inspect(fakeBuildTools(f), {
    APK_PR_NUMBER: "36",
    APK_HEAD_SHA: "f".repeat(40),
    APK_RUN_URL: "https://example.com/run",
  });
  assert.equal(result.status, 0, result.stderr);
  const metadata = JSON.parse(readFileSync(join(f.output, "metadata.json"), "utf8"));
  assert.deepEqual(metadata.apk.android_verification, {
    package_name: "com.pedrorbc.HomeCare",
    version_code: 1,
    version_name: "2.5.0",
    certificate: { sha1: "ab".repeat(20), sha256: "cd".repeat(32) },
    tools: "Android SDK apksigner verify --print-certs and aapt dump badging",
  });
  assert.equal(metadata.workflow_inputs.pr_number, "36");
  assert.equal(metadata.workflow_inputs.head_sha, "f".repeat(40));
  assert.equal(metadata.workflow_inputs.run_url, "https://example.com/run");
  assert.match(readFileSync(join(f.output, "signature.txt"), "utf8"), /SHA-256 digest/);
  assert.match(readFileSync(join(f.output, "manifest.txt"), "utf8"), /com.pedrorbc.HomeCare/);
});

for (const [name, options] of [
  ["invalid signature", { signerStatus: 2 }],
  ["manifest command failure", { manifestStatus: 3 }],
  [
    "unexpected package",
    { manifest: manifestReport.replace("com.pedrorbc.HomeCare", "other.app") },
  ],
  [
    "invalid version code",
    { manifest: manifestReport.replace("versionCode='1'", "versionCode='0'") },
  ],
  ["missing fingerprint", { signing: "" }],
  ["multiple signers", { signing: certificateReport + "Signer #2 certificate SHA-1 digest: fake" }],
]) {
  test(`does not publish an APK after ${name}`, (t) => {
    const f = fixture(t);
    const result = f.inspect(fakeBuildTools(f, options));
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /APK inspection failed/);
    assert.equal(existsSync(join(f.output, "app-release.apk")), false);
    assert.equal(existsSync(join(f.output, "metadata.json")), false);
  });
}
