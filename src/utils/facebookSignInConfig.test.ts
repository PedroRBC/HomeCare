import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  isFacebookAppId,
  isFacebookClientToken,
  resolveFacebookConfig,
} from "./facebookSignInConfig";

test("Facebook config is disabled when both optional values are absent", () => {
  assert.deepEqual(resolveFacebookConfig({}), { enabled: false });
  assert.deepEqual(resolveFacebookConfig({ appId: "   ", clientToken: "" }), { enabled: false });
});

test("Facebook config trims and enables a complete app ID/client token pair", () => {
  assert.equal(isFacebookAppId("1234567890"), true);
  assert.equal(isFacebookClientToken("client-token-value"), true);
  assert.deepEqual(
    resolveFacebookConfig({ appId: " 1234567890 ", clientToken: " client-token-value " }),
    { enabled: true, appId: "1234567890", clientToken: "client-token-value" },
  );
});

const projectRoot = resolve(__dirname, "../..");
const readExpoConfig = (env: Record<string, string>) =>
  JSON.parse(
    execFileSync(
      "node",
      [
        "-e",
        'const { exp } = require("@expo/config").getConfig(process.cwd()); process.stdout.write(JSON.stringify({ extra: exp.extra, facebookPlugins: exp.plugins.filter(p => Array.isArray(p) && p[0] === "react-native-fbsdk-next") }));',
      ],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          EXPO_NO_DOTENV: "1",
          EXPO_NO_TELEMETRY: "1",
          FACEBOOK_APP_ID: "",
          FACEBOOK_CLIENT_TOKEN: "",
          ...env,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  ) as {
    extra: { facebookEnabled: boolean; facebookAppId?: string; facebookClientToken?: string };
    facebookPlugins: [string, Record<string, unknown>][];
  };

test("Expo config disables Facebook without native plugin or client token in extra", () => {
  const config = readExpoConfig({});
  assert.equal(config.extra.facebookEnabled, false);
  assert.equal("facebookAppId" in config.extra, false);
  assert.deepEqual(config.facebookPlugins, []);
});

test("Expo config adds Facebook plugin privacy defaults only for a complete configuration", () => {
  const config = readExpoConfig({
    FACEBOOK_APP_ID: "1234567890",
    FACEBOOK_CLIENT_TOKEN: "client-token",
  });
  assert.equal(config.extra.facebookEnabled, true);
  assert.equal(config.extra.facebookAppId, "1234567890");
  assert.equal("facebookClientToken" in config.extra, false);
  assert.deepEqual(config.facebookPlugins, [
    [
      "react-native-fbsdk-next",
      {
        appID: "1234567890",
        clientToken: "client-token",
        displayName: "HomeCare",
        isAutoInitEnabled: false,
        autoLogAppEventsEnabled: false,
        advertiserIDCollectionEnabled: false,
        iosUserTrackingPermission: false,
      },
    ],
  ]);
});

test("Facebook config rejects partial values, malformed IDs, and placeholders", () => {
  for (const options of [
    { appId: "1234567890" },
    { clientToken: "client-token-value" },
    { appId: "not-an-app-id", clientToken: "client-token-value" },
    { appId: "$FACEBOOK_APP_ID", clientToken: "client-token-value" },
    { appId: "1234567890", clientToken: "${FACEBOOK_CLIENT_TOKEN}" },
    { appId: "1234567890", clientToken: "your-facebook-client-token" },
  ]) {
    assert.throws(() => resolveFacebookConfig(options), /FACEBOOK_(?:APP_ID|CLIENT_TOKEN)/);
  }

  assert.equal(isFacebookAppId(undefined), false);
  assert.equal(isFacebookAppId("YOUR_FACEBOOK_APP_ID"), false);
  assert.equal(isFacebookClientToken("<client-token>"), false);
});
