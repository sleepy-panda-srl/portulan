#!/usr/bin/env bash
# Portulan workspace — verify recipe: every jq and awk program the workflows run, executed against fixtures.
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in awk dirname jq node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

for required in .portulan/verify/workflow-filters.mjs .github/workflows; do
    if [ ! -e "$required" ]; then
        printf 'verify: %s is missing — cannot judge the workflows'"'"' jq and awk programs\n' "$required" >&2
        exit 2
    fi
done

node .portulan/verify/workflow-filters.mjs
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: workflow-filters exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
