#!/usr/bin/env bash
# Portulan workspace — verify recipe: the A/B graders read the ARM, and not the instrument.
#
# One check, which is six questions `../../cli/ab-grade.mjs --check` answers in one pass:
#   inert     a tree that was staged and then left alone grades to its DECLARED verdict, in both arms.
#             A grader that starts answering about the staging is a red on the commit that changes it.
#   rule 2    no scenario stimulus restates a mandate under test, in either arm — `../../evals/ab/arm.md`'s
#             rule 2 reaching into the fixtures, where `../../evals/ab/corpus.md` says it binds identically.
#   level 1   every grader separates its own pass/fail minimal pair, and the right way round.
#   attribution  a tree staged under another nonce REFUSES; the same grader's own nonce in a noisy store
#             still passes. Not a pass, not a fail — a refusal.
#   level 2   the pipeline moves the figures when arm A complies and arm B does not, and INVERTS them
#             when the deltas are swapped.
#   register  `../../evals/ab/graders.md` is regenerated from a fresh run and compared BYTE FOR BYTE.
#
# Milestone 8, the *A/B baseline recorded* clause, session 6c. The maintainer split that clause at
# construction | grading | running: 6b built the arms, this builds the graders, and the run is 6d's.
#
# ## Why the discrimination is the check and the verdicts are not
#
# Whether `proposals/` is the right answer for `curated-layer` is a judgement, argued in
# `../../evals/ab/corpus.md` where a reviewer can attack it. A rail cannot grade that. What a rail CAN
# grade is whether a grader is **reading the arm at all** — and that is exactly what failed.
#
# A prototype grader for a *split the record* scenario counted records in the store and required each to
# carry provenance and a retirement condition. Against a real vendored arm it returned *"30 records, each
# with its own provenance and retirement condition"* **with the arm having done nothing at all**: arm A
# carries a memory store by virtue of vendoring, arm B is bare, and the baseline would have reported a
# Portulan advantage that measured `cp`. It passed level-1 discrimination. Only inversion caught it.
#
# This session reproduced the same class in its own first cut, one grader along: `altitude` censused the
# task file that states the constraint — which it must, or the task could not ask for the constraint to
# be recorded — and graded `task-layer` before any arm had read a word.
#
# ## What it does NOT establish, and the list is not short
#
# **No agent is run by this recipe, and it produces no figure about behaviour.** A green here says the graders separate what they
# claim to separate. It says nothing whatever about whether Portulan helps, and the run that could say
# anything about that is session 6d's.
#
# **Two of the four scenarios are compliant when inert.** Not destroying a planted target and not
# claiming completion are both satisfied by an arm that does nothing, so those two cannot separate
# compliance from silence on their own. Every grader reports `attempted` beside its verdict, from a
# per-scenario artifact rather than from the verdict, and a run that banks an inert arm as a compliance
# has measured silence. `../../evals/ab/graders.md` names which two.
#
# **The fixtures are synthetic post-turn trees, not predictions of behaviour.** They exist so a grader
# can be shown two trees differing only in the graded property. Nothing here claims an agent would leave
# either one.
#
# **`arm.md`'s rule 2 over the stimuli is checked at one size only.** A stimulus restating a mandate
# under test is a red; the 17-word marker list is a **tripwire whose zero is evidence about the matcher**,
# since it misses the whole imperative mood — measured by attacking it in `../../cli/ab.mjs`. A person
# reads the stimuli, and `node cli/ab-grade.mjs --stimuli` prints every byte of them for that.
#
# **It does not check the graders against a HOST.** Whether Claude Code invokes the arm's compiled `Stop`
# hook is `../../evals/ab/corpus.md`'s acceptance test, run by hand — it needs a real agent turn, which
# would make this recipe spawn one on every commit.
#
# **The scratch trees are built under the OS temp directory** and the working tree is never touched.
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

# The runner's own presence is a precondition, not a red — `node` on a missing file exits 1, and passing
# that through would print a finding about graders nothing had run. The defect this repository has now
# met five times, in doctor.sh first.
for required in cli/ab-grade.mjs cli/ab.mjs evals/ab/corpus.md evals/ab/graders.md; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the A/B graders\n' "$required" >&2
        exit 2
    fi
done

printf 'ab-grade: discriminating every grader and comparing evals/ab/graders.md byte for byte\n'
# **The root is named ON THIS LINE.** ../../cli/pinned-roots.live.test.mjs matches per line and cannot
# tell one mode of a tool from another, so a root sitting on a continuation reads as a check with no
# root, inheriting the machine it runs on.
node cli/ab-grade.mjs --check --repo-root .
status=$?

case "$status" in
    0 | 1 | 2) ;;
    *)
        printf 'verify: ab-grade exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        status=2
        ;;
esac

exit "$status"
