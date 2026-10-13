import { test } from "node:test";
import assert from "node:assert/strict";
import { feedbackEmulatorConfig, firestoreValue } from "./seed-feedback-emulator.mjs";

const valid = {
  GCLOUD_PROJECT: "demo-homecare-rules",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199",
  FIRESTORE_EMULATOR_HOST: "localhost:8180",
};
test("feedback seeding only targets explicit loopback demo emulators", () => {
  assert.deepEqual(feedbackEmulatorConfig(valid), {
    projectId: "demo-homecare-rules",
    authHost: "127.0.0.1:9199",
    firestoreHost: "localhost:8180",
  });
  for (const change of [
    { GCLOUD_PROJECT: "homecare-production" },
    { GCLOUD_PROJECT: "demo-x/../../other" },
    { FIREBASE_AUTH_EMULATOR_HOST: undefined },
    { FIRESTORE_EMULATOR_HOST: "example.com:8180" },
    { FIREBASE_AUTH_EMULATOR_HOST: "localhost:99999" },
    { FIRESTORE_EMULATOR_HOST: "localhost:8180/other" },
  ]) {
    assert.throws(() => feedbackEmulatorConfig({ ...valid, ...change }));
  }
});
test("synthetic Firestore fields preserve nulls and nested values", () => {
  assert.deepEqual(
    firestoreValue({ version: 1, enabled: true, context: { appVersion: null, language: "en" } }),
    {
      mapValue: {
        fields: {
          version: { integerValue: "1" },
          enabled: { booleanValue: true },
          context: {
            mapValue: {
              fields: { appVersion: { nullValue: null }, language: { stringValue: "en" } },
            },
          },
        },
      },
    },
  );
  assert.throws(() => firestoreValue(["not supported"]));
});
