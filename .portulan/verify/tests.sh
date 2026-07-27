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
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
# This recipe was already correct on every dependency measured (a missing `find`, `tr` or `wc` each
# exited 2), because the suite count is checked against zero before anything is run. The guard is
# here so that correctness is stated rather than incidental, and so the shape is uniform.
for need in dirname find mktemp node rm tr wc; do
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

node --test "cli/**/*.test.mjs"
