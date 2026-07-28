#!/usr/bin/env bash
# Portulan workspace — verify recipe: the memory index is generated, current, and within budget.
#
# One check, run against both workspaces this repository owns:
#   index   the committed index is exactly what the store renders, and neither the index nor the
#           store is over the budget its manifest declares
#
# ../../core/operating/memory.md has said since milestone 1 that the index is "generated, never
# hand-maintained" and that a budget is "a rail, not an aim". Until this recipe existed, both
# sentences bound review and nothing else — which
# ../memory/a-mandate-nothing-checks-is-already-broken.md says is another spelling of broken.
#
# It never writes. `index --check` renders in memory and byte-compares, exactly as ./compile.sh
# does for the compiled enforcement, and for the same reason: a verify recipe that repairs what it
# is checking always passes. The generator's write mode is one flag away, which is precisely why
# the flag is not passed here.
#
# **The two reds are different defects with different repairs**, and the tool keeps them apart:
#   out of date  →  run `node cli/index.mjs .portulan examples`
#   over budget  →  consolidate the store (../../core/skills/consolidate/SKILL.md) — merge,
#                   compress, retire — and never by raising the budget in the change that broke it
# A single "index check failed" would send an author to regenerate a file that is already correct
# and still too big.
#
# What this recipe CANNOT establish: that the index is any good at recall. It checks derivation and
# cost. Whether these lines lead a reader to the right record is an eval question (milestone 8) and
# a naming question for whoever writes the records.
#
# The workspaces are named rather than discovered, and the named list is audited against the tree —
# the shape ./doctor.sh explains at length and this recipe reuses rather than re-deriving. Note the
# list is every workspace, not every workspace with an index: a workspace declaring none is
# reported as such by the tool, so "no index" stays visible instead of being an absence in a list.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in dirname git grep node sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The generator's own presence is a precondition, not a red. `node cli/index.mjs` on a missing file
# exits 1, and passing that through would report "the index has drifted" about an index nothing had
# looked at — the defect a reviewer found in ./doctor.sh, in the recipe that has no tests.
[ -f cli/index.mjs ] || {
    printf 'verify: cli/index.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

WORKSPACES=(.portulan examples)

FIXTURE_PREFIX="cli/fixtures/"

# Checked before the array is expanded: on bash 3.2 — the system bash on macOS — expanding an empty
# array under `set -u` aborts mid-script, which would surface as exit 1, a red that judged nothing.
if [ "${#WORKSPACES[@]}" -eq 0 ]; then
    printf 'verify: WORKSPACES is empty — this recipe would check nothing\n' >&2
    exit 2
fi

if ! manifests=$(git ls-files --cached --others --exclude-standard -- 'workspace.json' '*/workspace.json'); then
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

printf 'index: checking the generated memory index of %s\n' "$(printf '%s' "$named" | tr '\n' ' ')"

node cli/index.mjs --check "${WORKSPACES[@]}"
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # `index` reserves 2 for "could not judge" and so does this recipe — passed through rather than
    # translated. ./compile.sh shipped for one checkpoint missing this arm and printed "not a verdict
    # it documents" about a code the tool documents plainly: the right outcome with a false sentence.
    2) exit 2 ;;
    *)
        printf 'verify: index exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
