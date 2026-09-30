#!/usr/bin/env bash
# Portulan workspace — verify recipe: links, kernel budget, map, record, proposals, plan and cli table.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs: an absent one prints nothing, which would read as green.
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

# core.quotePath=false: git otherwise C-quotes a non-ASCII path, and the quoted spelling is not the path.
manifest="$tmp/manifest"
if ! git -c core.quotePath=false ls-files --cached --others --exclude-standard >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

# ---------------------------------------------------------------------- 1. links
# git decides whether a link resolves, since CI has only tracked files; the disk only picks the advice.

# Tracked paths only, never --others: an untracked target is absent from every clone.
tracked="$tmp/tracked"
if ! git -c core.quotePath=false ls-files --cached >"$tracked"; then
    printf 'verify: git ls-files --cached failed — cannot establish what the repository carries\n' >&2
    exit 2
fi
if [ ! -s "$tracked" ]; then
    printf 'verify: the repository reports no tracked files — refusing to judge links against that\n' >&2
    exit 2
fi

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
        case "$target" in
            http://*|https://*|mailto:*|//*|"#"*) continue ;;
        esac
        path=${target%%#*}                      # a #fragment is not checked, only the file
        [ -n "$path" ] || continue
        printf '%s\t%s\t%s\t%s\t%s\n' "$file" "$line" "$dir" "$path" "$target" >>"$tmp/cand"
    # POSIX awk rather than grep -o. A target holding a ) is cut short there: a known limit.
    done < <(awk '{ s = $0; while (match(s, /\]\([^)]+\)/)) { printf "%d:%s\n", NR, substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH) } }' "$file" 2>/dev/null)
done <"$manifest"

: >"$tmp/links"
awk -F'\t' -v tracked_file="$tracked" '
    # No apostrophe anywhere in this program: the shell holds it in single quotes.
    # "\001" is a safe sentinel only while paths come from ls-files without -z, which C-quotes that byte.
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
        # Judged before normalize, which drops the leading /: a renderer resolves it from the site root.
        if ($4 ~ /^\//) { print $1 "\t" $2 "\t" $5 "\tabsolute\t-"; next }
        wants_dir = ($4 ~ /\/$/)
        norm = normalize($3, $4)
        if (norm == "\001") { print $1 "\t" $2 "\t" $5 "\troot\t-"; next }
        if (norm == "") next                    # the repository root itself; always carried
        if (!wants_dir && (norm in have)) next
        if ((norm "/") in dir) next
        # No field may be empty: to bash a tab is IFS whitespace, so two read as one and shift the rest.
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

# Whether a tracked symlink or submodule on the path stops git add, which blocked_by then names.
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
        # Unreachable, and kept: note would otherwise carry the previous link's diagnosis.
        *)
            printf 'verify: the links check emitted the unknown diagnosis %s — refusing to render it\n' "$why" >&2
            exit 2
            ;;
    esac
    printf '%s:%s -> %s  (%s)\n' "$file" "$line" "$target" "$note" >>"$tmp/links"
done <"$tmp/findings"

if [ -s "$tmp/links" ]; then
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
            awk -F/ 'NF > 1 { print $1 }' "$manifest"
            # A top-level symlink to a directory is one path with no /, so only [ -d ] finds it.
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
PLAN=docs/plan.md
HANDOFFS=.portulan/handoffs
HANDOFFS_RE=${HANDOFFS//./\\.}
CHANGES=changes
CHANGELOG=CHANGELOG.md

# 4a. Every Markdown file in the handoffs directory is a handoff dated with a real day.
# real_day accepts the days cli/index.mjs's dateOf accepts, since the Stop-gate runs this recipe alone.
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
: >"$tmp/irregular"
[ ! -L "$HANDOFFS" ] ||
    printf '%s itself is a link, so no handoff under it is examined here\n' "$HANDOFFS" >>"$tmp/irregular"
while IFS= read -r h; do
    [ -e "$h" ] || [ -L "$h" ] || continue
    base=${h##*/}
    if [ -L "$h" ] || [ ! -f "$h" ]; then
        printf '%s\n' "$h" >>"$tmp/irregular"
        continue
    fi
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
if [ -s "$tmp/strays" ] || [ -s "$tmp/irregular" ]; then
    if [ -s "$tmp/strays" ]; then
        fail "record — Markdown file(s) in $HANDOFFS/ whose name does not lead with a real YYYY-MM-DD day, so no index line can be derived"
        sed 's/^/        /' "$tmp/strays"
    fi
    if [ -s "$tmp/irregular" ]; then
        fail "record — entr(ies) in $HANDOFFS/ that are not regular files of this tree: a handoff is a file of its own, never a link or a directory"
        sed 's/^/        /' "$tmp/irregular"
    fi
else
    # Zero handoffs is a legitimate series: one is owed only by a session ending with work unpushed.
    pass "record — every Markdown file in $HANDOFFS/ is a dated handoff ($(wc -l <"$tmp/handoffdates" | tr -d '[:space:]') examined)"
fi

# 4b. The Session log stays retired.
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

# 4c. Every file in changes/ is one changelog fragment, by the rule the index tool's --changes applies.
: >"$tmp/fragments"
: >"$tmp/badfragments"
[ ! -L "$CHANGES" ] ||
    printf '%s is a link: fragments are files of this tree, read where they are written\n' "$CHANGES" >>"$tmp/badfragments"
if ! grep -qx "$CHANGES/README.md" "$manifest" || [ -L "$CHANGES/README.md" ] || [ ! -f "$CHANGES/README.md" ]; then
    printf '%s/README.md is missing or not a regular file: a cut deletes every fragment, and git keeps no empty directory for the evaluation bundle to ship\n' "$CHANGES" >>"$tmp/badfragments"
fi
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
unreleased=0
noheading=
if [ -f "$CHANGELOG" ]; then
    unreleased=$(awk '/^## Unreleased[ \t]*$/ { h = 1; on = 1; next } /^## / { on = 0 } on && /^- / { n++ } END { print n + 0; exit !h }' "$CHANGELOG") ||
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

# 4d. The newest change's commit carries a Seam-scan: clean line.
# Where HEAD is a merge the change is its second parent, unless that is on the base and the first is not.
side=HEAD
if git rev-parse -q --verify 'HEAD^2' >/dev/null; then
    side='HEAD^2'
    # --end-of-options: the base ref comes from the environment and may begin with a dash.
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
        # A leading bullet is allowed: GitHub composes a squash message from the commits' own.
        if tail -n +2 "$tmp/change" | grep -qiE '^[[:space:]*-]*seam-scan:[[:space:]]*clean([^[:alnum:]_-]|$)'; then
            pass "record — the newest change ($short) carries a \`Seam-scan: clean …\` line"
        else
            fail "record — the newest change ($short) carries no \`Seam-scan: clean …\` line in its commit message"
        fi ;;
esac

# ------------------------------------------------------------------- 5. proposal
# Shape only: whether a proposal was accepted is cli/librarian.mjs's to report, never a red here.
PROPOSALS=.portulan/proposals
PROPOSALS_RE=${PROPOSALS//./\\.}
PR_URL='https://github\.com/sleepy-panda-srl/portulan/pull/[0-9][0-9]*'

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
    # 5b. It records an outcome, as **Decision.** or as the **Status.** some proposals use instead.
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

    # 5c. It names the pull request that filed it, by full URL, since a bare #N may be an issue.
    if [ -s "$tmp/plinks" ]; then
        fail "proposal — $(wc -l <"$tmp/plinks" | tr -d '[:space:]') proposal(s) name no pull request (\`**Pull request:**\` with a full URL)"
        sed 's/^/        /' "$tmp/plinks"
    else
        pass "proposal — every proposal names the pull request that filed it ($(wc -l <"$tmp/proposals" | tr -d '[:space:]') examined)"
    fi
fi

# ----------------------------------------------------------------------- 6. plan
PLAN_STATUS_BUDGET=500   # bytes: about 30% over the largest Status cell when it was set, 387
if [ ! -f "$PLAN" ]; then
    : # reported by the record check above
else
    : >"$tmp/rows"
    grep -nE '^\| *[0-9]+ *\|' "$PLAN" >"$tmp/rows"
    if [ ! -s "$tmp/rows" ]; then
        printf 'verify: no milestone rows found in %s — cannot check the table\n' "$PLAN" >&2
        exit 2
    fi
    rowcount=$(wc -l <"$tmp/rows" | tr -d '[:space:]')

    # 6a. An amendment argument belongs in the milestone's file, not in its row.
    : >"$tmp/planamend"
    grep -nE '^\| *[0-9]+ *\|' "$PLAN" | grep -F '**Criterion amended' >>"$tmp/planamend" || true
    if [ -s "$tmp/planamend" ]; then
        fail "plan — milestone row(s) carrying an amendment argument; it belongs in docs/milestones/"
        cut -d: -f1 "$tmp/planamend" | sed 's/^/        docs\/plan.md:/'
    else
        pass "plan — no milestone row carries an amendment argument ($rowcount row(s) examined)"
    fi

    # 6b. So does a session note.
    : >"$tmp/plansess"
    grep -nE '^\| *[0-9]+ *\|' "$PLAN" | grep -E '[Ss]ession [0-9]+ of' >>"$tmp/plansess" || true
    if [ -s "$tmp/plansess" ]; then
        fail "plan — milestone row(s) carrying a session note; it belongs in docs/milestones/"
        cut -d: -f1 "$tmp/plansess" | sed 's/^/        docs\/plan.md:/'
    else
        pass "plan — no milestone row carries a session note ($rowcount row(s) examined)"
    fi

    # 6b′. A row that does not split into five cells is refused: 6c reads Status as the sixth field.
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

    # 6c. The Status cell is a verdict, not a narrative, bounded in bytes: mawk's length() counts bytes.
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
# Every file in cli/ has a row in cli/README.md's table, and every row names a file that exists.
CLI_README=cli/README.md
CLI_FILE_EXEMPT=README.md
CLI_ROW_EXEMPT=fixtures/

if [ ! -f "$CLI_README" ]; then
    fail "cli-table — $CLI_README does not exist"
else
    # A pathspec * crosses /, hence grep -v; core.quotePath=false, or a quoted non-ASCII name drops out.
    git -c core.quotePath=false ls-files 'cli/*.mjs' 'cli/*.md' | sed 's|^cli/||' | grep -v '/' | sort >"$tmp/clifiles"
    # One subject per row, anchored at the line start, so a name in another row's prose is not a row.
    sed -n 's/^| \[`\([^`]*\)`\].*/\1/p' "$CLI_README" | sort >"$tmp/clirows"

    clifiles=$(wc -l <"$tmp/clifiles" | tr -d '[:space:]')
    clirows=$(wc -l <"$tmp/clirows" | tr -d '[:space:]')

    if [ "$clifiles" -eq 0 ] || [ "$clirows" -eq 0 ]; then
        printf 'verify: cli-table enumerated %s file(s) and %s row(s) — refusing to compare nothing\n' \
            "$clifiles" "$clirows" >&2
        exit 2
    fi

    # A stale exemption is a fault in this recipe, not a verdict on the table, so it exits 2.
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
