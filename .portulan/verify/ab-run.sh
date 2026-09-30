#!/usr/bin/env bash
# Portulan workspace — verify recipe: the published A/B baseline still says what its own capture says.
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

for required in cli/ab-run.mjs cli/ab-grade.mjs cli/ab.mjs evals/ab/corpus.md; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the A/B baseline\n' "$required" >&2
        exit 2
    fi
done

printf 'ab-run: checking evals/ab/baseline.md against evals/ab/baseline.json — no agent is run\n'
node cli/ab-run.mjs --verify --repo-root .
status=$?

case "$status" in
    0 | 1 | 2) ;;
    *)
        printf 'verify: ab-run exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        status=2
        ;;
esac

exit "$status"
