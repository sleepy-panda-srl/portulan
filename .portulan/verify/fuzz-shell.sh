#!/usr/bin/env bash
# Portulan workspace — verify recipe: both shell segmenters answer one grammar, one way.
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

for required in cli/fuzz-shell.mjs cli/goldens.mjs cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot fuzz the segmenters\n' "$required" >&2
        exit 2
    fi
done

printf 'fuzz-shell: generating a gated command and a constitution write in every position the grammar knows, on both segmenters\n'

# The pack root is pinned so the verdict is about this tree, never the host's plugin cache.
node cli/fuzz-shell.mjs --workspace . --pack-root packs --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: fuzz-shell exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
