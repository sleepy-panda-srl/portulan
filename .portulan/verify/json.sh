#!/usr/bin/env bash
# Portulan workspace — verify recipe for the machine-readable files.
#
# One check. It exists because milestone 2 introduces the first JSON this repository *depends* on
# rather than merely carries: the Workspace Definition schema and the manifest instantiating it.
#   parse   every tracked .json file parses            (a manifest that does not parse gates nothing)
#
# This checks well-formedness and NOTHING ELSE. It does not validate the manifest against the
# schema, and it does not check that the paths a manifest names exist — that is `doctor`, which
# arrives in the second milestone-2 session. Saying so matters: a recipe that implies more coverage
# than it has makes every later green worth less (see ./README.md).
#
# Exit 0 green · 1 red · 2 could not run. Unlike ./docs.sh this recipe needs `node`, because
# well-formedness is a parser's judgement and there is no honest way to ask bash for it.
# See ./README.md for why that dependency was accepted and what it costs.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
# `git` and `node` were guarded and the rest were not, so with `grep`, `sed`, `tr` or `wc` absent
# this recipe exited GREEN over a file list that had gone empty on the way here.
for need in dirname git grep mktemp node rm sed tr wc; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT
status=0

fail() { status=1; printf 'FAIL  %s\n' "$1"; }
pass() { printf 'ok    %s\n' "$1"; }

# Tracked plus new-and-not-ignored, so a malformed file is caught before it is committed,
# not after — the same manifest rule ./docs.sh uses, for the same reason.
#
# And the same precondition check, for the same reason: an unchecked failure here yields an
# empty list, zero files scanned, and a GREEN report from a recipe that examined nothing.
# See ./README.md, Provenance.
# `-z` rather than the newline-separated form, and the reason is #209: a tracked filename may legally
# contain a newline, and splitting on one mis-splits it into two paths that do not exist — silently,
# because a path that does not exist is skipped as "tracked but deleted" two screens down. `-z` is the
# shape ./control-chars.sh already models, and it recorded this file as the sibling it had not fixed.
manifest="$tmp/manifest"
if ! git ls-files --cached --others --exclude-standard -z >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

# ---------------------------------------------------------------------- 1. parse
# The file list goes to node on stdin rather than as arguments. `node -e` shifts argv in a way
# that is easy to get wrong — the first draft of this check indexed it wrongly and reported a
# perfectly good file as malformed. A false red is the one outcome ./README.md says to avoid at
# any cost, so the argument handling is gone rather than fixed.
# Filtered in node rather than by `grep -E` into a second file: the list is NUL-delimited now, and a
# `grep`/`wc -l` pair over NUL records would count lines rather than paths — an instrument reporting a
# number about a shape it is not reading. node splits on NUL, filters, and reports the count it used.
node -e '
    const fs = require("fs");
    const files = fs.readFileSync(0, "utf8").split("\0").filter(Boolean).filter((f) => f.endsWith(".json"));
    process.stderr.write(String(files.length));
    for (const file of files) {
        if (!fs.existsSync(file)) continue;   // tracked but deleted in the working tree
        try {
            JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {
            process.stdout.write(file + " -> " + String(e.message).split("\n")[0] + "\n");
        }
    }
' <"$manifest" >"$tmp/bad" 2>"$tmp/count"

# The count arrives on stderr and is the only thing written there on success, so a non-numeric stderr
# is node itself having failed — which stays exit 2, never a verdict about the tree.
count=$(cat "$tmp/count")
case "$count" in
    '' | *[!0-9]*)
        printf 'verify: node failed while parsing\n' >&2
        sed 's/^/        /' "$tmp/count" >&2
        exit 2
        ;;
esac

if [ -s "$tmp/bad" ]; then
    fail "parse — $(wc -l <"$tmp/bad" | tr -d '[:space:]') malformed JSON file(s)"
    sed 's/^/        /' "$tmp/bad"
else
    pass "parse — $count JSON file(s) parse"
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
