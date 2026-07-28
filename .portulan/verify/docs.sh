#!/usr/bin/env bash
# Portulan workspace — verify recipe for a docs-first repository.
#
# Four checks. Only the kernel budget was a rule this repo had already stated; links and map were
# minted from the defect that this recipe's first run exposed (see ./README.md, Provenance), and
# record from the 2026-07-27 audit that found a merged arc with no record at all:
#   links   every relative Markdown link resolves            (docs that lie are worse than no docs)
#   kernel  core/engine.md stays inside its line budget      (the always-loaded layer is the scarce one)
#   map     the root README lists every top-level entry      (agent legibility: the map matches the ground)
#   record  a date has at least as many log entries as handoffs and vice versa, entries stay within
#           their line budget, newest attests the seam        (a session with no record is unauditable)
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
# Five checks on the session record. 4a and 4d were added 2026-07-27, after an audit found a merged
# doctrine rewrite (#32/#33) with no handoff and no Session log entry, and the newest entry missing
# its seam attestation. 4b, 4b' and 4c were added 2026-07-28, after a two-day review found five
# handoff-documented sessions with no Session log entry at all, and log entries that had grown from
# the "one entry per session" the log asks for to 105 lines.
#
# Correspondence runs BOTH ways and is by DATE, not by session — but the reverse direction compares
# COUNTS, which is the difference between a rail and a decoration here. Presence was the first draft:
# it was green on the exact record it was minted from, because each of the five unlogged sessions
# shared a date with a sibling that had been logged. Counting reds on that record. Both remaining
# limits are in ./README.md rather than restated here.
#
# Two floors, each forward-only and each a cutoff rather than a list, because a rule written after a
# record cannot bind it without rewriting the record to suit the rule:
#   CADENCE_FLOOR       2026-07-25, the day the handoff cadence became a maintainer ruling.
#   ENTRY_BUDGET_CUTOFF 2026-07-28. Entries dated AFTER it are bound; the entries already over budget
#                       when it was set — two of them dated that same day and already merged — keep
#                       their length. So this half binds nothing at the moment it is introduced,
#                       stated here rather than left to be inferred from a green, and 4c prints the
#                       count it examined on every run so the green never implies more than it saw.
#
# The seam check reads PRESENCE of an attestation in the newest entry, never whether it is honest.
PLAN=docs/plan.md
HANDOFFS=.portulan/handoffs
HANDOFFS_RE=${HANDOFFS//./\\.}   # dots escaped: the path is a literal in a regex context
CADENCE_FLOOR=2026-07-25
ENTRY_BUDGET=10
ENTRY_BUDGET_CUTOFF=2026-07-28
if [ ! -f "$PLAN" ]; then
    fail "record — $PLAN is missing"
else
    # The entry list is the input set for three of the five checks below, so building it is a
    # PRECONDITION: an empty list would let two of them pass having examined nothing. One pass,
    # emitting DATE<TAB>START<TAB>LINES. Trailing blank lines belong to the gap between entries,
    # not to the entry, so they are not charged against the budget.
    awk '
        function flush() {
            if (date != "") {
                while (n > 0 && bt > 0) { n--; bt-- }
                printf "%s\t%d\t%d\n", date, start, n
            }
        }
        /^- 2[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] ·/ {
            flush(); date = substr($0, 3, 10); start = NR; n = 1; bt = 0; next
        }
        date != "" && /^## / { flush(); date = ""; next }
        date != "" { n++; if ($0 ~ /^[[:space:]]*$/) bt++; else bt = 0 }
        END { flush() }
    ' "$PLAN" >"$tmp/entries"
    if [ ! -s "$tmp/entries" ]; then
        printf 'verify: no Session log entries found in %s — cannot enumerate the record\n' "$PLAN" >&2
        exit 2
    fi
    # One date per entry, repeats intact — 4b counts them, so collapsing here would erase the signal.
    # Where a `sort -u` is taken below it carries `LC_ALL=C`: these are byte comparisons and the
    # ordering should not depend on the machine's locale. Measured under C, en_US.UTF-8 and
    # tr_TR.UTF-8 — the last on purpose, since 4d's match is case-insensitive and that is the locale
    # where case stops behaving.
    cut -f1 "$tmp/entries" >"$tmp/logdates"

    # Every Markdown file under the handoffs directory, split into dated handoffs and anything else.
    # Enumerating them is a precondition: with none enumerable the two directions below would report
    # ok over an empty set, which is the false green this recipe has minted rules about.
    #
    # `[ -f ]` is load-bearing and was learned the expensive way: the first draft of this read the
    # dates straight out of the manifest, and the manifest is the INDEX plus untracked files. Emptying
    # the handoffs directory therefore left four dates standing and printed `ok … (4 date(s))` over a
    # directory with nothing in it — found by this check's own observation procedure, one step after
    # it was written. A handoff that git knows about and the tree does not is not a handoff.
    #
    # The `*)` arm is the other half of the same lesson: a file here whose name carries no date is
    # invisible to a check that enumerates by date, so it would be silently uncounted rather than
    # reported. Discovery is audited against the shape it assumes, the way `doctor.sh` and
    # `plugin.sh` already audit theirs. The set is empty today; it ships to guard the next one.
    : >"$tmp/handoffdates"
    : >"$tmp/strays"
    while IFS= read -r h; do
        [ -f "$h" ] || continue
        base=${h##*/}
        case "$base" in
            [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.md)
                printf '%s\n' "${base:0:10}" >>"$tmp/handoffdates" ;;
            *) printf '%s\n' "$h" >>"$tmp/strays" ;;
        esac
    done < <(grep "^${HANDOFFS_RE}/.*\.md$" "$manifest")
    # 4b'. The stray audit reports BEFORE the correspondence precondition, and the order is the point.
    # It ran after it until 2026-07-28: a directory holding only undated Markdown then exited 2 —
    # *could not run* — while `$tmp/strays` already held the names that were the whole defect. That is
    # the exact inversion of `../memory/verify-preconditions-fail-closed.md`. There, *could not look*
    # must never read as *nothing wrong*; here, **I looked and found it** was reading as *could not
    # look*, which is the same lie told the other way round and costs the operator the diagnosis.
    #
    # The scope is Markdown deliberately: the enumeration above greps `*.md`, so a `notes.txt` here
    # passes — measured, not assumed. Widening it would red the untracked debris a working tree
    # collects (`.DS_Store` and friends), which is a worse trade than the gap.
    if [ -s "$tmp/strays" ]; then
        fail "record — Markdown file(s) in $HANDOFFS/ whose name carries no date, so no check counts them"
        sed 's/^/        /' "$tmp/strays"
    else
        # The count is printed for the same reason 4c prints its own: on an empty directory this
        # sentence is vacuously true, and a green that does not say it examined nothing reads as a
        # green that examined something.
        pass "record — every Markdown file in $HANDOFFS/ is a dated handoff ($(wc -l <"$tmp/handoffdates" | tr -d '[:space:]') examined)"
    fi

    if [ ! -s "$tmp/handoffdates" ] && [ ! -s "$tmp/strays" ]; then
        # Nothing whatever to look at. This is the only branch that is honestly *could not run*.
        printf 'verify: no Markdown file under %s/ — cannot check correspondence\n' "$HANDOFFS" >&2
        exit 2
    fi

    if [ ! -s "$tmp/handoffdates" ]; then
        # Markdown is present and none of it is dated. The cause is known and was just named
        # file by file, so the honest verdict is RED. Exit 2 here would report "could not look"
        # over a diagnosis the recipe had already made.
        fail "record — no DATED handoff in $HANDOFFS/, so neither correspondence check could run"
    else
        # 4a. Every Session log date since the cadence floor has a handoff of that date.
        : >"$tmp/record"
        while IFS= read -r d; do
            [[ "$d" < "$CADENCE_FLOOR" ]] && continue
            grep -qxF -- "$d" "$tmp/handoffdates" || printf '%s\n' "$d" >>"$tmp/record"
        done < <(LC_ALL=C sort -u "$tmp/logdates")

        if [ -s "$tmp/record" ]; then
            fail "record — Session log date(s) since $CADENCE_FLOOR with no dated handoff in $HANDOFFS/"
            sed 's/^/        /' "$tmp/record"
        else
            pass "record — every Session log date since $CADENCE_FLOOR has a dated handoff"
        fi

        # 4b. And the reverse, BY COUNT rather than by presence: a date carries at least as many
        # Session log entries as it has handoffs. Presence was the first draft and it was the weaker
        # rail by a long way — it was GREEN on the very record it was minted from, because each of the
        # five unlogged sessions shared its date with a sibling that had been logged. Counting is red
        # on that same tree (2026-07-27: 13 entries against 14 handoffs; 2026-07-28: 2 against 5) and
        # green once the entries are written, which is what red-first is supposed to mean.
        #
        # No floor is needed on this side: dates before the cadence ruling have zero handoffs and `>=`
        # is satisfied by anything. What it cannot see is stated in ./README.md rather than here — an
        # extra entry on a date can offset a missing one, and a session spanning midnight reds honestly.
        : >"$tmp/orphans"
        while IFS= read -r d; do
            hc=$(grep -cxF -- "$d" "$tmp/handoffdates")
            lc=$(grep -cxF -- "$d" "$tmp/logdates")
            [ "$lc" -ge "$hc" ] ||
                printf '%s — %s handoff(s), %s Session log entr(ies)\n' "$d" "$hc" "$lc" >>"$tmp/orphans"
        done < <(LC_ALL=C sort -u "$tmp/handoffdates")

        if [ -s "$tmp/orphans" ]; then
            fail "record — date(s) with fewer Session log entries than handoffs"
            sed 's/^/        /' "$tmp/orphans"
        else
            pass "record — every date has at least as many log entries as handoffs ($(wc -l <"$tmp/handoffdates" | tr -d '[:space:]') handoff(s))"
        fi
    fi

    # 4c. An entry dated after the budget cutoff is a pointer, not a record: at most 10 lines.
    : >"$tmp/budget"
    bound=0
    while IFS=$'\t' read -r d start lines; do
        [[ "$d" > "$ENTRY_BUDGET_CUTOFF" ]] || continue
        bound=$((bound + 1))
        [ "$lines" -gt "$ENTRY_BUDGET" ] &&
            printf '%s:%s (%s) is %s lines\n' "$PLAN" "$start" "$d" "$lines" >>"$tmp/budget"
    done <"$tmp/entries"

    # The bound count is printed on the red branch as well as the green one. A green that named what it
    # examined while a red did not would be the honest half of a claim: both carriers of this rule say
    # the count is printed on every run, and a sentence true only of successes is how that starts drifting.
    if [ -s "$tmp/budget" ]; then
        fail "record — $bound entr(ies) dated after $ENTRY_BUDGET_CUTOFF, $(wc -l <"$tmp/budget" | tr -d '[:space:]') over the ${ENTRY_BUDGET}-line budget"
        sed 's/^/        /' "$tmp/budget"
    else
        pass "record — $bound entr(ies) dated after $ENTRY_BUDGET_CUTOFF, all within ${ENTRY_BUDGET} lines"
    fi

    # 4d. The newest entry attests the seam.
    last=$(cut -f2 "$tmp/entries" | tail -1)
    entry=$(awk -v s="$last" 'NR==s{f=1} f && NR>s && (/^- 2[0-9][0-9][0-9]-/ || /^## /){exit} f{print}' "$PLAN")
    # `[[:space:]]+` between the two words, not a single space, and it is a false-red fix rather than a
    # relaxation. `tr` turns each newline into a space and leaves the continuation indent standing, so an
    # attestation that happens to wrap between "seam" and "scan" arrives as `seam   scan` and reads as
    # ABSENT. Every entry since this check landed had passed on the accident of wrapping elsewhere; the
    # first one that did not was written by the session adding these lines, and the check caught it. The
    # words must still be adjacent, and `clean` still within 120 characters that contain no full stop.
    if printf '%s' "$entry" | tr '\n' ' ' | grep -qiE 'seam[[:space:]]+scan[^.]{0,120}clean'; then
        pass "record — the newest Session log entry carries a seam attestation"
    else
        fail "record — the newest Session log entry ($PLAN:$last) carries no seam attestation"
    fi
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
