#!/usr/bin/env bash
# Every `uses:` in a GitHub Actions workflow is pinned to a full 40-character commit SHA.
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Relative to the working directory, the adopter's root: where the pack sits says nothing about it.
WORKFLOWS=".github/workflows"

# `pack.json`'s `requires` lists these tools too, and nothing checks that the two agree.
missing=""
for tool in find grep sed sort cut wc tr; do
    command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
    printf 'actions-pinned: COULD NOT RUN — missing required tool(s):%s\n' "$missing" >&2
    printf '  Reported rather than run around: without these the scan reads nothing and would report\n' >&2
    printf '  a pass over a tree it never examined.\n' >&2
    exit 2
fi

if [ ! -d "$WORKFLOWS" ]; then
    printf 'actions-pinned: COULD NOT RUN — there is no %s directory in this repository.\n' "$WORKFLOWS" >&2
    printf '  A workspace with no GitHub Actions workflows has nothing for this recipe to check;\n' >&2
    printf '  composing `tools/github` there is the thing to change, not this exit code.\n' >&2
    exit 2
fi

files=$(find "$WORKFLOWS" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)

if [ -z "$files" ]; then
    printf 'actions-pinned: COULD NOT RUN — %s holds no .yml or .yaml file.\n' "$WORKFLOWS" >&2
    exit 2
fi

status=0
examined=0
pinned=0
exempt=0

while IFS= read -r file; do
    # One `uses:` per line: a folded or flow-mapping spelling is not seen.
    while IFS= read -r line; do
        value=$(printf '%s\n' "$line" | sed -E 's/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*//; s/[[:space:]]*(#.*)?$//; s/^["'"'"']//; s/["'"'"']$//')
        [ -n "$value" ] || continue

        case "$value" in
            ./*)
                exempt=$((exempt + 1))
                continue
                ;;
            docker://*)
                exempt=$((exempt + 1))
                continue
                ;;
        esac

        examined=$((examined + 1))
        ref=${value##*@}
        if [ "$ref" = "$value" ]; then
            printf '  UNPINNED %s: `uses: %s` carries no `@ref` at all\n' "$file" "$value" >&2
            status=1
        # Case-insensitive, as hex is: an uppercase SHA is still a pinned one.
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
    if [ "$exempt" -gt 0 ]; then
        printf ', %s local or container reference(s) exempt' "$exempt"
    fi
    printf '\n\nGREEN — verify recipe passed.\n'
else
    printf '\nRED — at least one action is not pinned to a commit. A tag is a moving target: the code that\n' >&2
    printf 'runs in this workflow tomorrow is whatever the tag points at then.\n' >&2
fi

exit "$status"
