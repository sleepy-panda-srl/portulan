#!/usr/bin/env bash
# Portulan workspace — verify recipe: the review-loop register still says what its snapshot says.
#
# It never checks the snapshot against GitHub; a person refreshes it with `node cli/review-meter.mjs --fetch`.
#
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

for required in cli/review-meter.mjs evals/review-loop/snapshot.json evals/review-loop/register.md; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the review-loop register against its snapshot\n' "$required" >&2
        exit 2
    fi
done

printf 'review-loop: regenerating evals/review-loop/register.md from its snapshot and comparing byte for byte\n'

node cli/review-meter.mjs \
    --snapshot evals/review-loop/snapshot.json \
    --register evals/review-loop/register.md \
    --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: review-meter exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
