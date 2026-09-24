#!/usr/bin/env bash
# Portulan workspace — verify recipe: the test suite.
#
# One check:
#   tests   every *.test.mjs under ../../cli/ passes — enumerated and counted by `find` first,
#           then run by a recursive glob covering that same set, so a new suite joins this
#           recipe by existing rather than by being named here
#
# This is the first recipe here that runs *tests* rather than linting documents. Until milestone 2
# this repository shipped no code, so ./README.md's "real tests join these — they do not replace
# them" was a promise; `doctor` is the code, and this is the promise kept.
#
# The file count is a precondition, not a formality — measured, not assumed. `node --test` given a
# glob that matches nothing exits 0: a green suite that ran nothing, which is the same shape as a
# verify recipe that enumerated nothing (../memory/verify-preconditions-fail-closed.md). So the
# count is established first and a zero exits 2.
#
# The glob is passed to node QUOTED and is recursive, and both details are load-bearing. Node 26
# rejects a bare directory argument, so `node --test cli/` fails to resolve rather than running the
# suite — which cost this recipe's author a transcript that looked like a red for the right reason
# and was not. And the glob must cover the same set the count does: a non-recursive `cli/*.test.mjs`
# beside a recursive `find` would let a test file in a subdirectory be counted and never run, which
# is the fail-open in miniature.
#
# A red run ends with the tests that failed, one line each with where it is: the last lines a reader
# is shown, the Stop-gate's 25 and `finish`'s, would otherwise hold the runner's totals alone, and the
# suite would be run a second time to learn which. Only tests are listed, not the suites around them,
# so the list is as long as the runner's own `# fail` count. The output still streams; `tee` keeps a
# copy to read the names from, and the runner's exit is taken from PIPESTATUS, never through the pipe
# (../memory/an-exit-code-read-through-a-pipe-is-the-pipes.md).
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
# This recipe was already correct on the three dependencies that can empty its input: a missing
# `find`, `tr` or `wc` each exited 2, because the suite count is checked against zero before anything
# runs. Not "correct on everything", and the difference is worth stating rather than rounding off —
# a missing `rm` exited 0, because `rm` appears only in the EXIT trap and by then the suite had run
# on real data. A failed cleanup is not a false verdict, which is why it is none of the eleven; the
# guard covers it anyway, since a recipe that lists what it runs and then runs something else is the
# drift this loop exists to stop.
for need in awk dirname find mktemp node rm tee tr wc; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The count IS the precondition, so establishing it is itself a precondition — the same recursion
# ../memory/verify-preconditions-fail-closed.md describes, one level in. Piping `find` straight into
# `wc -l` discards `find`'s exit status, and a partial failure is the dangerous case rather than a
# total one: with one unreadable subdirectory `find` prints an error, exits 1, and still lists what it
# could reach, so the count comes back plausible-but-short and the suite runs a subset while reporting
# on the whole. Demonstrated at two files, one unreadable directory, count 1. Found by a reviewer on
# the pull request.
tmp=$(mktemp) || exit 2
trap 'rm -f -- "$tmp"' EXIT

if ! find cli -name '*.test.mjs' -type f >"$tmp"; then
    printf 'verify: find failed while enumerating test files — cannot establish what would run\n' >&2
    exit 2
fi

count=$(wc -l <"$tmp" | tr -d '[:space:]')
case "$count" in
    '' | *[!0-9]*)
        printf 'verify: could not count test files (got "%s") — refusing to guess\n' "$count" >&2
        exit 2
        ;;
esac
if [ "$count" -eq 0 ]; then
    printf 'verify: no test files found under cli/ — refusing to report green having run nothing\n' >&2
    exit 2
fi
printf 'tests: %s test file(s) found\n' "$count"

out=$(mktemp) || exit 2
trap 'rm -f -- "$tmp" "$out"' EXIT
node --test "cli/**/*.test.mjs" 2>&1 | tee -- "$out"
codes=("${PIPESTATUS[@]}")
status=${codes[0]}
# A `tee` that failed kept and showed only part of what the runner wrote, and a runner writing into a pipe
# it had closed may have died of it: no verdict either way, so could-not-run.
if [ "${codes[1]}" -ne 0 ]; then
    printf 'verify: tee exited %s, so the runner'"'"'s output was not all kept or shown — could not run rather than a verdict\n' "${codes[1]}" >&2
    exit 2
fi
if [ "$status" -ne 0 ]; then
    failed=$(awk -v root="$(pwd -P)/" '
        /^[ \t]*not ok [0-9]+ - / { if (pending != "") print "  " pending; line = $0; sub(/^[ \t]*not ok [0-9]+ - /, "", line); pending = line; next }
        pending != "" && /^[ \t]*type: \047suite\047/ { pending = ""; next }
        pending != "" && /^[ \t]*location: / {
            loc = $0; sub(/^[ \t]*location: \047/, "", loc); sub(/\047$/, "", loc)
            if (index(loc, root) == 1) loc = substr(loc, length(root) + 1)
            print "  " loc " — " pending; pending = ""; next
        }
        pending != "" && /^[ \t]*(ok|not ok) [0-9]+ / { print "  " pending; pending = "" }
        END { if (pending != "") print "  " pending }
    ' "$out")
    if [ -z "$failed" ]; then
        printf '\ntests: the runner exited %s and named no failing test; its own lines above say why\n' "$status"
    else
        n=$(printf '%s\n' "$failed" | wc -l | tr -d '[:space:]')
        # The count again after the list, so it survives a 25-line tail that more than 23 names would overflow.
        printf '\ntests: %s failing test(s), where each is and its name:\n%s\ntests: %s failing\n' "$n" "$failed" "$n"
    fi
fi
exit "$status"
