#!/usr/bin/env bash
# Validates the pinned upload key in --preflight mode; otherwise builds and stages
# signed release artifacts (only the AAB with --aab-only).
set -euo pipefail

aab_only=false
if [[ "${1:-}" == "--aab-only" ]]; then
  aab_only=true
  shift
fi
preflight=false
if [[ "${1:-}" == "--preflight" ]]; then
  preflight=true
  shift
elif [[ $# -lt 1 ]]; then
  printf 'Usage: %s [--aab-only] OUTPUT_DIR [GRADLE_ARG...] | --preflight\n' "$0" >&2
  exit 2
fi
if [[ $preflight == true && $# -ne 0 ]]; then
  printf 'Usage: %s --preflight\n' "$0" >&2
  exit 2
fi
if [[ $preflight == false ]]; then
  mkdir -p "$1"
  output=$(realpath "$1")
  shift
fi

missing=()
if [[ -z "${ANDROID_KEYSTORE_BASE64:-}" && -z "${ANDROID_KEYSTORE_PATH:-}" ]]; then
  missing+=("ANDROID_KEYSTORE_BASE64 or ANDROID_KEYSTORE_PATH")
fi
for name in ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_HOME ANDROID_EXPECTED_UPLOAD_CERT_SHA256; do
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
actual=$(awk '$1 == "SHA256:" { gsub(":", "", $2); print tolower($2); exit }' <<<"$certificate")
if [[ ! $actual =~ ^[0-9a-f]{64}$ ]]; then
  printf 'keytool did not report the upload certificate SHA-256.\n' >&2
  exit 1
fi
expected=$(tr -d ':' <<<"$ANDROID_EXPECTED_UPLOAD_CERT_SHA256" | tr 'A-F' 'a-f')
if [[ ! $expected =~ ^[0-9a-f]{64}$ ]]; then
  printf 'ANDROID_EXPECTED_UPLOAD_CERT_SHA256 must contain 64 hexadecimal digits.\n' >&2
  exit 2
fi
if [[ $actual != "$expected" ]]; then
  printf 'Upload keystore certificate does not match ANDROID_EXPECTED_UPLOAD_CERT_SHA256.\n' >&2
  exit 1
fi
if [[ $preflight == true ]]; then
  printf 'Upload keystore matches the pinned certificate.\n'
  exit 0
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ $aab_only == true ]]; then
  # Use the installed CLI and current files, without EAS or a temporary checkout.
  CI=1 node node_modules/expo/bin/cli prebuild --platform android --no-install
else
  CI=1 bunx expo prebuild --platform android --no-install
fi
chmod +x android/gradlew
if [[ $aab_only == true ]]; then
  android/gradlew -p android --no-daemon --no-parallel --max-workers=2 "$@" bundleRelease
else
  android/gradlew -p android --no-daemon "$@" assembleRelease bundleRelease
  python3 -I scripts/inspect-android-apk.py \
    android/app/build/outputs/apk/release/app-release.apk "$output" \
    --build-tools "$build_tools" --expected-signer-sha256 "$expected"
fi

aab=android/app/build/outputs/bundle/release/app-release.aab
bash scripts/verify-android-aab.sh "$aab" "$expected"
cp "$aab" "$output/app-release.aab"
(cd "$output" && sha256sum app-release.aab >app-release.aab.sha256)

if [[ $aab_only == true ]]; then
  printf 'Signed AAB staged in %s (certificate SHA-256 %s)\n' "$output" "$expected"
else
  printf 'Signed APK and AAB staged in %s (certificate SHA-256 %s)\n' "$output" "$expected"
fi
