import assert from "node:assert/strict";
import { createDecipheriv, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import {
  encryptField,
  firestoreValue,
  mobileEmulatorConfig,
  seedMobileEmulator,
} from "./seed-mobile-emulator.mjs";

const require = createRequire(import.meta.url);
const { resolveFirebaseEmulatorConfig } = require("../src/utils/firebaseEmulatorConfig.js");

test("runtime emulator opt-in is off by default and fails closed for release, project or host", () => {
  assert.deepEqual(resolveFirebaseEmulatorConfig({ isDev: true, projectId: "demo-homecare-ci" }), {
    enabled: false,
  });
  const base = { enabled: "1", isDev: true, projectId: "demo-homecare-ci" };
  assert.deepEqual(resolveFirebaseEmulatorConfig(base), {
    enabled: true,
    projectId: "demo-homecare-ci",
    auth: { host: "127.0.0.1", port: 9199 },
    firestore: { host: "127.0.0.1", port: 8180 },
  });
  assert.throws(() => resolveFirebaseEmulatorConfig({ ...base, isDev: false }), /__DEV__/);
  assert.throws(
    () => resolveFirebaseEmulatorConfig({ ...base, projectId: "homecare-prod" }),
    /demo-/,
  );
  assert.throws(() => resolveFirebaseEmulatorConfig({ ...base, authHost: "10.0.2.2" }), /loopback/);
});

const validEnv = {
  GCLOUD_PROJECT: "demo-homecare-ci",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199",
  FIRESTORE_EMULATOR_HOST: "localhost:8180",
};

test("mobile seed guard requires explicit demo project and loopback emulator endpoints", () => {
  assert.deepEqual(mobileEmulatorConfig(validEnv), {
    projectId: "demo-homecare-ci",
    authHost: "127.0.0.1:9199",
    firestoreHost: "localhost:8180",
  });
  for (const env of [
    { ...validEnv, GCLOUD_PROJECT: "homecare-prod" },
    { ...validEnv, FIREBASE_AUTH_EMULATOR_HOST: "firebase.google.com:9199" },
    { ...validEnv, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8181" },
    { ...validEnv, GCLOUD_PROJECT: undefined },
  ]) {
    assert.throws(() => mobileEmulatorConfig(env), /demo-\*|port/);
  }
});

test("Firestore REST conversion preserves nested maps, arrays, numbers and timestamps", () => {
  assert.deepEqual(
    firestoreValue({
      count: 2,
      amount: 2.5,
      enabled: false,
      tags: ["a", "b"],
      at: new Date("2026-01-02T03:04:05.000Z"),
    }),
    {
      mapValue: {
        fields: {
          count: { integerValue: "2" },
          amount: { doubleValue: 2.5 },
          enabled: { booleanValue: false },
          tags: { arrayValue: { values: [{ stringValue: "a" }, { stringValue: "b" }] } },
          at: { timestampValue: "2026-01-02T03:04:05.000Z" },
        },
      },
    },
  );
});

test("seed field encryption matches enc:v1 AES-GCM context format", () => {
  const key = randomBytes(32);
  const context = "houses/house/caregivers/cg#amount";
  const encoded = encryptField(key, 180, context);
  assert.match(encoded, /^enc:v1:[A-Za-z0-9+/]+=*$/);
  const payload = Buffer.from(encoded.slice("enc:v1:".length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(payload.subarray(-16));
  const value = JSON.parse(
    Buffer.concat([decipher.update(payload.subarray(12, -16)), decipher.final()]).toString("utf8"),
  );
  assert.equal(value, 180);
});

test("seed sends only synthetic data to local emulators and writes private credentials", async () => {
  const temp = mkdtempSync(join(tmpdir(), "homecare-mobile-seed-"));
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).includes("accounts:signUp")) {
      return new Response(JSON.stringify({ localId: "synthetic-uid", idToken: "local-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ name: "projects/demo-homecare-ci/databases/(default)/documents/seeded" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await seedMobileEmulator(validEnv, { reportsDir: temp });
    assert.equal(result.projectId, "demo-homecare-ci");
    assert.equal(result.houseId, "demo-homecare-house-synthetic-uid");
    assert.ok(requests.length > 5);
    assert.ok(
      requests.every(
        ({ url }) => new URL(url).hostname === "127.0.0.1" || new URL(url).hostname === "localhost",
      ),
    );
    const firestoreWrites = requests.filter(({ url }) => url.includes("/documents/"));
    assert.ok(firestoreWrites.every(({ init }) => init.headers.Authorization === "Bearer owner"));
    const paths = firestoreWrites.map(({ url }) => decodeURIComponent(new URL(url).pathname));
    assert.ok(paths.some((path) => path.includes("/users/synthetic-uid")));
    assert.ok(paths.some((path) => path.includes("/house_keys/demo-homecare-house")));
    assert.ok(paths.some((path) => path.includes("/caregivers/demo-caregiver-ana")));
    assert.ok(paths.some((path) => path.includes("/schedule/")));
    assert.ok(paths.some((path) => path.includes("/payments/")));
    const credentials = JSON.parse(readFileSync(result.credentialsPath, "utf8"));
    assert.equal(credentials.projectId, "demo-homecare-ci");
    assert.match(credentials.password, /^[A-Za-z0-9_-]{30,}$/);
    assert.equal(statSync(result.credentialsPath).mode & 0o777, 0o600);
  } finally {
    globalThis.fetch = previousFetch;
    rmSync(temp, { recursive: true, force: true });
  }
});
