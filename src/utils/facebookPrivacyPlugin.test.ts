import { test } from "node:test";
import assert from "node:assert/strict";
import withFacebookPrivacy from "../../plugins/withFacebookPrivacy";

test("always-on Facebook privacy plugin disables native collection in Android and iOS fixtures", async () => {
  const config = withFacebookPrivacy({ name: "fixture", mods: {} }) as any;
  const nextMod = async (value: unknown) => value;
  const android = await config.mods?.android?.manifest?.({
    modResults: {
      manifest: {
        application: [{ $: { "android:name": ".MainApplication" } }],
      },
    },
    modRequest: { nextMod },
  } as never);
  const ios = await config.mods?.ios?.infoPlist?.({
    modResults: {},
    modRequest: { nextMod },
  } as never);

  assert.deepEqual(
    android?.modResults.manifest.application[0]["meta-data"].map(
      (item: { $: Record<string, string> }) => ({
        name: item.$["android:name"],
        value: item.$["android:value"],
      }),
    ),
    [
      { name: "com.facebook.sdk.AutoInitEnabled", value: "false" },
      { name: "com.facebook.sdk.AutoLogAppEventsEnabled", value: "false" },
      { name: "com.facebook.sdk.AdvertiserIDCollectionEnabled", value: "false" },
    ],
  );
  assert.deepEqual(ios?.modResults, {
    FacebookAutoInitEnabled: false,
    FacebookAutoLogAppEventsEnabled: false,
    FacebookAdvertiserIDCollectionEnabled: false,
  });
});

test("privacy plugin updates existing Android metadata instead of duplicating entries", async () => {
  const config = withFacebookPrivacy({ name: "fixture", mods: {} }) as any;
  const result = await config.mods?.android?.manifest?.({
    modResults: {
      manifest: {
        application: [
          {
            $: { "android:name": ".MainApplication" },
            "meta-data": [
              {
                $: {
                  "android:name": "com.facebook.sdk.AutoInitEnabled",
                  "android:value": "true",
                },
              },
            ],
          },
        ],
      },
    },
    modRequest: { nextMod: async (value: unknown) => value },
  } as never);

  const metadata = result?.modResults.manifest.application[0]["meta-data"];
  assert.equal(metadata.length, 3);
  assert.equal(metadata[0].$["android:value"], "false");
});
