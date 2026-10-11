import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RELEASE_SIGNING_GRADLE,
  addReleaseSigning,
  resolveAndroidVersionCode,
} from "./androidReleaseConfig";

const template = `android {
    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}
`;

test("appends env-driven release signing after the template, once", () => {
  const signed = addReleaseSigning(template);
  assert.ok(signed.startsWith(template.trimEnd()));
  assert.ok(signed.endsWith(RELEASE_SIGNING_GRADLE));
  assert.equal(addReleaseSigning(signed), signed);
  assert.match(RELEASE_SIGNING_GRADLE, /System\.getenv\("ANDROID_KEYSTORE_PATH"\)/);
  assert.match(RELEASE_SIGNING_GRADLE, /signingConfig signingConfigs\.release/);
});

test("accepts only Play-compatible version codes", () => {
  assert.equal(resolveAndroidVersionCode(undefined), undefined);
  assert.equal(resolveAndroidVersionCode(" "), undefined);
  assert.equal(resolveAndroidVersionCode("42\n"), 42);
  assert.equal(resolveAndroidVersionCode("2100000000"), 2100000000);
  for (const invalid of ["0", "-1", "1.5", "07", "abc", "2100000001", "$GITHUB_RUN_NUMBER"]) {
    assert.throws(() => resolveAndroidVersionCode(invalid), /ANDROID_VERSION_CODE/, invalid);
  }
});
