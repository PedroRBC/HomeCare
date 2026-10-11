#!/usr/bin/env bash
# Builds the release APK and AAB signed with the upload keystore given by environment
# variables, checks that both carry that keystore's certificate and stages them.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  printf 'Usage: %s OUTPUT_DIR [GRADLE_ARG...]\n' "$0" >&2
  exit 2
fi
mkdir -p "$1"
output=$(realpath "$1")
shift

missing=()
if [[ -z "${ANDROID_KEYSTORE_BASE64:-}" && -z "${ANDROID_KEYSTORE_PATH:-}" ]]; then
  missing+=("ANDROID_KEYSTORE_BASE64 or ANDROID_KEYSTORE_PATH")
fi
for name in ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_HOME; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done
if [[ ${#missing[@]} -gt 0 ]]; then
  printf 'Missing release signing environment: %s\n' "${missing[*]}" >&2
  exit 2
fi
build_tools=${ANDROID_BUILD_TOOLS:-$ANDROID_HOME/build-tools/36.0.0}

work=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/homecare-release.XXXXXX")
trap 'rm -rf -- "$work"' EXIT
if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
  # Tolerate the line wraps that `base64` adds before the value is pasted into a secret.
  if ! printf '%s' "$ANDROID_KEYSTORE_BASE64" | tr -d '[:space:]' | base64 --decode \
      >"$work/upload.keystore"; then
    printf 'ANDROID_KEYSTORE_BASE64 is not valid base64.\n' >&2
    exit 2
  fi
  ANDROID_KEYSTORE_PATH="$work/upload.keystore"
fi
ANDROID_KEYSTORE_PATH=$(realpath "$ANDROID_KEYSTORE_PATH")
ANDROID_KEY_PASSWORD=${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}
export ANDROID_KEYSTORE_PATH ANDROID_KEY_PASSWORD

if ! certificate=$(keytool -list -v -keystore "$ANDROID_KEYSTORE_PATH" \
    -alias "$ANDROID_KEY_ALIAS" -storepass:env ANDROID_KEYSTORE_PASSWORD 2>&1); then
  printf 'Cannot read the key alias from the keystore; check the keystore, password and alias.\n' >&2
  grep -v '^Picked up' <<<"$certificate" >&2 || true
  exit 1
fi
expected=$(awk '$1 == "SHA256:" { gsub(":", "", $2); print tolower($2); exit }' <<<"$certificate")
if [[ ! $expected =~ ^[0-9a-f]{64}$ ]]; then
  printf 'keytool did not report the upload certificate SHA-256.\n' >&2
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
CI=1 bunx expo prebuild --platform android --no-install --clean
chmod +x android/gradlew
android/gradlew -p android --no-daemon "$@" assembleRelease bundleRelease

python3 -I scripts/inspect-android-apk.py \
  android/app/build/outputs/apk/release/app-release.apk "$output" \
  --build-tools "$build_tools" --expected-signer-sha256 "$expected"

aab=android/app/build/outputs/bundle/release/app-release.aab
aab_signers=$(keytool -printcert -jarfile "$aab" 2>&1) || true
aab_signer=$(awk '$1 == "SHA256:" { gsub(":", "", $2); print tolower($2); exit }' <<<"$aab_signers")
aab_verification=$(jarsigner -verify "$aab" 2>&1) || true
if [[ $aab_signer != "$expected" ]] || grep -q '^Signer #2' <<<"$aab_signers" \
    || ! grep -q '^jar verified\.' <<<"$aab_verification"; then
  printf 'AAB is not signed only with the upload certificate.\n' >&2
  exit 1
fi
cp "$aab" "$output/app-release.aab"
(cd "$output" && sha256sum app-release.aab >app-release.aab.sha256)

printf 'Signed APK and AAB staged in %s (certificate SHA-256 %s)\n' "$output" "$expected"
