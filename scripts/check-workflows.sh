#!/usr/bin/env bash

set -euo pipefail

if ! command -v shellcheck >/dev/null; then
  printf 'ShellCheck is required to validate workflow and helper shell scripts.\n' >&2
  exit 1
fi

if [[ -n "${ACTIONLINT_BIN:-}" ]]; then
  "${ACTIONLINT_BIN}" "$@"
else
  if [[ "$(uname -s)-$(uname -m)" != "Linux-x86_64" ]]; then
    printf 'Set ACTIONLINT_BIN to actionlint 1.7.12 on this platform.\n' >&2
    exit 1
  fi

  tool_dir="$(mktemp -d "${TMPDIR:-/tmp}/homecare-actionlint.XXXXXX")"
  trap 'rm -rf -- "$tool_dir"' EXIT
  archive="actionlint_1.7.12_linux_amd64.tar.gz"
  curl --fail --location --retry 3 \
    "https://github.com/rhysd/actionlint/releases/download/v1.7.12/${archive}" \
    --output "${tool_dir}/${archive}"
  printf '%s  %s\n' \
    8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 \
    "${tool_dir}/${archive}" | sha256sum --check
  tar -xzf "${tool_dir}/${archive}" -C "$tool_dir" actionlint
  "${tool_dir}/actionlint" "$@"
fi

shellcheck scripts/*.sh .devcontainer/build-android.sh
