import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { validateBuildConfig } from "./verify-build-config.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(scriptDir, "fixtures/firebase-ci.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const tempDir = () => mkdtempSync(resolve(tmpdir(), "homecare-build-config-"));
const writeConfig = (dir, value) => {
  const path = resolve(dir, "firebase.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
};
const demoEnv = (path, extra = {}) => ({
  GOOGLE_SERVICES_JSON: path,
  FACEBOOK_ENABLED: "false",
  ...extra,
});

test("demo mode accepts only a synthetic demo Firebase project and native config", () => {
  const result = validateBuildConfig({
    mode: "demo",
    env: demoEnv(fixturePath, {
      GOOGLE_WEB_CLIENT_ID: fixture.client[0].oauth_client[0].client_id,
    }),
  });
  assert.deepEqual(result, {
    mode: "demo",
    projectId: "demo-homecare-ci",
    packageName: "com.pedrorbc.HomeCare",
    facebookEnabled: false,
  });
});

test("release mode requires an independently supplied expected project and Facebook expectation", () => {
  const dir = tempDir();
  try {
    const liveLikeConfig = structuredClone(fixture);
    liveLikeConfig.project_info.project_id = "homecare-production";
    liveLikeConfig.client[0].client_info.mobilesdk_app_id =
      "1:123456789012:android:abcdef0123456789abcdef";
    const path = writeConfig(dir, liveLikeConfig);
    const base = { GOOGLE_SERVICES_JSON: path };
    assert.throws(
      () => validateBuildConfig({ mode: "release", env: base }),
      /FIREBASE_EXPECTED_PROJECT_ID/,
    );
    assert.throws(
      () =>
        validateBuildConfig({
          mode: "release",
          env: { ...base, FIREBASE_EXPECTED_PROJECT_ID: "homecare-production" },
        }),
      /FACEBOOK_ENABLED/,
    );
    assert.equal(
      validateBuildConfig({
        mode: "release",
        env: {
          ...base,
          FIREBASE_EXPECTED_PROJECT_ID: "homecare-production",
          FACEBOOK_ENABLED: "false",
        },
      }).projectId,
      "homecare-production",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release rejects demo projects and an independently mismatched expected project", () => {
  assert.throws(
    () =>
      validateBuildConfig({
        mode: "release",
        env: { ...demoEnv(fixturePath), FIREBASE_EXPECTED_PROJECT_ID: "demo-homecare-ci" },
      }),
    /does not allow a demo/,
  );
  const dir = tempDir();
  try {
    const liveLikeConfig = structuredClone(fixture);
    liveLikeConfig.project_info.project_id = "homecare-production";
    const path = writeConfig(dir, liveLikeConfig);
    assert.throws(
      () =>
        validateBuildConfig({
          mode: "release",
          env: { ...demoEnv(path), FIREBASE_EXPECTED_PROJECT_ID: "another-project" },
        }),
      /does not match FIREBASE_EXPECTED_PROJECT_ID/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Google web override must match the Firebase Web OAuth client exactly", () => {
  const clientId = fixture.client[0].oauth_client[0].client_id;
  assert.equal(
    validateBuildConfig({
      mode: "demo",
      env: demoEnv(fixturePath, { GOOGLE_WEB_CLIENT_ID: clientId }),
    }).projectId,
    "demo-homecare-ci",
  );
  assert.throws(
    () =>
      validateBuildConfig({
        mode: "demo",
        env: demoEnv(fixturePath, {
          GOOGLE_WEB_CLIENT_ID: "123456789012-other.apps.googleusercontent.com",
        }),
      }),
    /must match the configured Web OAuth client/,
  );
});

test("Facebook expectation must agree with a complete valid native configuration", () => {
  const base = { GOOGLE_SERVICES_JSON: fixturePath, FACEBOOK_ENABLED: "true" };
  assert.throws(
    () => validateBuildConfig({ mode: "demo", env: base }),
    /does not match FACEBOOK_ENABLED/,
  );
  assert.throws(
    () =>
      validateBuildConfig({
        mode: "demo",
        env: { ...demoEnv(fixturePath), FACEBOOK_ENABLED: "disabled" },
      }),
    /FACEBOOK_ENABLED must be set to true or false/,
  );
  assert.equal(
    validateBuildConfig({
      mode: "demo",
      env: {
        ...base,
        FACEBOOK_APP_ID: "1234567890",
        FACEBOOK_CLIENT_TOKEN: "synthetic-client-token",
      },
    }).facebookEnabled,
    true,
  );
  assert.throws(
    () =>
      validateBuildConfig({
        mode: "demo",
        env: { ...base, FACEBOOK_APP_ID: "1234567890" },
      }),
    /Facebook configuration is invalid/,
  );
});

test("a malformed Firebase file cannot be bypassed by a Google web override", () => {
  const dir = tempDir();
  try {
    const path = resolve(dir, "broken.json");
    writeFileSync(path, "{broken");
    assert.throws(
      () =>
        validateBuildConfig({
          mode: "demo",
          env: demoEnv(path, { GOOGLE_WEB_CLIENT_ID: fixture.client[0].oauth_client[0].client_id }),
        }),
      /missing or invalid/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checker rejects malformed or mismatched Firebase Android client structure", () => {
  const dir = tempDir();
  try {
    for (const mutate of [
      (value) => {
        value.client[0].client_info.android_client_info.package_name = "com.other.app";
      },
      (value) => {
        value.client[0].client_info.mobilesdk_app_id = "not-an-app-id";
      },
      (value) => {
        value.client[0].api_key = [];
      },
      (value) => {
        value.client[0].api_key[0].current_key = "not-a-key";
      },
      (value) => {
        value.client[0].api_key.unshift({ current_key: "not-a-key" });
      },
      (value) => {
        value.client[0].api_key.push({ current_key: "not-a-key" });
      },
      (value) => {
        value.client[0].oauth_client[0].client_type = 1;
      },
    ]) {
      const value = structuredClone(fixture);
      mutate(value);
      const path = writeConfig(dir, value);
      assert.throws(() => validateBuildConfig({ mode: "demo", env: demoEnv(path) }));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI defaults to release and never prints config values on failure", () => {
  const badFile = resolve(tempDir(), "private-firebase-token.json");
  writeFileSync(badFile, "not json");
  const env = {
    PATH: process.env.PATH,
    GOOGLE_SERVICES_JSON: badFile,
    GOOGLE_WEB_CLIENT_ID: "123456789012-private-client.apps.googleusercontent.com",
    EXPO_NO_DOTENV: "1",
  };
  try {
    const result = spawnSync(process.execPath, [resolve(scriptDir, "verify-build-config.mjs")], {
      cwd: resolve(scriptDir, ".."),
      env,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing or invalid/);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /private-firebase-token|private-client/,
    );
    const demo = execFileSync(
      process.execPath,
      [resolve(scriptDir, "verify-build-config.mjs"), "--mode", "demo"],
      {
        cwd: resolve(scriptDir, ".."),
        env: {
          PATH: process.env.PATH,
          GOOGLE_SERVICES_JSON: fixturePath,
          FACEBOOK_ENABLED: "false",
        },
        encoding: "utf8",
      },
    );
    assert.match(demo, /verified \(demo\)/);
  } finally {
    rmSync(dirname(badFile), { recursive: true, force: true });
  }
});
