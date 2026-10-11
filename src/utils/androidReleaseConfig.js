// Plain JavaScript keeps this helper usable by Expo's Node-based config loader.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING_MARKER = "// @homecare release-signing";
// Google Play rejects larger version codes.
const MAX_ANDROID_VERSION_CODE = 2100000000;

// Appended after the template's android {} block so it replaces the debug signing of
// release builds without depending on the template's exact text. Without
// ANDROID_KEYSTORE_PATH the template's debug signing stays, keeping preview builds working.
const RELEASE_SIGNING_GRADLE = `${RELEASE_SIGNING_MARKER}
def releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")?.trim()
if (releaseKeystorePath) {
    def requiredReleaseEnv = { String name ->
        def value = System.getenv(name)
        if (!value) {
            throw new GradleException("\${name} is required when ANDROID_KEYSTORE_PATH is set.")
        }
        return value
    }
    // Relative paths are resolved from the repository root, like the rest of .env.
    def releaseKeystore = new File(releaseKeystorePath)
    if (!releaseKeystore.isAbsolute()) {
        releaseKeystore = new File(rootDir.parentFile, releaseKeystorePath)
    }
    if (!releaseKeystore.isFile()) {
        throw new GradleException("ANDROID_KEYSTORE_PATH does not point to a keystore file.")
    }
    def releaseStorePassword = requiredReleaseEnv("ANDROID_KEYSTORE_PASSWORD")
    def releaseKeyAlias = requiredReleaseEnv("ANDROID_KEY_ALIAS")
    // PKCS12 keystores (keytool's default) use the store password for the key.
    def releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: releaseStorePassword
    android {
        signingConfigs {
            release {
                storeFile releaseKeystore
                storePassword releaseStorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
}
`;

/** @param {string} buildGradle @returns {string} */
const addReleaseSigning = (buildGradle) =>
  buildGradle.includes(RELEASE_SIGNING_MARKER)
    ? buildGradle
    : `${buildGradle.trimEnd()}\n\n${RELEASE_SIGNING_GRADLE}`;

/**
 * Signs release APKs/AABs with the upload key from environment variables.
 * @template {import("expo/config").ExpoConfig} T
 * @param {T} config
 * @returns {T}
 */
const withAndroidReleaseSigning = (config) =>
  /** @type {T} */ (
    withAppBuildGradle(config, (gradleConfig) => {
      if (gradleConfig.modResults.language !== "groovy") {
        throw new Error("Release signing expects a Groovy android/app/build.gradle.");
      }
      gradleConfig.modResults.contents = addReleaseSigning(gradleConfig.modResults.contents);
      return gradleConfig;
    })
  );

/**
 * @param {string | undefined} value ANDROID_VERSION_CODE
 * @returns {number | undefined}
 */
const resolveAndroidVersionCode = (value) => {
  const versionCode = value?.trim();
  if (!versionCode) return undefined;
  if (!/^[1-9]\d{0,9}$/.test(versionCode) || Number(versionCode) > MAX_ANDROID_VERSION_CODE) {
    throw new Error(
      `ANDROID_VERSION_CODE must be a positive integer up to ${MAX_ANDROID_VERSION_CODE}.`,
    );
  }
  return Number(versionCode);
};

module.exports = {
  RELEASE_SIGNING_GRADLE,
  addReleaseSigning,
  resolveAndroidVersionCode,
  withAndroidReleaseSigning,
};
