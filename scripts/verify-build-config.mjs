#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  isGoogleClientId,
  resolveGoogleWebClientId,
} = require("../src/utils/googleSignInConfig.js");
const { resolveFacebookConfig } = require("../src/utils/facebookSignInConfig.js");

const ANDROID_PACKAGE = "com.pedrorbc.HomeCare";
const SAFE_PROJECT_ID = /^[a-z][a-z0-9-]{3,29}$/;
const SAFE_ANDROID_APP_ID = /^1:\d{1,20}:android:[a-f0-9]{16,32}$/i;
const SAFE_FIREBASE_API_KEY = /^AIza[0-9A-Za-z_-]{35}$/;

export function validateBuildConfig({
  mode = "release",
  env = process.env,
  cwd = process.cwd(),
} = {}) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (mode !== "demo" && mode !== "release") fail("Unsupported verification mode.");

  const selectedPath = env.GOOGLE_SERVICES_JSON?.trim() || "./google-services.json";
  let services;
  try {
    services = JSON.parse(readFileSync(resolve(cwd, selectedPath), "utf8"));
  } catch {
    fail("Firebase Android configuration is missing or invalid.");
  }

  if (
    !services ||
    typeof services !== "object" ||
    !services.project_info ||
    !Array.isArray(services.client)
  ) {
    fail("Firebase Android configuration has an invalid structure.");
  }
  const projectId = services.project_info.project_id;
  const projectNumber = services.project_info.project_number;
  if (typeof projectId !== "string" || !SAFE_PROJECT_ID.test(projectId)) {
    fail("Firebase project ID has an invalid structure.");
  }
  if (typeof projectNumber !== "string" || !/^\d{1,20}$/.test(projectNumber)) {
    fail("Firebase project number has an invalid structure.");
  }
  const expectedProjectId = env.FIREBASE_EXPECTED_PROJECT_ID?.trim();
  if (expectedProjectId && projectId !== expectedProjectId) {
    fail("Firebase project does not match FIREBASE_EXPECTED_PROJECT_ID.");
  }
  const facebookEnabledExpectation = env.FACEBOOK_ENABLED?.trim().toLowerCase();
  if (
    env.FACEBOOK_ENABLED !== undefined &&
    !["true", "false"].includes(facebookEnabledExpectation)
  ) {
    fail("FACEBOOK_ENABLED must be set to true or false.");
  }
  if (mode === "demo") {
    if (!projectId.startsWith("demo-"))
      fail("Demo verification requires a demo-* Firebase project.");
  } else {
    if (projectId.startsWith("demo-"))
      fail("Release verification does not allow a demo Firebase project.");
    if (!expectedProjectId)
      fail("FIREBASE_EXPECTED_PROJECT_ID is required for release verification.");
    if (!facebookEnabledExpectation) {
      fail("FACEBOOK_ENABLED must be explicitly set to true or false for release verification.");
    }
  }

  const packageClients = services.client.filter(
    (client) =>
      client &&
      typeof client === "object" &&
      client.client_info &&
      typeof client.client_info === "object" &&
      client.client_info.android_client_info?.package_name === ANDROID_PACKAGE,
  );
  if (packageClients.length === 0)
    fail("Firebase configuration has no client for the required Android package.");

  for (const client of packageClients) {
    const appId = client.client_info.mobilesdk_app_id;
    if (
      typeof appId !== "string" ||
      !SAFE_ANDROID_APP_ID.test(appId) ||
      !appId.startsWith(`1:${services.project_info.project_number}:android:`)
    ) {
      fail("Firebase Android application ID has an invalid structure.");
    }
    if (
      !Array.isArray(client.api_key) ||
      client.api_key.length === 0 ||
      !client.api_key.every(
        (apiKey) =>
          apiKey &&
          typeof apiKey === "object" &&
          typeof apiKey.current_key === "string" &&
          SAFE_FIREBASE_API_KEY.test(apiKey.current_key),
      )
    ) {
      fail("Firebase Android client must include a valid API key.");
    }
  }

  let expectedWebClientId;
  try {
    expectedWebClientId = resolveGoogleWebClientId({
      androidPackage: ANDROID_PACKAGE,
      loadGoogleServices: () => services,
    });
  } catch {
    fail(
      "Firebase configuration must include exactly one valid Web OAuth client for the Android package.",
    );
  }
  const override = env.GOOGLE_WEB_CLIENT_ID?.trim();
  if (override && (!isGoogleClientId(override) || override !== expectedWebClientId)) {
    fail("GOOGLE_WEB_CLIENT_ID must match the configured Web OAuth client.");
  }

  let facebook;
  try {
    facebook = resolveFacebookConfig({
      appId: env.FACEBOOK_APP_ID,
      clientToken: env.FACEBOOK_CLIENT_TOKEN,
    });
  } catch {
    fail("Facebook configuration is invalid.");
  }
  if (
    env.FACEBOOK_ENABLED &&
    facebook.enabled !== (env.FACEBOOK_ENABLED.trim().toLowerCase() === "true")
  ) {
    fail("Facebook configuration does not match FACEBOOK_ENABLED.");
  }

  return { mode, projectId, packageName: ANDROID_PACKAGE, facebookEnabled: facebook.enabled };
}

function parseMode(args) {
  if (args.length === 0) return "release";
  if (args.length !== 2 || args[0] !== "--mode" || !["demo", "release"].includes(args[1])) {
    throw new Error("Usage: node scripts/verify-build-config.mjs [--mode demo|release]");
  }
  return args[1];
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = validateBuildConfig({ mode: parseMode(process.argv.slice(2)) });
    process.stdout.write(`Build configuration verified (${result.mode}).\n`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Build configuration verification failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
