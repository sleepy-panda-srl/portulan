#!/usr/bin/env bash
# Portulan workspace — verify recipe: the jq programs the workflows run are executed, not described.
#
# One check:
#   filters   every jq program in .github/workflows/ produces the exact bytes and the exit status
#             the surrounding shell branches on — read out of the workflow files themselves and run
#             through the real `jq` binary against null-bearing and ordinary fixtures
#
# The argument, the fixtures and the two-way coverage rule are in ./workflow-filters.mjs, which is
# the instrument; this is the wrapper, and the wrapper is the point (./README.md). Two merge-gate
# workflows branch on what jq prints for null — `copilot-review.yml` on an empty first field from
# `join("|")`, `pr-labels.yml` on `jq -er` producing no output — and until this recipe nothing
# executed either. The harness covering the first stubs `gh`, so it asserted the *shape* those
# filters were assumed to produce with nothing proving jq produced it.
#
# WHY THIS IS A RECIPE AND NOT A FILE IN cli/. The suite is the obvious home — it is `node --test`
# over `cli/*.test.mjs` and this is a regression test. It was refused for the reason this whole
# directory exists: `node --test` has no third outcome. On a machine without `jq` the test would
# either skip — and a skipped test still exits 0, so the suite would report green over a check that
# never ran, the exact false green ../memory/verify-preconditions-fail-closed.md was minted for — or
# fail, which says the repository is broken when only the environment is, and ./README.md records
# that a false red is the failure that gets a whole recipe switched off. Exit 2 is the answer to
# "could not look", and only the verify layer has it.
#
# The second reason is smaller and still real: keeping the codes honest inside the suite would mean
# adding `jq` to ../verify/tests.sh's `for need in …` guard, so a machine without it could run none
# of the 309 tests rather than one fewer check.
#
# WHAT THIS COSTS: `jq` becomes the first dependency in this directory that is neither `bash`, a
# POSIX text utility, nor `node` — see ../identity.md, which owns that line. It is declared in
# ../workspace.json, so a machine without it gets exit 2 from this recipe alone, and CI turns any
# non-zero into a red job. It is not the `claude plugin validate` case, which ./README.md keeps out
# of the recipes because it would exit 2 on every CI run: `jq` ships on `ubuntu-latest` and nothing
# is installed to get it.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape. `jq`
# is guarded here rather than left to the instrument because `node` exiting on a missing binary and
# this recipe reporting "could not run" are two different sentences, and the second is the one the
# Stop-gate and CI read. The instrument checks it again anyway, for a direct `node` invocation.
for need in dirname jq node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The instrument's own presence is a precondition, not a red — `node` on a missing file exits 1, and
# passing that through would report "the filters have drifted" about programs nothing had looked at.
# The defect a reviewer found in doctor.sh, one dependency over from the guard written to stop it.
for required in .portulan/verify/workflow-filters.mjs .github/workflows; do
    if [ ! -e "$required" ]; then
        printf 'verify: %s is missing — cannot judge the workflows'"'"' jq programs\n' "$required" >&2
        exit 2
    fi
done

node .portulan/verify/workflow-filters.mjs
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # 2 is the instrument's "could not run" and this recipe's, passed through rather than translated
    # — the arm ./compile.sh spent a checkpoint without.
    2) exit 2 ;;
    # Anything else is a code the instrument does not document, and mapping an unknown status onto a
    # verdict is how a crash starts reading as a clean bill of health.
    *)
        printf 'verify: workflow-filters exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
