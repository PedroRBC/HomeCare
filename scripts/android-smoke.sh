#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'Usage: %s APK DIAGNOSTICS_DIR [FLOW]\n' "$0" >&2
  exit 2
fi

apk=$1
diagnostics=$2
flow=${3:-.maestro/auth-navigation.yaml}
app_id=com.pedrorbc.HomeCare

if [[ ! -f "$apk" || ! -f "$flow" ]]; then
  printf 'APK and Maestro flow must both exist.\n' >&2
  exit 2
fi
mkdir -p "$diagnostics/maestro-debug"
diagnostics=$(realpath "$diagnostics")
apk=$(realpath "$apk")
flow=$(realpath "$flow")

# Every diagnostic command is bounded and best effort. Never replace the test status.
# shellcheck disable=SC2317,SC2329 # Invoked indirectly by EXIT; warning differs by ShellCheck version.
collect_diagnostics() {
  local status=$?
  trap - EXIT
  set +e
  local packages line uid='' pid=''
  packages=$(timeout 15s adb shell cmd package list packages -U "$app_id" 2>>"$diagnostics/diagnostics.log")
  while IFS= read -r line; do
    if [[ $line =~ ^package:com\.pedrorbc\.HomeCare[[:space:]]uid:([0-9]+) ]]; then
      uid=${BASH_REMATCH[1]}
      break
    fi
  done <<< "$packages"

  local log_scope=()
  if [[ -n "$uid" ]]; then
    log_scope=("--uid=$uid")
  else
    pid=$(timeout 15s adb shell pidof "$app_id" 2>>"$diagnostics/diagnostics.log")
    pid=${pid%% *}
    if [[ $pid =~ ^[0-9]+$ ]]; then
      log_scope=("--pid=$pid")
    fi
  fi
  if [[ ${#log_scope[@]} -gt 0 ]]; then
    timeout 15s adb logcat -d -t 1000 -v threadtime "${log_scope[@]}" \
      AndroidRuntime:E ReactNative:V ReactNativeJS:V '*:S' \
      >"$diagnostics/logcat.txt" 2>>"$diagnostics/diagnostics.log" \
      || printf 'Scoped logcat collection failed.\n' >>"$diagnostics/diagnostics.log"
  else
    printf 'No app UID/PID available; omitted unscoped logs to avoid other app data.\n' \
      >"$diagnostics/logcat.txt"
  fi
  timeout 15s adb exec-out screencap -p \
    >"$diagnostics/screenshot.png" 2>>"$diagnostics/diagnostics.log" \
    || printf 'Screenshot collection failed.\n' >>"$diagnostics/diagnostics.log"
  if timeout 15s adb shell uiautomator dump /sdcard/homecare-smoke-hierarchy.xml \
      >>"$diagnostics/diagnostics.log" 2>&1; then
    timeout 15s adb exec-out cat /sdcard/homecare-smoke-hierarchy.xml \
      >"$diagnostics/hierarchy.xml" 2>>"$diagnostics/diagnostics.log" \
      || printf 'Hierarchy read failed.\n' >>"$diagnostics/diagnostics.log"
  else
    printf 'Hierarchy dump failed.\n' >>"$diagnostics/diagnostics.log"
  fi
  exit "$status"
}

# Register before installation, so even install failures retain diagnostics.
trap collect_diagnostics EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

set +e
adb install --no-streaming -r "$apk" 2>&1 | tee "$diagnostics/install.log"
install_status=${PIPESTATUS[0]}
set -e
if [[ $install_status -ne 0 ]]; then
  exit "$install_status"
fi

# Maestro 2.11.0 options; debug files are emitted during execution, before EXIT.
set +e
maestro test --debug-output "$diagnostics/maestro-debug" --flatten-debug-output \
  "$flow" 2>&1 | tee "$diagnostics/maestro.log"
test_status=${PIPESTATUS[0]}
set -e
exit "$test_status"
