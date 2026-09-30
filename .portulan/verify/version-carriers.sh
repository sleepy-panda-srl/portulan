#!/usr/bin/env bash
# Portulan workspace — verify recipe: prose states the version package.json declares.
#
# Exit 0 green · 1 red · 2 could not run.
set -uo pipefail
cd "$(dirname "$0")/../.." || { printf 'verify: version-carriers could not reach the repository root\n' >&2; exit 2; }
for need in git node; do
    command -v "$need" >/dev/null 2>&1 || { printf 'verify: version-carriers could not run — %s is not on PATH\n' "$need" >&2; exit 2; }
done
node cli/version-carriers.mjs .
rc=$?
if [ "$rc" -eq 2 ]; then printf 'verify: version-carriers could not run (exit 2)\n' >&2; fi
exit "$rc"
