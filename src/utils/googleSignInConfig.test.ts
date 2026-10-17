import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { isGoogleClientId, resolveGoogleWebClientId } from "./googleSignInConfig";

const androidPackage = "com.example.homecare";
const webClientId = "123456-webclient.apps.googleusercontent.com";
const otherWebClientId = "123456-otherclient.apps.googleusercontent.com";
const androidClientId = "123456-androidclient.apps.googleusercontent.com";
const oauth = (client_id = webClientId, client_type = 3) => ({ client_id, client_type });
const client = (package_name = androidPackage, oauth_client = [oauth()]) => ({
  client_info: { android_client_info: { package_name } },
  oauth_client,
});
const resolveId = (googleServices: unknown, override?: string) =>
  resolveGoogleWebClientId({
    webClientId: override,
    androidPackage,
    loadGoogleServices: () => googleServices,
  });

test("selects the Web OAuth client for the Android package, not another package or type 1", () => {
  assert.equal(
    resolveId({
      client: [
        client("com.example.other", [oauth(otherWebClientId)]),
        client(androidPackage, [oauth(androidClientId, 1), oauth()]),
      ],
    }),
    webClientId,
  );
});

test("a valid override is trimmed and does not require a readable Firebase file", () => {
  assert.equal(
    resolveGoogleWebClientId({
      webClientId: ` ${otherWebClientId} `,
      androidPackage,
      loadGoogleServices: () => {
        throw new Error("Firebase file is unavailable during config evaluation");
      },
    }),
    otherWebClientId,
  );
  assert.equal(resolveId({ client: [client()] }, "   "), webClientId);
});

test("rejects native OAuth overrides identified by the selected Firebase file", () => {
  for (const clientType of [1, 2]) {
    for (const packageName of [androidPackage, "com.example.other"]) {
      const services = {
        client: [client(packageName, [oauth(androidClientId, clientType), oauth()])],
      };
      assert.throws(() => resolveId(services, ` ${androidClientId} `), /native OAuth client/);
      assert.throws(
        () => resolveId(services, androidClientId.toUpperCase()),
        /native OAuth client/,
      );
      assert.equal(resolveId(services, webClientId), webClientId);
      assert.equal(resolveId(services, otherWebClientId), otherWebClientId);
    }
  }
});

test("rejects iOS OAuth overrides listed under Firebase's other-platform clients", () => {
  const services = {
    client: [
      {
        ...client(),
        services: {
          appinvite_service: { other_platform_oauth_client: [oauth(androidClientId, 2)] },
        },
      },
    ],
  };
  assert.throws(() => resolveId(services, androidClientId), /native OAuth client/);
  assert.equal(resolveId(services, webClientId), webClientId);
});

test("rejects placeholders and malformed overrides instead of silently using the fallback", () => {
  for (const value of [
    "$GOOGLE_WEB_CLIENT_ID",
    "${GOOGLE_WEB_CLIENT_ID}",
    "SEU_WEB_CLIENT_ID.apps.googleusercontent.com",
    "invalid",
    "123456-client with spaces.apps.googleusercontent.com",
  ]) {
    assert.equal(isGoogleClientId(value), false);
    assert.throws(() => resolveId({ client: [client()] }, value), /GOOGLE_WEB_CLIENT_ID/);
  }
  assert.equal(isGoogleClientId(undefined), false);
  assert.equal(isGoogleClientId(null), false);
});

test("deduplicates Web clients but rejects ambiguous distinct IDs", () => {
  assert.equal(resolveId({ client: [client(), client()] }), webClientId);
  assert.throws(
    () => resolveId({ client: [client(androidPackage, [oauth(), oauth(otherWebClientId)])] }),
    /exactly one distinct Web OAuth client ID/,
  );
});

test("rejects a missing package, missing Web client and malformed Firebase configuration", () => {
  assert.throws(() => resolveId({ client: [client("com.example.other")] }), /no client for/);
  assert.throws(
    () => resolveId({ client: [client(androidPackage, [oauth(androidClientId, 1)])] }),
    /exactly one distinct Web OAuth client ID/,
  );
  assert.throws(
    () => resolveId({ client: [client(androidPackage, [oauth("invalid")])] }),
    /invalid Web OAuth client ID/,
  );
  for (const value of [null, {}, { client: "invalid" }]) {
    assert.throws(() => resolveId(value), /no Firebase Android clients/);
  }
});

const projectRoot = resolve(__dirname, "../..");
const makeExpoFixture = () =>
  JSON.stringify({
    client: [client("com.pedrorbc.HomeCare", [oauth(), oauth(androidClientId, 1)])],
  });
const readExpoConfig = (
  env: Record<string, string> = {},
  useDefaultGooglePath = false,
  stubDefaultGoogleFile = false,
) => {
  const directory = mkdtempSync(join(tmpdir(), "homecare-google-expo-"));
  const file = join(directory, "google-services.json");
  writeFileSync(file, makeExpoFixture());
  try {
    return JSON.parse(
      execFileSync(
        "node",
        [
          "-e",
          'const fs = require("node:fs"); const path = require("node:path"); let defaultFirebaseReads = 0; const originalReadFileSync = fs.readFileSync; fs.readFileSync = (file, ...args) => { if (process.env.STUB_DEFAULT_GOOGLE_FILE === "1" && path.resolve(String(file)) === path.resolve(process.cwd(), "google-services.json")) { defaultFirebaseReads++; throw new Error("isolated missing Firebase file"); } return originalReadFileSync(file, ...args); }; const { exp } = require("@expo/config").getConfig(process.cwd()); process.stdout.write(JSON.stringify({ webClientId: exp.extra.googleWebClientId, googleServicesFile: exp.android.googleServicesFile, defaultFirebaseReads }));',
        ],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            EXPO_NO_DOTENV: "1",
            EXPO_NO_TELEMETRY: "1",
            GOOGLE_WEB_CLIENT_ID: "",
            GOOGLE_SERVICES_JSON: useDefaultGooglePath ? "" : file,
            STUB_DEFAULT_GOOGLE_FILE: stubDefaultGoogleFile ? "1" : "",
            FACEBOOK_APP_ID: "",
            FACEBOOK_CLIENT_TOKEN: "",
            ...env,
          },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    ) as { webClientId: string; googleServicesFile: string; defaultFirebaseReads: number };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("Expo's Node config loader resolves the Web client using isolated Firebase config", () => {
  const config = readExpoConfig();
  assert.equal(config.webClientId, webClientId);
});

test("default google-services path remains configured without requiring the local file", () => {
  const config = readExpoConfig({ GOOGLE_WEB_CLIENT_ID: webClientId }, true, true);
  assert.equal(config.googleServicesFile, "./google-services.json");
  assert.equal(config.webClientId, webClientId);
  assert.equal(config.defaultFirebaseReads, 1);
});

test("Expo rejects a synthetic native OAuth client as a Web override", () => {
  assert.throws(
    () => readExpoConfig({ GOOGLE_WEB_CLIENT_ID: androidClientId }),
    /native OAuth client/,
  );
});

test("Expo reads the selected Firebase file using relative or absolute paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "homecare-google-config-"));
  const path = join(directory, "google-services.json");
  try {
    writeFileSync(
      path,
      JSON.stringify({ client: [client("com.pedrorbc.HomeCare", [oauth(otherWebClientId)])] }),
    );
    for (const selectedPath of [path, relative(projectRoot, path)]) {
      const config = readExpoConfig({ GOOGLE_SERVICES_JSON: selectedPath });
      assert.equal(config.googleServicesFile, selectedPath);
      assert.equal(config.webClientId, otherWebClientId);
    }

    writeFileSync(path, "invalid JSON");
    assert.throws(() => readExpoConfig({ GOOGLE_SERVICES_JSON: path }), /Unable to read/);
    assert.throws(
      () => readExpoConfig({ GOOGLE_SERVICES_JSON: join(directory, "missing.json") }),
      /Unable to read/,
    );
    assert.equal(
      readExpoConfig({ GOOGLE_SERVICES_JSON: path, GOOGLE_WEB_CLIENT_ID: webClientId }).webClientId,
      webClientId,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("EAS profiles never override managed IDs with shell placeholders", () => {
  const eas = JSON.parse(readFileSync(join(projectRoot, "eas.json"), "utf8"));
  for (const profile of Object.values(eas.build) as { env?: Record<string, string> }[]) {
    for (const [key, value] of Object.entries(profile.env ?? {})) {
      if (key.startsWith("GOOGLE_") && key.endsWith("CLIENT_ID")) {
        assert.equal(isGoogleClientId(value), true, `${key} must not be a shell placeholder`);
      }
    }
  }
});
