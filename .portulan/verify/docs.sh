#!/usr/bin/env bash
# Portulan workspace — verify recipe for a docs-first repository.
#
# Three checks. Only the kernel budget was a rule this repo had already stated; the other two were
# minted from the defect that this recipe's first run exposed (see ./README.md, Provenance):
#   links   every relative Markdown link resolves            (docs that lie are worse than no docs)
#   kernel  core/engine.md stays inside its line budget      (the always-loaded layer is the scarce one)
#   map     the root README lists every top-level entry      (agent legibility: the map matches the ground)
#
# Exit 0 green · 1 red · 2 could not run. The Stop-gate (milestone 4) calls this;
# until it exists, the definition of done in ../dod.md requires running it by hand.
# See ./README.md for what each check enforces and the incident behind it.

set -uo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2
command -v git >/dev/null 2>&1 || { printf 'verify: git not found\n' >&2; exit 2; }

KERNEL=core/engine.md
KERNEL_BUDGET=60
README=README.md

tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT
status=0

fail() { status=1; printf 'FAIL  %s\n' "$1"; }
pass() { printf 'ok    %s\n' "$1"; }

# Everything tracked, plus everything new that is not ignored — so a directory or a link
# is checked before it is committed, not after.
manifest="$tmp/manifest"
git ls-files --cached --others --exclude-standard >"$manifest"

# ---------------------------------------------------------------------- 1. links
: >"$tmp/links"
while IFS= read -r file; do
    case "$file" in *.md) ;; *) continue ;; esac
    [ -f "$file" ] || continue
    dir=$(dirname -- "$file")
    while IFS= read -r hit; do
        [ -n "$hit" ] || continue
        line=${hit%%:*}
        target=${hit#*:}
        target=${target#"]("}
        target=${target%")"}
        case "$target" in
            http://*|https://*|mailto:*|"#"*) continue ;;
        esac
        path=${target%%#*}                      # a #fragment is not checked, only the file
        [ -n "$path" ] || continue
        [ -e "$dir/$path" ] || printf '%s:%s -> %s\n' "$file" "$line" "$target" >>"$tmp/links"
    done < <(grep -nEo '\]\([^)]+\)' "$file" 2>/dev/null)
done <"$manifest"

if [ -s "$tmp/links" ]; then
    fail "links — $(wc -l <"$tmp/links" | tr -d '[:space:]') unresolvable relative link(s)"
    sed 's/^/        /' "$tmp/links"
else
    pass "links — every relative Markdown link resolves"
fi

# --------------------------------------------------------------------- 2. kernel
if [ ! -f "$KERNEL" ]; then
    fail "kernel — $KERNEL is missing"
else
    lines=$(wc -l <"$KERNEL" | tr -d '[:space:]')
    if [ "$lines" -gt "$KERNEL_BUDGET" ]; then
        fail "kernel — $KERNEL is $lines lines, over the ${KERNEL_BUDGET}-line always-loaded budget"
    else
        pass "kernel — $KERNEL is $lines/$KERNEL_BUDGET lines"
    fi
fi

# ------------------------------------------------------------------------ 3. map
: >"$tmp/map"
if [ ! -f "$README" ]; then
    fail "map — $README is missing"
else
    while IFS= read -r dir; do
        # Anchored to a table cell: a passing mention in prose must not satisfy the map.
        grep -qF -- "| \`$dir/\`" "$README" || printf '%s/\n' "$dir" >>"$tmp/map"
    done < <(awk -F/ 'NF > 1 { print $1 }' "$manifest" | sort -u)

    if [ -s "$tmp/map" ]; then
        fail "map — $(wc -l <"$tmp/map" | tr -d '[:space:]') top-level entr(ies) absent from $README"
        sed 's/^/        /' "$tmp/map"
    else
        pass "map — every top-level entry is documented in $README"
    fi
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
