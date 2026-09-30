#!/usr/bin/env bash
# Portulan workspace — verify recipe: every rail this workspace yields has a drill, and every drill still places.
# Exit 0 green · 1 a rail has no drill, or a drill names no rail · 2 could not run.

set -uo pipefail

for need in cut dirname mktemp node rm tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

for required in cli/drills.mjs cli/recipe-set.mjs .portulan/workspace.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the drill roster\n' "$required" >&2
        exit 2
    fi
done

# The module's path goes in the environment: as an argument, argv[1] would fire its entry guard and run the sweep.
probe=$(mktemp) || exit 2
if ! PORTULAN_DRILLS_MODULE="$root/cli/drills.mjs" \
    node --input-type=module -e 'await import(process.env.PORTULAN_DRILLS_MODULE);' 2>"$probe"; then
    printf 'verify: cli/drills.mjs could not be loaded — %s\n' "$(tr '\n' ' ' <"$probe" | cut -c1-300)" >&2
    rm -f -- "$probe"
    exit 2
fi
rm -f -- "$probe"

printf 'drills: checking that every rail this workspace yields has a forced-red drill, and that every drill still places\n'

# The pack root is pinned so the verdict is about this tree, never the host's plugin cache.
node cli/drills.mjs --check --repo-root . --workspace .portulan --pack-root packs
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: drills exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
