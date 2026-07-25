#!/usr/bin/env bash
# Portulan workspace — verify recipe: the test suite.
#
# One check:
#   tests   ../../cli/doctor.test.mjs passes
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

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2
command -v node >/dev/null 2>&1 || {
    printf 'verify: node not found — this recipe needs it; see .portulan/verify/README.md\n' >&2
    exit 2
}

count=$(find cli -name '*.test.mjs' -type f | wc -l | tr -d '[:space:]')
if [ "$count" -eq 0 ]; then
    printf 'verify: no test files found under cli/ — refusing to report green having run nothing\n' >&2
    exit 2
fi
printf 'tests: %s test file(s) found\n' "$count"

node --test "cli/**/*.test.mjs"
