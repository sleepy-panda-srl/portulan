#!/usr/bin/env bash
# Portulan workspace — verify recipe for a docs-first repository.
#
# THE CHECKS ARE THE LIST BELOW, AND THE LIST IS THE COUNT. This line read "Six checks." until the
# `cli table` check was added and did not — a fixed numeral in a header about a file that grows, which
# is the same hand-maintained-figure defect the `cli table` check itself exists to retire, arriving in
# the rail's own file within one change. Naming a number here buys nothing the enumeration does not
# already give, and costs a claim that goes stale silently. Copilot, #255 round 2.
# Only the kernel budget was a rule this repo had already stated; links and map were
# minted from the defect that this recipe's first run exposed (see ./README.md, Provenance), record
# from the 2026-07-27 audit that found a merged arc with no record at all (rebuilt 2026-09-23 around
# the commit, when the Session log retired), proposal from milestone 5, where "a rule change is a
# proposal as a pull request" turned out to bind nothing, and plan from the post-M5 reconciliation,
# which found 63,420 characters of row and only 11% of it criterion:
#   links     every relative Markdown link resolves IN THE REPOSITORY, not on this disk
#                                                             (docs that lie are worse than no docs)
#   kernel    core/engine.md stays inside its line budget    (the always-loaded layer is the scarce one)
#   map       the root README lists every top-level entry    (agent legibility: the map matches the ground)
#   record    every handoff is dated, the Session log stays retired, every changelog entry is a
#             one-bullet fragment, the newest commit attests the seam
#                                                  (a change's record is its commit; nothing conflicts)
#   proposal  every proposal is numbered, records an outcome, and names the pull request that filed it
#                                                             (a rule you cannot trace to its review)
#   plan      no milestone row carries an amendment argument or a session note, every row parses into
#             its five cells, and its Status cell stays inside a byte budget
#                                                             (the scoreboard is law, not an archive)
#   cli table every file in cli/ has a row in cli/README.md's table, and every row names a file that
#             exists — both directions, two declared exemptions, each audited
#                                                    (a table headed What is here today, kept honest)
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
for need in awk comm cut dirname git grep mktemp rm sed sort tail tr wc; do
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
# [#121](https://github.com/sleepy-panda-srl/portulan/issues/121) and the retirement condition
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
    # **POSIX `awk`, not `grep -o` (#257).** `-o` is a GNU extension that BSD/macOS also ships, so this
    # never failed anywhere this repository runs — but ./README.md does not merely list this recipe's
    # dependencies, it makes `docs.sh` the *reason* something else is safe, on the strength of a
    # portability property `-o` denied it. Arm 1 of the two the issue offered: keep the promise rather
    # than withdraw it, because the neighbouring extraction below already chose POSIX `sed` over `-o`
    # for this same reason, and truing the claim instead would have reversed that decision one screen
    # away from where it was made.
    #
    # `match`/`RSTART`/`RLENGTH` are POSIX awk, and the loop is what makes it emit EVERY link on a line
    # rather than the first — the one behaviour `-o` gives for free and a naive `sub` would silently
    # lose. Equivalence was measured, not argued: over all 288 tracked markdown files this and the old
    # pipeline produce byte-identical output, 3064 lines, and they still agree on the awkward cases —
    # two links on one line, a `](bare)` with no link text, and the nested-parenthesis target that
    # truncates. That last one is a KNOWN LIMIT recorded under ./README.md's Known limits, and it is
    # preserved deliberately: this change buys portability and must not quietly alter a verdict.
    done < <(awk '{ s = $0; while (match(s, /\]\([^)]+\)/)) { printf "%d:%s\n", NR, substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH) } }' "$file" 2>/dev/null)
done <"$manifest"

# A tab inside a link **target** is the reachable way a record splits into the wrong number of fields,
# and the parse arm below refuses rather than guesses — "could not run", never a verdict about links it
# mis-read. One such link therefore refuses the whole recipe, which is the same trade every other
# precondition here makes. (A tracked *path* containing a tab cannot get this far, and the reason is
# narrower than this line used to give: **git C-quotes a control character in `ls-files` output even
# under `core.quotePath=false`** — measured — so the raw byte never enters the lists built above.
# Nothing makes such a path *impossible*; git will track it. This cited #68 as the rail that would,
# which was wrong twice over: #68 is closed, and the rail it shipped — `./control-chars.sh` — scans
# file CONTENTS and never path names.)
: >"$tmp/links"
awk -F'\t' -v tracked_file="$tracked" '
    # Returns the repository-relative path, "" for the repository ROOT itself, or the sentinel for a
    # `..` that walks off the top. **Those last two must not be conflated**, and the first draft of this
    # comment got the example wrong while the code was right, which is why the distinction is spelled out
    # rather than illustrated: from a document in `docs/`, `./` and `.` normalise to `docs` — the child
    # directory itself, resolved below by the directory-prefix rule, not by the root case — and only `../`
    # reaches the root. Landing on the root is green, because this repository always carries it; walking
    # off the top is red. Folding the two together produced a false red carrying a confidently wrong
    # reason, which is worse than either alone.
    #
    # **The sentinel is `\001`, and what makes it safe is not that no path can hold that byte.** A path
    # can: git tracks a filename of any bytes but NUL and `/`, measured rather than assumed. What holds
    # is narrower, and it belongs to this recipe rather than to the filesystem — the lists compared here
    # are built by `git ls-files` WITHOUT `-z`, and git C-quotes a control character in that output
    # **regardless of `core.quotePath`**, so `a<0x01>b` arrives as the printable spelling `"a\001b"`
    # and never as the byte. `-z` is what emits it raw, which is why a recipe reading `-z` — such as
    # `./control-chars.sh` — could not reuse this sentinel unchanged.
    #
    # **That covers the PATH channel only, and the boundary is stated rather than left to be found.** A
    # raw `\001` reaches this function through a link TARGET, where grep passes the byte on unchanged.
    # The collision test below is `norm == "\001"`, an EXACT equality — so what collides is a target
    # whose WHOLE normalised path is that single byte, not one that merely contains it: `\001` collides,
    # `a\001b` does not. Narrow, and stated narrowly on the second pass because the first version of
    # this very paragraph said "such a target normalises to the sentinel" and so overclaimed the fix
    # for an overclaim. Where it does collide the recipe prints the confidently wrong "escapes the
    # repository root" diagnosis this block calls worse than either fault alone; nothing here closes
    # that, and `./control-chars.sh` reds such a tree only when it runs, which the Stop-gate does not do
    # for it.
    #
    # The sentence this replaces read *"a byte no path can hold"*: an overclaim guarding a real
    # invariant, which is the commonest shape in the table on issue #133 and the one instance that the
    # issue deliberately left unfixed.
    #
    # NOTE for anyone editing this block: it is inside a single-quoted awk program, so an apostrophe
    # here terminates the shell string and the recipe dies with a syntax error two hundred lines down.
    # That happened once, while writing this very comment.
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
# Four checks on the record a change leaves, rebuilt 2026-09-23 when the Session log retired. A
# change's record is its commit: the subject says what, the body says why. The log, the committed
# handoffs index and the one `## Unreleased` section were the files every pull request wrote to, and
# all 15 pull requests of that day that had another merge land while they were open conflicted there.
#   4a  every Markdown file in the handoffs directory is a dated handoff (the stray audit)
#   4b  docs/plan.md carries no Session log entry
#   4c  every file in changes/ is one changelog fragment, and CHANGELOG.md's Unreleased holds none
#   4d  the newest change's commit attests the seam
# The checks they replace (log↔handoff correspondence by date, the ten-line entry budget, the seam
# line in the newest entry) are at `git show fc453be:.portulan/verify/docs.sh`.
PLAN=docs/plan.md
HANDOFFS=.portulan/handoffs
HANDOFFS_RE=${HANDOFFS//./\\.}   # dots escaped: the path is a literal in a regex context
CHANGES=changes
CHANGELOG=CHANGELOG.md

# 4a. Every Markdown file under the handoffs directory, split into dated handoffs and anything else.
# A file here whose name carries no date sorts nowhere and no index line can be derived for it, so it
# is reported rather than silently uncounted. `[ -f ]` because the manifest is the INDEX plus
# untracked files: a handoff git knows about and the tree does not is not a handoff. The scope is
# Markdown deliberately, so the untracked debris a working tree collects (`.DS_Store`) passes.
# **A real day, not the shape of one.** `2026-13-45-x.md` matches the glob and names no day. The
# index tool refuses it (`dateOf` in `cli/index.mjs`), but the Stop gate runs this recipe alone, and
# until 2026-09-23 the log's correspondence by date caught a mistyped day here. Found by Copilot, #451.
# The two agree on every four-digit year; `dateOf` read 0000 to 0099 as 1900 to 1999 until the same review.
real_day() {
    local y=$((10#${1:0:4})) m=$((10#${1:5:2})) d=$((10#${1:8:2})) last
    case $m in
        1 | 3 | 5 | 7 | 8 | 10 | 12) last=31 ;;
        4 | 6 | 9 | 11) last=30 ;;
        2) if ((y % 4 == 0 && (y % 100 != 0 || y % 400 == 0))); then last=29; else last=28; fi ;;
        *) return 1 ;;
    esac
    ((d >= 1 && d <= last))
}
: >"$tmp/handoffdates"
: >"$tmp/strays"
while IFS= read -r h; do
    [ -f "$h" ] || continue
    base=${h##*/}
    case "$base" in
        [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-*.md)
            if real_day "${base:0:10}"; then
                printf '%s\n' "${base:0:10}" >>"$tmp/handoffdates"
            else
                printf '%s\n' "$h" >>"$tmp/strays"
            fi ;;
        *) printf '%s\n' "$h" >>"$tmp/strays" ;;
    esac
done < <(grep "^${HANDOFFS_RE}/.*\.md$" "$manifest")
if [ -s "$tmp/strays" ]; then
    fail "record — Markdown file(s) in $HANDOFFS/ whose name does not lead with a real YYYY-MM-DD day, so no index line can be derived"
    sed 's/^/        /' "$tmp/strays"
else
    # The count names what was examined. Zero is a legitimate series now: a handoff is owed only by a
    # session that ends with work not committed and pushed.
    pass "record — every Markdown file in $HANDOFFS/ is a dated handoff ($(wc -l <"$tmp/handoffdates" | tr -d '[:space:]') examined)"
fi

# 4b. The Session log stays retired. Sessions copied the shape of the entries above theirs, so the
# first session to meet an old handoff telling it to append one would start the log again, and with
# it the conflict every pull request had on this file.
if [ ! -f "$PLAN" ]; then
    fail "record — $PLAN is missing"
else
    grep -n '^- 2[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] ·' "$PLAN" >"$tmp/logentries"
    if [ -s "$tmp/logentries" ]; then
        fail "record — $PLAN carries $(wc -l <"$tmp/logentries" | tr -d '[:space:]') Session log entr(ies); the log retired 2026-09-23 and a change's record is its commit message"
        cut -c1-100 "$tmp/logentries" | sed "s|^|        $PLAN:|"
    else
        pass "record — $PLAN carries no Session log entry; a change's record is its commit"
    fi
fi

# 4c. Changelog fragments. One file per change, `<slug>.<section>.md` holding one top-level bullet;
# the index tool's `--changes` groups them for the cut, which pastes them under the version and
# deletes them. That tool refuses the same fragments this does: the name pattern below and one bullet
# are the rule both carry, and this copy is bash because this recipe needs no node. Anything that is
# not a regular file, a link or a directory git lists (a submodule), is refused in both rather than
# followed or skipped: `[ -f ]` alone followed a link and passed over a directory that the index tool
# refused, a green the cut could not assemble (Copilot, #451). Only a path listed and gone from the
# tree is passed over, as the index tool never sees it either.
: >"$tmp/fragments"
: >"$tmp/badfragments"
while IFS= read -r f; do
    [ -e "$f" ] || [ -L "$f" ] || continue
    base=${f#"$CHANGES"/}
    [ "$base" = README.md ] && continue
    if [ -L "$f" ] || [ ! -f "$f" ]; then
        printf '%s is not a regular file: a fragment is a file of its own, never a link or a directory\n' "$f" >>"$tmp/badfragments"
    elif ! [[ "$base" =~ ^[a-z0-9][a-z0-9-]*\.(added|changed|deprecated|removed|fixed|security)\.md$ ]]; then
        printf '%s is not named <slug>.<section>.md, the section one of added, changed, deprecated, removed, fixed, security\n' "$f" >>"$tmp/badfragments"
    elif ! awk 'NR == 1 && !/^- / { bad = 1 } /^[^[:space:]]/ { top++ } END { exit (NR == 0 || bad || top != 1) }' "$f"; then
        printf '%s is not one top-level bullet: its first line opens "- ", and every later line is indented or blank\n' "$f" >>"$tmp/badfragments"
    else
        printf '%s\n' "$f" >>"$tmp/fragments"
    fi
done < <(grep "^${CHANGES}/" "$manifest")
# The Unreleased section holds no bullet of its own, or two open changes would both append there
# again. Its extent is from the heading to the next `## `. **The heading must be there**: without it
# nothing was counted, so bullets under a renamed one (`## [Unreleased]`, as Keep a Changelog spells
# it) passed as none (Copilot, #451). The cut re-seeds it above the version it writes.
unreleased=0
noheading=
if [ -f "$CHANGELOG" ]; then
    unreleased=$(awk '/^## Unreleased/ { h = 1; on = 1; next } /^## / { on = 0 } on && /^- / { n++ } END { print n + 0; exit !h }' "$CHANGELOG") ||
        noheading=1
    unreleased=${unreleased:-0}
fi
if [ -s "$tmp/badfragments" ] || [ "$unreleased" -ne 0 ] || [ -n "$noheading" ]; then
    fail "record — changelog entries outside what the index tool's \`--changes $CHANGES\` assembles"
    sed 's/^/        /' "$tmp/badfragments"
    [ -z "$noheading" ] ||
        printf '        %s has no ## Unreleased heading, so a bullet under a renamed one goes uncounted — the cut re-seeds it above the version it writes\n' "$CHANGELOG"
    [ "$unreleased" -eq 0 ] ||
        printf '        %s holds %s bullet(s) under ## Unreleased — a change'"'"'s entry is a file in %s/\n' "$CHANGELOG" "$unreleased" "$CHANGES"
else
    pass "record — $(wc -l <"$tmp/fragments" | tr -d '[:space:]') changelog fragment(s) in $CHANGES/, each one bullet; $CHANGELOG's Unreleased holds none"
fi

# 4d. The newest change's commit attests the seam: a `Seam-scan:` line saying clean, the trailer the
# plan's Protocol asks of every commit. The commit read is the newest one on the change's own line that
# is not a merge, following first parents. Where HEAD is a merge the change is its second parent: main
# merges each pull request with a merge commit (the last ten, measured 2026-09-23), and CI checks out a
# pull request's merge ref, which has the same shape. A branch that merged main in has it the other way
# round, so where the second parent is already on the base (`PORTULAN_BASE_REF`, `origin/main` by
# default, as ./pack-version.sh reads it) and the first is not, the change is the first. Following first
# parents steps over the merges that brought main in. A plain `git log -1 --no-merges` reads whichever
# change was committed last on either side, so once a branch had merged main in it judged another pull
# request's commit, in all three shapes (measured). With no base ref to tell the sides apart, the second
# parent is taken. A squash merge keeps the trailer because GitHub composes the squash message from the
# commits' own, which is why a leading `* ` is allowed. There is no cutoff date: only the newest change
# is read, so no commit made before this rule is ever judged by it. The check reads PRESENCE, never
# whether the scan ran. **Only Dependabot is exempt**, since a version bump composes nothing from
# private context. Until Copilot's round on #451 every `[bot]` author was, and that let through a
# session committing through an App's API (`claude[bot]`), which composes from the same context a
# local commit does; the librarian's pass writes the line itself. The author is metadata the commit's
# maker sets, so a session committing under Dependabot's name would still pass: the same trust the
# line itself gets, since only its presence is read (./README.md, known limits). **The value opens with
# `clean`.** Matching the word anywhere after the colon passed `Seam-scan: not clean` and
# `Seam-scan: unclean` (Copilot, #451), so `clean` is the first word, ending there or at a space or
# punctuation.
side=HEAD
if git rev-parse -q --verify 'HEAD^2' >/dev/null; then
    side='HEAD^2'
    # `--end-of-options` because the base is user-supplied; ./pack-version.sh measured why.
    if basesha=$(git rev-parse -q --verify --end-of-options "${PORTULAN_BASE_REF:-origin/main}^{commit}" 2>/dev/null) &&
        git merge-base --is-ancestor 'HEAD^2' "$basesha" && ! git merge-base --is-ancestor 'HEAD^1' "$basesha"; then
        side='HEAD^1'
    fi
fi
if ! change=$(git log -1 --no-merges --first-parent --format=%H "$side" 2>/dev/null) || [ -z "$change" ] ||
    ! git log -1 --format='%an%n%B' "$change" >"$tmp/change" 2>/dev/null; then
    printf 'verify: cannot read the newest commit on %s — cannot check the seam attestation\n' "$side" >&2
    exit 2
fi
author=$(sed -n 1p "$tmp/change")
short=$(git rev-parse --short "$change")
case "$author" in
    'dependabot[bot]')
        pass "record — the newest change ($short) is a Dependabot bump, which composes nothing and owes no seam attestation" ;;
    *)
        if tail -n +2 "$tmp/change" | grep -qiE '^[[:space:]*-]*seam-scan:[[:space:]]*clean([^[:alnum:]_-]|$)'; then
            pass "record — the newest change ($short) carries a \`Seam-scan: clean …\` line"
        else
            fail "record — the newest change ($short) carries no \`Seam-scan: clean …\` line in its commit message"
        fi ;;
esac

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
PR_URL='https://github\.com/sleepy-panda-srl/portulan/pull/[0-9][0-9]*'

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
# **This rail is RETROACTIVE, and that is deliberate — the opposite call from the record rules.** A
# rule written after a record cannot bind it without rewriting the record to suit the rule, so those
# bind forward only: the Session log's entry budget did it with a cutoff date, and `record`'s seam
# check does it by reading only the newest change. Here the remedy is **relocation**, which preserves
# a merged record byte-for-byte, so every historical row can satisfy this rail without one word being
# lost or altered. A cutoff would buy nothing and cost the rail its whole subject, since the rows that
# motivated it are precisely the old ones. Retroactivity is honest exactly when compliance destroys
# nothing, and this is that case.
#
# Scope is the milestone-table rows of docs/plan.md and nothing else, which is load-bearing rather
# than tidy. A file-wide grep for either marker would red the very records this change preserves:
# `Session N of` appeared in eight Session log entries while the log was in the plan (it retired
# 2026-09-23), and every `docs/milestones/*.md` contains `**Criterion amended` by design — it is the
# relocated argument. A rail that fired on the archive it
# just created would be unusable on the first run, so both markers are matched **inside a row only**.
PLAN_STATUS_BUDGET=500   # bytes; see 6c below for the derivation
if [ ! -f "$PLAN" ]; then
    : # already reported by the record check above; nothing here to add
else
    # A milestone row starts with a pipe and a number. The header, the separator, the retired log's
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

# ------------------------------------------------------------------ 7. cli table
# One check, in BOTH directions, on `cli/README.md`'s *What is here today* table: every file in `cli/`
# has a row, and every row names a file that exists. #203.
#
# **Why a rail rather than a corrected number.** That table carried a hand-maintained count of its own
# arrears — "nine files have no row" — and the count went wrong four times: eleven, then seven, then a
# correction to eight, then nine, and finally ten while the sentence still said nine. The last one is
# the argument: `pinned-roots.live.test.mjs` landed at session 12 and reached neither the table nor the
# sentence that counts the table's arrears, because a figure maintained by hand about a table maintained
# by hand drifts by the same mechanism. Both directions are checked because both failed in practice —
# files arrived without rows, and `fixtures/` shows a row can outlive what it names.
#
# **The pattern is ANCHORED, and that is the load-bearing detail.** A previous hand re-derivation
# searched for each filename *anywhere in the table*, so `stop-gate.mjs` counted as rowed on the
# strength of a link inside `stop-gate.test.mjs`'s prose, and reported one fewer arrear than the tree
# held. A row is `| [` + backtick + name + backtick + `]` at the START of a line, and this extracts
# exactly one subject per row rather than searching for names.
#
# **Tracked files only** (`git ls-files`), so an untracked scratch file in `cli/` is not a failure of
# the table — the table describes what the repository ships, and `git` is already in this recipe's
# dependency guard.
CLI_README=cli/README.md
CLI_FILE_EXEMPT=README.md
CLI_ROW_EXEMPT=fixtures/

if [ ! -f "$CLI_README" ]; then
    fail "cli-table — $CLI_README does not exist"
else
    # `cli/*.md` as a git PATHSPEC matches across `/`, so it also sweeps in `cli/fixtures/**/*.md` —
    # this rail's first run went red on four files inside `fixtures/drifted-workspace/`. Shell `ls`,
    # which the hand measurement used, does not cross a slash; swapping in `git ls-files` swapped the
    # question for a broader one, which is the same instrument-substitution defect this recipe checks
    # documents for. The remaining-slash filter is what makes the two agree, and it is stated rather
    # than left as a silent narrowing.
    # **`core.quotePath=false`, for the reason given at the enumeration above and NOT for tidiness.**
    # This pipeline is the one place in this recipe where the C-quoted spelling is dropped instead of
    # carried: a quoted path keeps its `cli/` prefix inside the quote, so `sed 's|^cli/||'` does not
    # match it and `grep -v '/'` then discards it as a subdirectory entry. Measured, not reasoned —
    # `cli/café.mjs` leaves this pipeline as nothing at all, so the table check below compares a list
    # the file is missing from and passes. **A false GREEN, and the only one this class produces here**:
    # the enumeration reads above turn a quoted path into a false RED, which is loud. This one is silent,
    # which is why it outranks the rest of the sweep despite being the least conspicuous line in it.
    git -c core.quotePath=false ls-files 'cli/*.mjs' 'cli/*.md' | sed 's|^cli/||' | grep -v '/' | sort >"$tmp/clifiles"
    # POSIX `sed` rather than `grep -o`: `-o` is not in POSIX grep, and ./README.md states this recipe's
    # dependencies are POSIX text utilities. (This used to add that `docs.sh` "already breaks that claim
    # once, at the `grep -nEo` in the links check". It no longer does — #257 closed that site with POSIX
    # `awk`, so the recipe and its documented dependency set now agree and the parenthetical is retired
    # rather than left to read as a live exception.) One capture per line, printed only when it matches,
    # which is the anchored extraction stated above.
    sed -n 's/^| \[`\([^`]*\)`\].*/\1/p' "$CLI_README" | sort >"$tmp/clirows"

    clifiles=$(wc -l <"$tmp/clifiles" | tr -d '[:space:]')
    clirows=$(wc -l <"$tmp/clirows" | tr -d '[:space:]')

    # The precondition, for the reason ./tests.sh states: an empty enumeration would make both
    # comparisons below vacuously green, which is the same shape as a recipe reporting on nothing.
    if [ "$clifiles" -eq 0 ] || [ "$clirows" -eq 0 ]; then
        printf 'verify: cli-table enumerated %s file(s) and %s row(s) — refusing to compare nothing\n' \
            "$clifiles" "$clirows" >&2
        exit 2
    fi

    # THE EXEMPTIONS ARE AUDITED, NOT ASSUMED. A stale exemption is a defect in the declaration rather
    # than a verdict about the table, so it exits 2 — the same code and the same reasoning as
    # `index.sh`'s stale WORKSPACES entry and `control-chars`'s stale `--exempt`. Declaring an exception
    # that no longer applies teaches the next reader to widen a pattern until it stops complaining.
    # BOTH HALVES, because the exemption claims both. `README.md` is exempt from the files-need-rows
    # direction, so the exemption is stale if the file is gone AND stale if it has since GAINED a row —
    # and the first version audited only the former, exempting a row that no longer needed exempting
    # without noticing. An exemption audited on half its own claim is the asymmetry this check exists to
    # catch, in the check itself. Copilot, #255 round 1.
    if ! grep -qxF "$CLI_FILE_EXEMPT" "$tmp/clifiles"; then
        printf 'verify: cli-table exempts the file %s, which is not in cli/ — stale exemption\n' \
            "$CLI_FILE_EXEMPT" >&2
        exit 2
    fi
    if grep -qxF "$CLI_FILE_EXEMPT" "$tmp/clirows"; then
        printf 'verify: cli-table exempts the file %s from needing a row, and it now HAS one — stale exemption\n' \
            "$CLI_FILE_EXEMPT" >&2
        exit 2
    fi
    if ! grep -qxF "$CLI_ROW_EXEMPT" "$tmp/clirows"; then
        printf 'verify: cli-table exempts the row %s, which the table no longer carries — stale exemption\n' \
            "$CLI_ROW_EXEMPT" >&2
        exit 2
    fi

    comm -23 "$tmp/clifiles" "$tmp/clirows" | grep -vxF "$CLI_FILE_EXEMPT" >"$tmp/clinorow" || true
    comm -13 "$tmp/clifiles" "$tmp/clirows" | grep -vxF "$CLI_ROW_EXEMPT" >"$tmp/clinofile" || true

    norow=$(wc -l <"$tmp/clinorow" | tr -d '[:space:]')
    nofile=$(wc -l <"$tmp/clinofile" | tr -d '[:space:]')

    if [ "$norow" -gt 0 ] || [ "$nofile" -gt 0 ]; then
        fail "cli-table — $norow file(s) with no row, $nofile row(s) naming no file"
        sed 's/^/        no row: /' "$tmp/clinorow"
        sed 's/^/        no file: /' "$tmp/clinofile"
    else
        pass "cli-table — $clifiles file(s), $clirows row(s), both directions clean (exempt: file $CLI_FILE_EXEMPT, row $CLI_ROW_EXEMPT)"
    fi
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
