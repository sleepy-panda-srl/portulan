#!/usr/bin/env bash
# Portulan workspace — verify recipe for a docs-first repository.
#
# Four checks. Only the kernel budget was a rule this repo had already stated; links and map were
# minted from the defect that this recipe's first run exposed (see ./README.md, Provenance), and
# record from the 2026-07-27 audit that found a merged arc with no record at all:
#   links   every relative Markdown link resolves            (docs that lie are worse than no docs)
#   kernel  core/engine.md stays inside its line budget      (the always-loaded layer is the scarce one)
#   map     the root README lists every top-level entry      (agent legibility: the map matches the ground)
#   record  every log date has a dated handoff; newest entry attests the seam (no record = unauditable)
#
# Exit 0 green · 1 red · 2 could not run. The Stop-gate (milestone 4) calls this;
# until it exists, the definition of done in ../dod.md requires running it by hand.
# See ./README.md for what each check enforces and the incident behind it.

set -uo pipefail

# Every external command this recipe runs, checked before it runs any of them. A missing utility is
# *could not run* and never a verdict — and the alternative was measured rather than feared: on
# 2026-07-27 this recipe exited GREEN with `sed`, `sort` or `wc` absent, because a command that is
# not there produces no output and an empty findings list is indistinguishable from a clean one.
# Eleven false greens of this shape across four recipes; `docs.sh` also printed `ok    map` having
# examined zero directories, over a check whose own comment already warned about reporting green
# over an entry it never looked at. Only `git` was guarded here, which is why the gap survived.
# Raised as a low-confidence Copilot comment on #3 — the kind that never becomes a review thread and
# so can never be resolved. **This line is the source of truth for what the recipe needs.** ./README.md's
# Needs column and `requires` in ../workspace.json name only the substantial dependencies — `bash`,
# `git`, `node` — and are deliberately coarser, so neither is the thing to edit alongside this. The
# prose that does match it utility for utility is the "`docs.sh` needs …" paragraph in ./README.md.
for need in awk cut dirname git grep mktemp rm sed sort tail tr wc; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

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
#
# The exit status is checked, and that is load-bearing rather than defensive: if git fails
# here the list comes back empty, every loop below iterates nothing, and the recipe reports
# GREEN having checked exactly nothing. A check that passes when it could not run is worse
# than no check. Enumerating the tree is a precondition, so its failure is exit 2 —
# "could not run" — never exit 0.
manifest="$tmp/manifest"
if ! git ls-files --cached --others --exclude-standard >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

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
    done < <(
        {
            # A directory shows up here as the first segment of the paths inside it.
            awk -F/ 'NF > 1 { print $1 }' "$manifest"
            # …which is why a top-level *symlink* to a directory is invisible to it: git tracks a
            # symlink as a single path with no `/`, so `NF > 1` drops it and the map reports GREEN
            # over an entry it never looked at. Found at milestone 3 session 1, when the tree briefly
            # grew one; the symlink went away and this stayed, because the hole is in the check
            # rather than in that tree. `[ -d ]` follows the link, so a top-level regular file
            # (LICENSE, NOTICE, CODEOWNERS) is still correctly excluded: this check is about
            # directories, and a link to one is one.
            awk -F/ 'NF == 1 { print $1 }' "$manifest" | while IFS= read -r entry; do
                [ -d "$entry" ] && printf '%s\n' "$entry"
            done
        } | sort -u
    )

    if [ -s "$tmp/map" ]; then
        fail "map — $(wc -l <"$tmp/map" | tr -d '[:space:]') top-level entr(ies) absent from $README"
        sed 's/^/        /' "$tmp/map"
    else
        pass "map — every top-level entry is documented in $README"
    fi
fi

# --------------------------------------------------------------------- 4. record
# Two correspondence checks on the session record, added 2026-07-27 after an audit found a merged
# doctrine rewrite (#32/#33) with no handoff and no Session log entry, and the newest entry missing
# its seam attestation. Correspondence is by DATE, not by session: two sessions closing on one day
# are satisfied by one handoff — a stated limit, not a claim (see ./README.md, Known limits). The
# floor is 2026-07-25, the day the handoff cadence became a maintainer ruling (docs/plan.md,
# Session log) — entries before it predate the mandate and are not retro-bound. The seam check
# reads PRESENCE of an attestation in the newest entry, never whether its verdict is honest.
PLAN=docs/plan.md
HANDOFFS=.portulan/handoffs
HANDOFFS_RE=${HANDOFFS//./\\.}   # dots escaped: the path is a literal in a regex context
CADENCE_FLOOR=2026-07-25
if [ ! -f "$PLAN" ]; then
    fail "record — $PLAN is missing"
else
    : >"$tmp/record"
    while IFS= read -r d; do
        [[ "$d" < "$CADENCE_FLOOR" ]] && continue
        found=0
        while IFS= read -r h; do
            [ -f "$h" ] && found=1 && break
        done < <(grep "^${HANDOFFS_RE}/${d}-.*\.md$" "$manifest")
        [ "$found" -eq 1 ] || printf '%s\n' "$d" >>"$tmp/record"
    done < <(sed -n 's/^- \(2[0-9]\{3\}-[0-9]\{2\}-[0-9]\{2\}\) ·.*/\1/p' "$PLAN" | sort -u)

    if [ -s "$tmp/record" ]; then
        fail "record — Session log date(s) since $CADENCE_FLOOR with no dated handoff in $HANDOFFS/"
        sed 's/^/        /' "$tmp/record"
    else
        pass "record — every Session log date since $CADENCE_FLOOR has a dated handoff"
    fi

    last=$(grep -n '^- 2[0-9]\{3\}-[0-9]\{2\}-[0-9]\{2\} ·' "$PLAN" | tail -1 | cut -d: -f1)
    if [ -z "$last" ]; then
        fail "record — no Session log entries found in $PLAN"
    else
        entry=$(awk -v s="$last" 'NR==s{f=1} f && NR>s && (/^- 2[0-9][0-9][0-9]-/ || /^## /){exit} f{print}' "$PLAN")
        if printf '%s' "$entry" | tr '\n' ' ' | grep -qiE 'seam scan[^.]{0,120}clean'; then
            pass "record — the newest Session log entry carries a seam attestation"
        else
            fail "record — the newest Session log entry ($PLAN:$last) carries no seam attestation"
        fi
    fi
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
