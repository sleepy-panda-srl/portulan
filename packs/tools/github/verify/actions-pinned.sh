#!/usr/bin/env bash
#
# Every `uses:` in a GitHub Actions workflow is pinned to a full 40-character commit SHA.
#
# Exit 0 green · 1 red · 2 could not run. The third is load-bearing here, as everywhere in this
# project: a recipe that could not look must never report what a recipe that looked and found nothing
# reports. See `README.md` beside this file for what the check does NOT cover and why it exists at all
# given that GitHub can enforce pinning itself.
#
# Composed into an adopting workspace through `pack.json`'s `contributes.verify`, whose `run` names
# this file through `${PACK_ROOT}` — the pack does not know the adopter's layout and must not guess it.

set -uo pipefail

WORKFLOWS=".github/workflows"

# ---------------------------------------------------------------------------------------------
# The tools this recipe invokes, checked before it invokes them.
#
# Without this the failure is SILENT and GREEN: the two loops below read from process substitutions,
# so a missing `find` or `grep` yields no lines at all, every counter stays zero, `status` stays 0 —
# and the recipe reports a pass having examined nothing. That is the false green this project names
# most consistently, and it is precisely what `.portulan/memory/verify-preconditions-fail-closed.md`
# exists to refuse. The header below already cited that rule for the workflows DIRECTORY and did not
# apply it to the recipe's own dependencies: a rule obeyed at one of its two sites, in a file that
# quotes the rule. Copilot round 5.
#
# `requires` in `pack.json` declares the same list. Two carriers, deliberately — the manifest's is
# what a host reads to decide whether to run at all, this one is what fires when it ran anyway — and
# they are checked against each other by nothing, which is stated here rather than implied.
# ---------------------------------------------------------------------------------------------
missing=""
for tool in find grep sed sort cut wc; do
    command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
    printf 'actions-pinned: COULD NOT RUN — missing required tool(s):%s\n' "$missing" >&2
    printf '  Reported rather than run around: without these the scan reads nothing and would report\n' >&2
    printf '  a pass over a tree it never examined.\n' >&2
    exit 2
fi

# ---------------------------------------------------------------------------------------------
# Preconditions fail closed. Enumeration is the precondition here exactly as it is in this project's
# own recipes (`.portulan/memory/verify-preconditions-fail-closed.md`): a green computed over a
# directory that was not there is a green about nothing.
#
# Both the absent directory and the present-but-empty one are could-not-run rather than vacuously
# green, and the distinction between them is kept in the MESSAGE rather than in the exit code —
# a workspace with no workflows has composed a pack that cannot do its job, and should hear that
# sentence rather than a green it might mistake for coverage.
# ---------------------------------------------------------------------------------------------
if [ ! -d "$WORKFLOWS" ]; then
    printf 'actions-pinned: COULD NOT RUN — there is no %s directory in this repository.\n' "$WORKFLOWS" >&2
    printf '  A workspace with no GitHub Actions workflows has nothing for this recipe to check;\n' >&2
    printf '  composing `tools/github` there is the thing to change, not this exit code.\n' >&2
    exit 2
fi

# `find` rather than a glob, so a directory holding only subdirectories is not mistaken for one
# holding workflows. Sorted so the report is stable between runs and between machines.
files=$(find "$WORKFLOWS" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)

if [ -z "$files" ]; then
    printf 'actions-pinned: COULD NOT RUN — %s holds no .yml or .yaml file.\n' "$WORKFLOWS" >&2
    exit 2
fi

status=0
examined=0
pinned=0
local_refs=0

while IFS= read -r file; do
    # One `uses:` per line is the shape every workflow in the wild uses; a folded or flow-mapping
    # spelling would slip past this, which is stated in README.md as a known limit rather than
    # covered by a matcher that would claim more than it reads.
    while IFS= read -r line; do
        value=$(printf '%s\n' "$line" | sed -E 's/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*//; s/[[:space:]]*(#.*)?$//; s/^["'"'"']//; s/["'"'"']$//')
        [ -n "$value" ] || continue

        # `examined` counts only references this recipe can actually judge, and the exempt ones are
        # counted separately below. Counting them here made the summary print a ratio like `2 of 3
        # pinned` on a run where every non-exempt reference WAS pinned — a green whose own number
        # looked like a partial pass. Copilot round 2.
        case "$value" in
            ./*)
                # A local action lives in this repository and moves with it — there is no third-party
                # commit to pin, and demanding one would be a check that cannot be satisfied.
                local_refs=$((local_refs + 1))
                continue
                ;;
            docker://*)
                # A container reference is pinned by digest, not by commit. Out of scope and named.
                local_refs=$((local_refs + 1))
                continue
                ;;
        esac

        examined=$((examined + 1))
        ref=${value##*@}
        if [ "$ref" = "$value" ]; then
            printf '  UNPINNED %s: `uses: %s` carries no `@ref` at all\n' "$file" "$value" >&2
            status=1
        # Case-insensitive: a git object name is hex and hex is case-insensitive, so an uppercase or
        # mixed-case SHA is a pinned SHA. Matching lowercase only would have reported a correctly
        # pinned action as unpinned — a FALSE RED, which is the failure mode this project treats as
        # worse than a missed catch, because it is the one that gets a check switched off.
        elif printf '%s' "$ref" | grep -Eqi '^[0-9a-f]{40}$'; then
            pinned=$((pinned + 1))
        else
            printf '  UNPINNED %s: `uses: %s` is pinned to `%s`, which is a tag or branch, not a commit\n' "$file" "$value" "$ref" >&2
            status=1
        fi
    done < <(grep -nE '^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*[^[:space:]]' "$file" | cut -d: -f2-)
done < <(printf '%s\n' "$files")

count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')

if [ "$status" -eq 0 ]; then
    printf 'actions-pinned: %s of %s `uses:` reference(s) pinned to a full commit SHA across %s workflow file(s)' \
        "$pinned" "$examined" "$count"
    if [ "$local_refs" -gt 0 ]; then
        printf ', %s local or container reference(s) exempt' "$local_refs"
    fi
    printf '\n\nGREEN — verify recipe passed.\n'
else
    printf '\nRED — at least one action is not pinned to a commit. A tag is a moving target: the code that\n' >&2
    printf 'runs in this workflow tomorrow is whatever the tag points at then.\n' >&2
fi

exit "$status"
