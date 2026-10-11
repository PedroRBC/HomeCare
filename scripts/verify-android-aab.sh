#!/usr/bin/env bash
# Fails unless the AAB has a valid JAR signature from exactly one signer whose
# certificate SHA-256 is EXPECTED_SHA256 (hex, colons optional).
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: %s AAB EXPECTED_SHA256\n' "$0" >&2
  exit 2
fi
aab=$1
expected=$(tr -d ':' <<<"$2" | tr 'A-F' 'a-f')

signers=$(keytool -printcert -jarfile "$aab" 2>&1) || true
signer=$(awk '$1 == "SHA256:" { gsub(":", "", $2); print tolower($2); exit }' <<<"$signers")
verification=$(jarsigner -verify "$aab" 2>&1) || true
if [[ ! $expected =~ ^[0-9a-f]{64}$ || $signer != "$expected" ]] \
    || grep -q '^Signer #2' <<<"$signers" \
    || ! grep -q '^jar verified\.' <<<"$verification"; then
  printf 'AAB is not signed only with the upload certificate.\n' >&2
  exit 1
fi
