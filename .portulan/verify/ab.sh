#!/usr/bin/env bash
# Portulan workspace — verify recipe: the A/B treatment arm carries what it was ruled to carry, and nothing else.
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

for required in cli/ab.mjs evals/ab/arm.md evals/ab/corpus.md evals/ab/register.md .portulan/workspace.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the A/B arm construction\n' "$required" >&2
        exit 2
    fi
done

printf 'ab: constructing both arms and comparing evals/ab/register.md byte for byte\n'
node cli/ab.mjs --check --workspace .portulan --repo-root .
status=$?

case "$status" in
    0 | 1 | 2) ;;
    *)
        printf 'verify: ab exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        status=2
        ;;
esac

exit "$status"
