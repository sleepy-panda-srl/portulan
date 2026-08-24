#!/usr/bin/env bash
# Portulan workspace — verify recipe: every compiled gate carries adversarial fixtures, and each one
# still answers as recorded.
#
# One check:
#   goldens   ../../evals/goldens/gates/ is graded against the gate policy this workspace YIELDS —
#             ../gates.json plus the fragments its composed packs contribute — through the compiler's
#             own exported `matchesRule`, the same function the hook calls at tool time.
#
# Milestone 8, clause (a): *golden tasks reach the gates as well as the skills, so a matcher ships
# with the attack cases that prove its coverage instead of prose describing it.* The argument for the
# clause is in ../../docs/milestones/m08.md and the mechanism is in ../../cli/goldens.mjs; what belongs
# here is why the recipe exists at all.
#
# **The gate map carries an honest-holes list, and that list was wrong when first published** — four
# items, five missing, the plainest of them a newline. It was corrected by a supervisor who tried to
# DEFEAT the matcher rather than read it, after the gate had already been called done. A hole list is
# a claim like any other, and the only thing that checks it is somebody attacking it. This recipe is
# where those attacks get re-run on every pull request instead of on the day somebody happens to look.
#
# It went red on its first run and found a hole nobody had recorded — a rule whose target is the whole
# repository (`./`) matches nothing at runtime, now entry 8 of ../gate-map.md.
#
# **What this recipe CANNOT establish**, said here rather than left to be assumed from a green: that
# the corpus is ADEQUATE. It is a presence floor — one trivial fixture per rule satisfies it while
# proving nothing adversarial, and no check can tell the difference. Judging whether a corpus is a
# real attack is a reviewer's job, and ../../cli/goldens.mjs prints that limit on every green rather
# than letting the exit code imply more than it means.
#
# The judgement lives in ../../cli/goldens.mjs, which the test suite covers; this wrapper does the
# dependency guard and the exit-code passthrough.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in dirname node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The runner's own presence is a precondition, not a red. `node cli/goldens.mjs` on a missing file
# exits 1, and passing that through would print "the gate corpus has findings" about a corpus nothing
# had read — the defect a reviewer found in doctor.sh and this repository has now met four times.
for required in cli/goldens.mjs cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot grade the gate corpus\n' "$required" >&2
        exit 2
    fi
done

# The corpus directory is the same kind of precondition. An EMPTY corpus is a red — that is the whole
# coverage rail — but a corpus directory that is not there at all is a tree this recipe cannot judge.
if [ ! -d evals/goldens/gates ]; then
    printf 'verify: evals/goldens/gates/ is missing — the fixture corpus is what this recipe grades\n' >&2
    exit 2
fi

# Spelled out rather than elided. This read "against the gate policy .portulan/ yields" — a reduced
# relative clause that scans as a TRUNCATED line in a CI log, where a reader has no context to
# recover the missing "that" from. Reported as a suppressed note by Copilot, round 5 on #336.
printf 'goldens: grading evals/goldens/gates/ against the gate policy that .portulan/ yields — its own rules plus its composed packs fragments\n'

# ---------------------------------------------------------------------------------------------
# **The resolution root is PINNED, for the reason ./compile.sh states at length.** A required check
# answers *does this tree hold its own claims*, so its answer may not move with what happens to be
# installed on the machine running it. Naming the root replaces every other source.
#
# The runner refuses host discovery outright as well — it passes `discovery: null` whatever the
# command line says — so this pin is the second of two carriers rather than the only one. Both, and
# deliberately: `compile --matrix` without a pin was measured REFUSING on the maintainer's machine as
# SHADOWED, an installed cache copy at one version against the tree's at another, which is what a
# host-sensitive rail looks like from the inside.
# ---------------------------------------------------------------------------------------------
node cli/goldens.mjs --workspace . --pack-root packs --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # 2 is "could not judge", passed through rather than translated — the arm ./compile.sh was missing
    # for one checkpoint, where a genuine exit 2 fell to the catch-all and printed a sentence about the
    # tool misbehaving when it had not.
    2) exit 2 ;;
    # Anything else is a code the runner does not document, and mapping an unknown status onto a
    # verdict is how a crash starts reading as a clean bill of health.
    *)
        printf 'verify: goldens exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
