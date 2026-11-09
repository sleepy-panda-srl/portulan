#!/usr/bin/env bash
# Exit 0 green; 1 drift; 2 could not run.
set -uo pipefail
for need in dirname node; do
    command -v "$need" >/dev/null 2>&1 || { printf 'verify: %s not found\n' "$need" >&2; exit 2; }
done
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." || exit 2
[ -f cli/cache-stability.mjs ] || { printf 'verify: cache-stability module missing\n' >&2; exit 2; }
node cli/cache-stability.mjs .
