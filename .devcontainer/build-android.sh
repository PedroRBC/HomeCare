#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

usage() {
  cat <<'EOF'
Usage:
  .devcontainer/build-android.sh local [apk|aab]
  .devcontainer/build-android.sh eas

local builds a local release artifact after generating android; it is not production-signed.
eas starts the signed production AAB build on EAS.
EOF
}

load_local_env() {
  if [[ -f .env ]]; then
    # The file is developer-controlled and ignored by git.
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
}

build_local() {
  local format="${1:-aab}"
  local gradle_task
  local artifact

  case "${format}" in
    apk)
      gradle_task=assembleRelease
      artifact=android/app/build/outputs/apk/release/app-release.apk
      ;;
    aab)
      gradle_task=bundleRelease
      artifact=android/app/build/outputs/bundle/release/app-release.aab
      ;;
    *)
      printf 'Unknown local format: %s (expected apk or aab)\n' "${format}" >&2
      usage >&2
      exit 2
      ;;
  esac


  CI=1 bunx expo prebuild --platform android --no-install --clean
  chmod +x android/gradlew
  android/gradlew -p android --no-daemon --no-parallel "${gradle_task}"

  if [[ ! -f "${artifact}" ]]; then
    printf 'Expected release artifact was not created: %s\n' "${artifact}" >&2
    exit 1
  fi

  printf '\nLocal release artifact: %s\n' "${artifact}"
}

build_eas() {
  eas build --profile production --platform android
}

load_local_env

case "${1:-}" in
  local)
    build_local "${2:-aab}"
    ;;
  eas)
    build_eas
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
