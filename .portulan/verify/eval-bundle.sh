#!/usr/bin/env bash
# Portulan workspace — verify recipe: a clean evaluation bundle cuts from HEAD.
#
# One check:
#   eval-bundle   cli/eval-bundle.mjs --check cuts HEAD to a scratch directory for a fixture
#                 recipient and verifies every invariant — the top-level payload partition matches
#                 the tree, the machine-read license census equals the patch list, the transforms
#                 land, and no machine-read Apache assertion survives the cut — then deletes the
#                 scratch. What it enforces day to day is the two pinned rosters: a new top-level
#                 path, or a new manifest asserting Apache inside the payload, goes red HERE with
#                 a repair menu, instead of silently thinning or mislicensing the next bundle.
#                 A fourth refusal sits at 2, not 1: a payload entry that is neither a plain nor
#                 an executable blob (a symlink, a gitlink) is could-not-run, named — no licensing
#                 verdict can be formed from a payload the tool will not materialise.
#
# The judgement lives in cli/eval-bundle.mjs, which the test suite covers; this wrapper does the
# dependency guard and the exit-code passthrough. NO tar in the guard, deliberately: the cut is
# materialised through git plumbing and hashed in node, so this recipe adds nothing to the verify
# set's dependency floor — tar exists only on the issuance path, which no recipe runs.
#
# A limit, named: --check reads HEAD, so an uncommitted manifest edit is invisible to it until
# committed. CI runs this on the merge commit, which is the enforcing instance.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in dirname git node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The module is the judgement, so its absence is could-not-run, never a red — measured: node's
# MODULE_NOT_FOUND exits 1, which the passthrough below would print as "RED — verify recipe
# failed" about a bundle nothing had cut. The same precondition ./control-chars.sh carries, for
# the same reason; found by the pre-commit checkpoint on this recipe and on ./pack-version.sh in
# the same pass.
[ -f cli/eval-bundle.mjs ] || {
    printf 'verify: cli/eval-bundle.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# Exit read DIRECTLY, never through a pipe: a pipeline reports the LAST command's status, so
# `| tail` would report tail's 0 over a printed RED. Measured on this repository, 2026-08-14, on
# another recipe.
node cli/eval-bundle.mjs --check
code=$?

case "$code" in
    0) printf 'GREEN — verify recipe passed.\n' ;;
    1) printf 'RED — verify recipe failed; "done" is blocked.\n' ;;
    *) printf 'verify: eval-bundle could not run (exit %s)\n' "$code" >&2 ;;
esac
exit "$code"
