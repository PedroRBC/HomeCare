import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("Android main activity follows the display orientation instead of letterboxing tablets", () => {
  const activity = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "-e",
        `const { exp } = require("@expo/config").getConfig(process.cwd());
         const { AndroidConfig } = require("@expo/config-plugins");
         const manifest = { manifest: { application: [{ activity: [{
           $: { "android:name": ".MainActivity" },
           "intent-filter": [{ action: [{ $: { "android:name": "android.intent.action.MAIN" } }] }]
         }] }] } };
         AndroidConfig.Orientation.setAndroidOrientation(exp, manifest);
         process.stdout.write(JSON.stringify(manifest.manifest.application[0].activity[0].$));`,
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: {
          ...process.env,
          EXPO_NO_DOTENV: "1",
          EXPO_NO_TELEMETRY: "1",
          GOOGLE_WEB_CLIENT_ID: "123456-web.apps.googleusercontent.com",
          FACEBOOK_APP_ID: "",
          FACEBOOK_CLIENT_TOKEN: "",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );

  assert.equal(activity["android:screenOrientation"], "unspecified");
});
