#!/usr/bin/env bash
# Portulan workspace — verify recipe: every generated index is current, and the store within its budget.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git grep node sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# node exits 1 on a missing script, which would read as a red verdict.
[ -f cli/index.mjs ] || {
    printf 'verify: cli/index.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

WORKSPACES=(.portulan examples)

FIXTURE_PREFIX="cli/fixtures/"

# Before any expansion: bash 3.2 aborts on an empty array under set -u, which would read as red.
if [ "${#WORKSPACES[@]}" -eq 0 ]; then
    printf 'verify: WORKSPACES is empty — this recipe would check nothing\n' >&2
    exit 2
fi

# core.quotePath=false: a C-quoted path ends in a quote, which the $-anchored sed below cannot strip.
if ! manifests=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard -- 'workspace.json' '*/workspace.json'); then
    printf 'verify: git ls-files failed — cannot audit the workspace list\n' >&2
    exit 2
fi

present=$(printf '%s\n' "$manifests" | grep -v "^${FIXTURE_PREFIX}" | sed 's|/workspace\.json$||' | sort -u)
named=$(printf '%s\n' "${WORKSPACES[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the workspaces this recipe indexes are not the workspaces in the tree.\n' >&2
    printf '  checked : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing workspace to WORKSPACES in this file, or remove the stale entry.\n' >&2
    exit 2
fi

printf 'index: checking every generated index declared by %s\n' "$(printf '%s' "$named" | tr '\n' ' ')"

# --pack-root pins resolution to the tree, so packs installed on the host cannot move the verdict.
node cli/index.mjs --check --pack-root packs "${WORKSPACES[@]}"
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: index exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
