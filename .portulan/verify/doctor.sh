#!/usr/bin/env bash
# Portulan workspace — verify recipe: the Workspace Definition validator, over every workspace this repository owns.
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

[ -f cli/doctor.mjs ] || {
    printf 'verify: cli/doctor.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# Named, not discovered: discovery below only audits this list, so a scan that finds nothing cannot pass.
WORKSPACES=(.portulan examples)

# Fixture workspaces are invalid on purpose, so the audit skips them.
FIXTURE_PREFIX="cli/fixtures/"

# Checked before any use of the list: bash 3.2 aborts on expanding an empty array under set -u.
if [ "${#WORKSPACES[@]}" -eq 0 ]; then
    printf 'verify: WORKSPACES is empty — this recipe would validate nothing\n' >&2
    exit 2
fi

# Two patterns, since '*workspace.json' would also match a path merely ending in that name.
if ! manifests=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard -- 'workspace.json' '*/workspace.json'); then
    printf 'verify: git ls-files failed — cannot audit the workspace list\n' >&2
    exit 2
fi

present=$(printf '%s\n' "$manifests" | grep -v "^${FIXTURE_PREFIX}" | sed 's|/workspace\.json$||' | sort -u)
named=$(printf '%s\n' "${WORKSPACES[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the workspaces this recipe validates are not the workspaces in the tree.\n' >&2
    printf '  validated : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree   : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing workspace to WORKSPACES in this file, or remove the stale entry.\n' >&2
    exit 2
fi

# The pack root is pinned so the verdict is about this tree, never the host's plugin cache.
node cli/doctor.mjs --pack-root packs "${WORKSPACES[@]}"
