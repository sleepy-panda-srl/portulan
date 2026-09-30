#!/usr/bin/env bash
# Portulan workspace — verify recipe: a clean evaluation bundle cuts from the index.
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

[ -f cli/eval-bundle.mjs ] || {
    printf 'verify: cli/eval-bundle.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

node cli/eval-bundle.mjs --check
code=$?

case "$code" in
    0) printf 'GREEN — verify recipe passed.\n' ;;
    1) printf 'RED — verify recipe failed; "done" is blocked.\n' ;;
    *) printf 'verify: eval-bundle could not run (exit %s)\n' "$code" >&2 ;;
esac
exit "$code"
