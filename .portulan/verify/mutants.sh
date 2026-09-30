#!/usr/bin/env bash
# Portulan workspace — verify recipe: the gate corpus can tell a working matcher from a broken one.
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

for required in cli/mutants.mjs cli/goldens.mjs cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot run the mutation census\n' "$required" >&2
        exit 2
    fi
done

if [ ! -d evals/goldens/gates ]; then
    printf 'verify: evals/goldens/gates/ is missing — the fixture corpus is this census kill-set\n' >&2
    exit 2
fi

printf 'mutants: breaking the matcher region of cli/compile.mjs on purpose, and asking whether the gate corpus notices\n'

# The pack root is pinned so the verdict is about this tree, never the host's plugin cache.
node cli/mutants.mjs --workspace . --pack-root packs --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: mutants exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
