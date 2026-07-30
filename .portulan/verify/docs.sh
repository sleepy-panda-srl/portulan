#!/usr/bin/env bash
# Portulan workspace — verify recipe for a docs-first repository.
#
# Six checks. Only the kernel budget was a rule this repo had already stated; links and map were
# minted from the defect that this recipe's first run exposed (see ./README.md, Provenance), record
# from the 2026-07-27 audit that found a merged arc with no record at all, proposal from milestone
# 5, where "a rule change is a proposal as a pull request" turned out to bind nothing, and plan from
# the post-M5 reconciliation, which found 63,420 characters of row and only 11% of it criterion:
#   links     every relative Markdown link resolves IN THE REPOSITORY, not on this disk
#                                                             (docs that lie are worse than no docs)
#   kernel    core/engine.md stays inside its line budget    (the always-loaded layer is the scarce one)
#   map       the root README lists every top-level entry    (agent legibility: the map matches the ground)
#   record    a date has at least as many log entries as handoffs and vice versa, entries stay within
#             their line budget, newest attests the seam      (a session with no record is unauditable)
#   proposal  every proposal is numbered, records an outcome, and names the pull request that filed it
#                                                             (a rule you cannot trace to its review)
#   plan      no milestone row carries an amendment argument or a session note, every row parses into
#             its five cells, and its Status cell stays inside a byte budget
#                                                             (the scoreboard is law, not an archive)
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
#
# **This list has two consumers now, and they pull in opposite directions — read both before
# editing either.** This one is ENUMERATION: which files get scanned, where `--others` is the
# strict direction because scanning a file that is not committed yet can only find more. The
# `links` check below adds a second, deliberately NARROWER list for RESOLUTION: what counts as
# existing, where `--others` is the loose direction and is excluded. Widening this list is safe;
# widening that one re-opens #121.
#
# **`core.quotePath=false` is load-bearing, not tidiness.** By default `git ls-files` C-quotes any path
# with a byte outside printable ASCII — `docs/naïve.md` comes back as `"docs/na\303\257ve.md"`, quotes
# and all. Every consumer below then compares against a *transformed* list: the `links` resolution table
# would key the quoted spelling and report a correctly tracked file as untracked, with `git add` unable
# to discharge it, and `map` would report a top-level entry named `"docs` that no README table can
# contain. Both are **false reds**, which this recipe's own README calls the failure that gets a check
# switched off. The tree is all-ASCII today, so this is a latent defect being closed rather than an
# observed one being fixed — found by a fresh context attacking the change, not by a red.
manifest="$tmp/manifest"
if ! git -c core.quotePath=false ls-files --cached --others --exclude-standard >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

# ---------------------------------------------------------------------- 1. links
#
# A target resolves if THE REPOSITORY carries it, never if this disk happens to. That distinction
# is the whole check: `[ -e ]` answers a question about one machine, and the answer CI gives is
# the one that matters, because CI checks out tracked files and nothing else. The two diverged in
# milestone 6 inside a *generated* file — a link to a deliberately empty directory, green in front
# of the author who had just created it, red on the clean checkout — which is
# [#121](https://github.com/sleepy-panda-works/portulan/issues/121) and the retirement condition
# in ../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md.
#
# **Seven shapes passed under the old test, and they are one defect, not seven.** Measured on this
# tree before the change, each green then and red now: an **empty directory** (git records none);
# an **ignored** path (git will never carry it); a **wrong-case file** and, separately, a
# **wrong-case directory** on a case-insensitive volume — the false green ./README.md had already
# recorded as known, with this fix named as its repair; an **untracked** path (not committed yet, so
# absent in every clone); a path that **escapes the root and re-enters** through the absolute
# filesystem; and an **absolute** target, which resolves here and 404s in every renderer. Whatever
# the shape, the question the old test asked was "is this on my disk", and that is never the question.
#
# The count is **seven and must stay level with ./README.md's census**, which enumerates the same
# seven. An earlier draft of this comment said six, having folded the two wrong-case shapes into one
# while that page listed them apart — the fourth time in this one change that prose about the
# mechanism was wrong where the mechanism was right. They are listed apart because the repairs differ:
# a file is compared against the tracked set, a directory only against the prefixes derived from it.
#
# **The disk may inform the message; it may never inform the verdict.** Below, git decides
# resolvable-or-not, and only then is the filesystem consulted — to tell an author which of seven
# repairs is theirs, since they differ completely and a single "unresolvable link" sends most
# authors to edit a link that is fine. That asymmetry is the design, and reversing it is the bug.
#
# Normalisation is **lexical** — `a/b/../c` is folded by string surgery, never by `realpath` —
# because resolving through the filesystem is the defect being fixed. `..` that walks off the root
# is a red rather than a lookup, a trailing slash asserts a directory, and comparison is
# byte-exact, which is what closes the wrong-case hole. Landing exactly ON the root is not an
# escape and is green: `./`, `.` and `../` from a subdirectory all name a directory this repository
# has, and folding those two cases together produced a false red with a confident wrong reason.

# The RESOLUTION list: tracked paths ONLY. See the manifest comment above for why this is
# narrower than the enumeration list and must stay so. Empty is a precondition failure, not a
# tree where nothing resolves — this repository cannot have zero tracked files, and reporting
# every link in it as broken would be a confident answer to a question that never ran.
tracked="$tmp/tracked"
if ! git -c core.quotePath=false ls-files --cached >"$tracked"; then
    printf 'verify: git ls-files --cached failed — cannot establish what the repository carries\n' >&2
    exit 2
fi
if [ ! -s "$tracked" ]; then
    printf 'verify: the repository reports no tracked files — refusing to judge links against that\n' >&2
    exit 2
fi

# Candidates, one per line, tab-separated: file, line, the file's directory, the resolvable path, and
# the target **as written**. The last two differ by a `#fragment`, and both travel because the verdict
# is about the path while the report must quote what the author typed — a finding that prints a
# fragment-stripped path cannot be found by grepping for the line it came from.
#
# Extraction stays here (one grep per document, as before); resolution is a single awk pass, so the
# check costs two subprocesses per document rather than two per link.
: >"$tmp/cand"
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
        # `//host/path` is a protocol-relative EXTERNAL url, not a repository path. It is skipped here
        # rather than three lines later, because it begins with `/` and would otherwise reach the
        # absolute-path arm and be told it should have been relative — which is nonsense about a link
        # that leaves the repository. Not a regression this change introduced: the old test resolved the
        # same target as `<dir>///host/path` and went red too, so the shape has always been refused. What
        # was new was a confident wrong *reason* for it, which is the class this whole check is about.
        case "$target" in
            http://*|https://*|mailto:*|//*|"#"*) continue ;;
        esac
        path=${target%%#*}                      # a #fragment is not checked, only the file
        [ -n "$path" ] || continue
        printf '%s\t%s\t%s\t%s\t%s\n' "$file" "$line" "$dir" "$path" "$target" >>"$tmp/cand"
    done < <(grep -nEo '\]\([^)]+\)' "$file" 2>/dev/null)
done <"$manifest"

# A tab inside a link **target** is the reachable way a record splits into the wrong number of fields,
# and the parse arm below refuses rather than guesses — "could not run", never a verdict about links it
# mis-read. One such link therefore refuses the whole recipe, which is the same trade every other
# precondition here makes. (A tracked *path* containing a tab cannot get this far: git quotes control
# characters regardless of `core.quotePath`. #68 is the rail that would make such a path impossible in
# the first place.)
: >"$tmp/links"
awk -F'\t' -v tracked_file="$tracked" '
    # Returns the repository-relative path, "" for the repository ROOT itself, or the sentinel for a
    # `..` that walks off the top. **Those last two must not be conflated**, and the first draft of this
    # comment got the example wrong while the code was right, which is why the distinction is spelled out
    # rather than illustrated: from a document in `docs/`, `./` and `.` normalise to `docs` — the child
    # directory itself, resolved below by the directory-prefix rule, not by the root case — and only `../`
    # reaches the root. Landing on the root is green, because this repository always carries it; walking
    # off the top is red. Folding the two together produced a false red carrying a confidently wrong
    # reason, which is worse than either alone. The sentinel is a byte no path can hold.
    function normalize(dir, path,    joined, n, c, i, out, m, st) {
        joined = (dir == "." ? path : dir "/" path)
        n = split(joined, c, "/")
        m = 0
        for (i = 1; i <= n; i++) {
            if (c[i] == "" || c[i] == ".") continue
            if (c[i] == "..") { if (m == 0) return "\001"; m--; continue }
            st[++m] = c[i]
        }
        if (m == 0) return ""
        out = st[1]
        for (i = 2; i <= m; i++) out = out "/" st[i]
        return out
    }
    FILENAME == tracked_file {
        have[$0] = 1; lower[tolower($0)] = 1
        n = split($0, c, "/"); p = ""
        for (i = 1; i < n; i++) { p = p c[i] "/"; dir[p] = 1; dirlower[tolower(p)] = 1 }
        next
    }
    {
        if (NF != 5) { parse_failed = 1; exit 2 }
        # An absolute target is not a relative link at all. GitHub resolves a leading `/` against the
        # SITE root, so `/core/engine.md` 404s in a browser while resolving perfectly well here once
        # the empty first component is dropped — a green over a link that is broken everywhere it is
        # actually read. Judged before normalisation, because normalisation is what hides it.
        if ($4 ~ /^\//) { print $1 "\t" $2 "\t" $5 "\tabsolute\t-"; next }
        wants_dir = ($4 ~ /\/$/)
        norm = normalize($3, $4)
        if (norm == "\001") { print $1 "\t" $2 "\t" $5 "\troot\t-"; next }
        if (norm == "") next                    # the repository root itself; always carried
        if (!wants_dir && (norm in have)) next
        if ((norm "/") in dir) next
        # Never empty. Tab is IFS whitespace in bash, so a run of two tabs reads as one delimiter
        # and an empty middle field silently shifts every field after it left — which it did, and
        # the drill caught it by asserting the message rather than the count.
        why = "disk"
        if (wants_dir && (norm in have)) why = "slash"
        else if ((!wants_dir && (tolower(norm) in lower)) || ((tolower(norm) "/") in dirlower)) why = "case"
        print $1 "\t" $2 "\t" $5 "\t" why "\t" norm
    }
    END { if (parse_failed) exit 2 }
' "$tracked" "$tmp/cand" >"$tmp/findings"
awk_status=$?

if [ "$awk_status" -ne 0 ]; then
    printf 'verify: a link record did not parse into five fields — a link target may contain a tab.\n' >&2
    printf '        Refusing to report on links this recipe could not read.\n' >&2
    exit 2
fi

# `git add` is the right advice only when `git add` would work, and for two shapes it will not: a path
# reached by walking THROUGH a tracked symlink, and a path inside a submodule. git refuses both, so
# naming that repair sends an author to a command that fails. Answered from the index rather than from
# the disk: mode 120000 is a symlink, 160000 a gitlink. (An earlier draft listed a third — a path git
# quotes — which `core.quotePath=false` above removed as a case entirely; it is named here only so it
# is not restored.)
blocked_by=''
in_the_way() {
    local _p _mode
    blocked_by=''
    _p=$1
    while [ "$_p" != "." ] && [ -n "$_p" ]; do
        case "$_p" in */*) _p=${_p%/*} ;; *) _p='.' ;; esac
        [ "$_p" = "." ] && break
        _mode=$(git ls-files --stage -- "$_p" 2>/dev/null | cut -c1-6)
        case "$_mode" in
            120000) blocked_by="a tracked symlink at \`$_p\`"; return 0 ;;
            160000) blocked_by="a submodule at \`$_p\`"; return 0 ;;
        esac
    done
    return 1
}

# The seven repairs, told apart. git has already ruled; this only names which repair is owed.
while IFS=$'\t' read -r file line target why norm; do
    [ -n "$file" ] || continue
    case "$why" in
        root) note="escapes the repository root" ;;
        absolute) note="an absolute path — a link between repository files must be relative, and a leading slash resolves against the site root when this is rendered" ;;
        case) note="wrong case — the repository carries it spelled differently" ;;
        slash) note="written with a trailing slash, but the repository carries a file at that path" ;;
        disk)
            if in_the_way "$norm"; then
                note="not in the repository, and reached through $blocked_by — git does not index what lies beyond one"
            elif [ -d "$norm" ]; then
                note="a directory with no tracked file in it — git records no empty directory"
            elif [ -e "$norm" ]; then
                # Exit 1 is "not ignored"; anything above 1 is "could not answer", and reporting the
                # second as the first is the fail-open this recipe keeps re-learning. The VERDICT is
                # already git's and does not move either way — only the advice does.
                git check-ignore -q -- "$norm"
                case $? in
                    0) note="ignored — git will never carry it" ;;
                    1) note="untracked — \`git add\` it, or fix the link" ;;
                    *) note="on this disk but not in the repository (\`git check-ignore\` could not say why)" ;;
                esac
            else
                note="not in the repository"
            fi
            ;;
        # Unreachable by construction, and guarded anyway: `note` carries the previous iteration's
        # value, so a fall-through would attach one link's diagnosis to another's — a report that
        # reads perfectly and sends an author to the wrong file. That class is why this arm exists.
        *)
            printf 'verify: the links check emitted the unknown diagnosis %s — refusing to render it\n' "$why" >&2
            exit 2
            ;;
    esac
    printf '%s:%s -> %s  (%s)\n' "$file" "$line" "$target" "$note" >>"$tmp/links"
done <"$tmp/findings"

if [ -s "$tmp/links" ]; then
    # "does not resolve in the repository", not "the repository does not carry" — three of the seven
    # diagnoses (absolute, wrong case, trailing slash) fire on links whose target the repository DOES
    # carry, in a spelling that will not resolve. A headline naming only the commonest cause is a
    # headline that argues with three of its own findings.
    fail "links — $(wc -l <"$tmp/links" | tr -d '[:space:]') link(s) that do not resolve in the repository"
    sed 's/^/        /' "$tmp/links"
else
    pass "links — every relative Markdown link resolves in the repository"
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
    if [ ! -s "$tmp/handoffdates" ] && [ ! -s "$tmp/strays" ]; then
        # Nothing whatever to look at: the only branch that is honestly *could not run*. It returns
        # BEFORE any verdict is printed, and that ordering is the second half of the same lesson.
        # Emitting the audit's line first meant a run ending in exit 2 opened with `ok … (0 examined)`
        # — a green above a "could not check", which is the shape this whole check exists to refuse.
        printf 'verify: no Markdown file under %s/ — cannot check correspondence\n' "$HANDOFFS" >&2
        exit 2
    fi

    if [ -s "$tmp/strays" ]; then
        fail "record — Markdown file(s) in $HANDOFFS/ whose name carries no date, so no check counts them"
        sed 's/^/        /' "$tmp/strays"
    else
        # The count names this check's coverage, as 4c's does. It can no longer be 0: the empty case
        # returned above, and a directory of nothing but strays takes the FAIL branch.
        pass "record — every Markdown file in $HANDOFFS/ is a dated handoff ($(wc -l <"$tmp/handoffdates" | tr -d '[:space:]') examined)"
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
    #
    # The entry's extent is READ FROM THE PARSER above — its start line and its own line count — rather
    # than re-derived here. Until 2026-07-29 this line carried a second regex, `^- 2[0-9][0-9][0-9]-`,
    # which is looser than the `^- YYYY-MM-DD ·` the parser requires: an unindented `- 2026-…` without
    # the middle dot did not start a new entry as far as everything above was concerned, but did end
    # this scan, so an attestation sitting after such a line read as ABSENT. A **false red**, and the
    # cause was two carriers of one definition — *where does an entry end* — disagreeing, in the check
    # this repository added to stop exactly that. Reusing the parser's answer is not a tighter regex;
    # it removes the second definition, so the two cannot drift apart again.
    last=$(cut -f2 "$tmp/entries" | tail -1)
    span=$(cut -f3 "$tmp/entries" | tail -1)
    entry=$(awk -v s="$last" -v n="$span" 'NR >= s && NR < s + n' "$PLAN")
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

# ------------------------------------------------------------------- 5. proposal
# Three checks on the proposal series, added 2026-07-28 with the scheduled librarian.
#
# `core/operating/evolution.md` has said since milestone 1 that a rule change is a **proposal as a
# pull request** — "reviewable, diff-able, and revertable like any other change". Every one of the
# fourteen here did in fact arrive that way, and nothing recorded which pull request, so the sentence
# bound a convention rather than a mechanism: nothing could take a rule and reach the review that
# accepted it, and nothing would notice a proposal that had skipped the gate entirely. Red-first
# against the real tree — all fourteen failed 5c before the pointers were written.
#
# What these deliberately do NOT check is whether a proposal is accepted, pending or rejected. That
# reading is `cli/librarian.mjs`'s, where a wrong answer costs one line in a report a human skims;
# here it would be a grep classifying prose, and a red on a proposal whose only fault is the
# maintainer's phrasing is how a whole recipe gets switched off (./README.md). This is the same
# severity split `doctor` takes with retirement conditions: report what is legible, fail only on shape.
PROPOSALS=.portulan/proposals
PROPOSALS_RE=${PROPOSALS//./\\.}
PR_URL='https://github\.com/sleepy-panda-works/portulan/pull/[0-9][0-9]*'

# Enumerated from the tree, `[ -f ]` guarded — the manifest is the git index plus untracked files, and
# a proposal git knows about that the tree does not is not a proposal. 4b' learned that the expensive
# way and this check inherits it rather than rediscovering it.
: >"$tmp/proposals"
: >"$tmp/pstrays"
while IFS= read -r p; do
    [ -f "$p" ] || continue
    base=${p##*/}
    case "$base" in
        README.md) continue ;;
        [0-9][0-9][0-9][0-9]-*.md) printf '%s\n' "$p" >>"$tmp/proposals" ;;
        *) printf '%s\n' "$p" >>"$tmp/pstrays" ;;
    esac
done < <(grep "^${PROPOSALS_RE}/.*\.md$" "$manifest")

# The audit reports before the precondition, and nothing is printed when there is nothing to find —
# both orderings are 4b''s lesson applied rather than re-learned. A green must not open a run that
# ends in "could not check", and a finding must not be hidden by a precondition that had its evidence.
if [ ! -s "$tmp/proposals" ] && [ ! -s "$tmp/pstrays" ]; then
    printf 'verify: no Markdown file under %s/ — cannot check the proposal series\n' "$PROPOSALS" >&2
    exit 2
fi

# 5a. A file here whose name carries no number is invisible to a series that enumerates by one.
if [ -s "$tmp/pstrays" ]; then
    fail "proposal — file(s) in $PROPOSALS/ outside the NNNN-slug.md series, so no check counts them"
    sed 's/^/        /' "$tmp/pstrays"
else
    pass "proposal — every Markdown file in $PROPOSALS/ is a numbered proposal ($(wc -l <"$tmp/proposals" | tr -d '[:space:]') examined)"
fi

if [ ! -s "$tmp/proposals" ]; then
    fail "proposal — no NUMBERED proposal in $PROPOSALS/, so neither field check could run"
else
    # 5b. It records an outcome, under either of the two field names this series actually uses.
    # `**Decision.**` is what core/templates/proposal.md prescribes; two proposals record the outcome
    # under `**Status.**` instead, and both are real shapes in a real store. Accepting both is not
    # laxity — it is refusing to red a correct record over a synonym, and the one carrier of *which
    # word* would have to be the template, which nothing compiles.
    : >"$tmp/pfields"
    : >"$tmp/plinks"
    while IFS= read -r p; do
        grep -qiE '^\*\*(decision|status)\b' "$p" || printf '%s\n' "$p" >>"$tmp/pfields"
        grep -qE "^\*\*Pull request:\*\*.*($PR_URL)" "$p" || printf '%s\n' "$p" >>"$tmp/plinks"
    done <"$tmp/proposals"

    if [ -s "$tmp/pfields" ]; then
        fail "proposal — $(wc -l <"$tmp/pfields" | tr -d '[:space:]') proposal(s) record no outcome (no \`**Decision.**\` or \`**Status.**\` field)"
        sed 's/^/        /' "$tmp/pfields"
    else
        pass "proposal — every proposal records an outcome ($(wc -l <"$tmp/proposals" | tr -d '[:space:]') examined)"
    fi

    # 5c. It names the pull request that filed it. This is the half that makes "proposals as pull
    # requests" a mechanism: from any rule you can reach the review that accepted it, and a proposal
    # committed straight to `main` — which the platform floor forbids and which nothing here would
    # otherwise notice — has no number to name. The URL shape is asserted rather than any `#N`, since
    # a bare `#31` is also how this repository writes a reference to an issue.
    if [ -s "$tmp/plinks" ]; then
        fail "proposal — $(wc -l <"$tmp/plinks" | tr -d '[:space:]') proposal(s) name no pull request (\`**Pull request:**\` with a full URL)"
        sed 's/^/        /' "$tmp/plinks"
    else
        pass "proposal — every proposal names the pull request that filed it ($(wc -l <"$tmp/proposals" | tr -d '[:space:]') examined)"
    fi
fi

# ----------------------------------------------------------------------- 6. plan
# Four checks on the milestone table, added 2026-07-29 by the post-M5 reconciliation. The count is
# stated here and matters: this recipe treats its own coverage reporting as a correctness property —
# `record` 4c prints the number of entries it examined on every run for exactly that reason — so a
# header claiming three checks over four is the same defect one altitude up. It said three until the
# fourth (6b′) was added at the pre-commit checkpoint.
#
# The table had become the archive it was supposed to index: 63,420 characters of row, of which only
# 11% was criterion. One Status cell held 16,505 characters on a single line. The history was not
# junk — amendment arguments with their expansion/narrowing verdicts, session notes, close-evidence
# narratives, every word of it reviewed and merged — but it was in the wrong place, because the row
# is what a session reads to learn what it must build and the criterion had become the hardest thing
# in it to find. That history now lives in `docs/milestones/mN.md`, moved verbatim, and these four
# checks are what stop it flowing back.
#
# **This rail is RETROACTIVE, and that is deliberate — the opposite call from `record`'s two floors.**
# There, a cutoff was mandatory: a rule written after a record cannot bind it without rewriting the
# record to suit the rule, so `ENTRY_BUDGET_CUTOFF` binds nothing that already existed. Here the
# remedy is **relocation**, which preserves a merged record byte-for-byte, so every historical row can
# satisfy this rail without one word being lost or altered. A cutoff would buy nothing and cost the
# rail its whole subject, since the rows that motivated it are precisely the old ones. Retroactivity
# is honest exactly when compliance destroys nothing, and this is that case.
#
# Scope is the milestone-table rows of docs/plan.md and nothing else, which is load-bearing rather
# than tidy. A file-wide grep for either marker would red the very records this change preserves:
# `Session N of` appears in eight Session log entries, and every `docs/milestones/*.md` contains
# `**Criterion amended` by design — it is the relocated argument. A rail that fired on the archive it
# just created would be unusable on the first run, so both markers are matched **inside a row only**.
PLAN_STATUS_BUDGET=500   # bytes; see 6c below for the derivation
if [ ! -f "$PLAN" ]; then
    : # already reported by the record check above; nothing here to add
else
    # A milestone row starts with a pipe and a number. The header, the separator, the Session log's
    # `- YYYY-MM-DD ·` entries and ordinary prose all fail that shape, so none of them is examined.
    : >"$tmp/rows"
    grep -nE '^\| *[0-9]+ *\|' "$PLAN" >"$tmp/rows"
    if [ ! -s "$tmp/rows" ]; then
        # Enumerating the table is a precondition: with no rows found, all four checks below would
        # report ok having examined nothing, which is the false green this recipe mints rules about.
        printf 'verify: no milestone rows found in %s — cannot check the table\n' "$PLAN" >&2
        exit 2
    fi
    rowcount=$(wc -l <"$tmp/rows" | tr -d '[:space:]')

    # 6a. An amendment ARGUMENT belongs in the milestone's file. The row keeps the amended criterion
    # text — the binding words — plus, where the amendment added an obligation, that obligation
    # verbatim. What it must not keep is the case for the change: the provenance, the
    # expansion-or-narrowing check, the alternatives weighed. The literal is the heading this project
    # has used for every one of them since milestone 1, and the bounded pointer the rows now carry
    # (`**Amended <date> (<direction>; argument in …)`) deliberately does not match it.
    : >"$tmp/planamend"
    grep -nE '^\| *[0-9]+ *\|' "$PLAN" | grep -F '**Criterion amended' >>"$tmp/planamend" || true
    if [ -s "$tmp/planamend" ]; then
        fail "plan — milestone row(s) carrying an amendment argument; it belongs in docs/milestones/"
        cut -d: -f1 "$tmp/planamend" | sed 's/^/        docs\/plan.md:/'
    else
        pass "plan — no milestone row carries an amendment argument ($rowcount row(s) examined)"
    fi

    # 6b. Session notes likewise. The pattern is wider than any one spelling on purpose: the rows
    # this was minted from used BOTH `(Session 0 of 1–2, …` (milestones 4 and 5) and a lowercase
    # bullet-led `· session 1 of 1–2, …` (milestone 3). A rail matching only the first would have
    # reported green over the second, which was 4,126 characters of the table when this was written.
    # Matching the shape rather than the punctuation is the difference between a rail and a decoration.
    : >"$tmp/plansess"
    grep -nE '^\| *[0-9]+ *\|' "$PLAN" | grep -E '[Ss]ession [0-9]+ of' >>"$tmp/plansess" || true
    if [ -s "$tmp/plansess" ]; then
        fail "plan — milestone row(s) carrying a session note; it belongs in docs/milestones/"
        cut -d: -f1 "$tmp/plansess" | sed 's/^/        docs\/plan.md:/'
    else
        pass "plan — no milestone row carries a session note ($rowcount row(s) examined)"
    fi

    # 6b′. A row this check cannot parse is a REFUSAL, not a pass. 6c reads the Status cell as the
    # sixth pipe-separated field, which is only the Status cell while a row has exactly five cells and
    # no escaped `\|` inside one. Nothing in Markdown stops a future row carrying one, and the first
    # draft of 6c simply skipped such a row: a 613-byte Status cell with one `\|` in it passed
    # green, while the summary line went on claiming 12 rows examined. That is the fail-open this whole
    # recipe mints rules about — `../memory/a-checker-must-refuse-what-it-cannot-check.md` — and it
    # would have shipped inside the change that added the rail. Reported before 6c runs, so the
    # diagnosis arrives before the check that depends on it.
    : >"$tmp/planshape"
    awk -F'|' -v p="$PLAN" '
        /^\| *[0-9]+ *\|/ && NF != 7 {
            printf "%s:%d (milestone %s) has %d pipe-separated field(s), not 7 — an escaped pipe?\n", p, NR, $2+0, NF
        }
    ' "$PLAN" >>"$tmp/planshape"
    if [ -s "$tmp/planshape" ]; then
        fail "plan — $(wc -l <"$tmp/planshape" | tr -d '[:space:]') milestone row(s) this check cannot parse; the Status budget below cannot see them"
        sed 's/^/        /' "$tmp/planshape"
    else
        pass "plan — every milestone row parses into its five cells ($rowcount row(s) examined)"
    fi

    # 6c. The Status cell is a verdict, not a narrative. The budget is a size count rather than a line
    # count because the cell is one line by construction — a line budget here would be the number 1
    # and would bound nothing.
    #
    # **It counts BYTES, and it says so because that is what it measures.** `awk`'s `length()` is
    # byte-based on the `mawk` that Ubuntu runners ship, and these cells are full of em dashes and
    # middle dots at three bytes each — so a budget labelled "characters" would have printed a number
    # the reader could not reproduce, in a check whose whole subject is claims that outrun what was
    # measured. Bytes is also the honest unit for this rail: what a Status cell costs the session
    # reading it is its size, not its codepoint count. Raised as a suppressed low-confidence note on
    # this rail's own pull request, in four carriers at once.
    #
    # 500 was picked from the relocated rows' own post-split sizes rather than chosen for roundness:
    # after the move the largest Status cell is 387 bytes (milestone 11, of which 137 are a single
    # proposal path) and the largest signed verdict is 311 (milestone 5). 500 leaves about 30%
    # headroom so the next close does not red on a byte, and still cannot hold a session note or an
    # evidence narrative — the cell it replaces was 16,505.
    #
    # Every row is bound, including `todo` ones: a row's Status is where this table drifted last time
    # and the cheapest place for it to drift again.
    # The count this reports is the number of rows it could actually READ, not the number that exist.
    # They differ exactly when 6b′ fired, and printing `$rowcount` here would have this check claim
    # coverage of a row it had just been told it cannot parse — a green whose number is borrowed from
    # a different question. Same discipline as `record` 4c printing the count it examined on every run.
    : >"$tmp/planstatus"
    awk -F'|' -v b="$PLAN_STATUS_BUDGET" -v p="$PLAN" '
        /^\| *[0-9]+ *\|/ && NF == 7 {
            n = length($6)
            if (n > b) printf "%s:%d (milestone %s) Status is %d bytes, over %d\n", p, NR, $2+0, n, b
        }
    ' "$PLAN" >>"$tmp/planstatus"
    readable=$(awk -F'|' '/^\| *[0-9]+ *\|/ && NF == 7' "$PLAN" | wc -l | tr -d '[:space:]')
    if [ -s "$tmp/planstatus" ]; then
        fail "plan — $(wc -l <"$tmp/planstatus" | tr -d '[:space:]') Status cell(s) over the ${PLAN_STATUS_BUDGET}-byte budget"
        sed 's/^/        /' "$tmp/planstatus"
    else
        pass "plan — every Status cell is within ${PLAN_STATUS_BUDGET} bytes ($readable of $rowcount row(s) readable)"
    fi
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
