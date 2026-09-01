#!/usr/bin/env bash
# Portulan workspace — verify recipe: the published A/B baseline still says what its own capture says.
#
# One check, which is several questions `../../cli/ab-run.mjs --verify` answers in one pass, **and it
# runs no agent**:
#   capture     `../../evals/ab/baseline.json` declares itself a baseline capture.
#   shape       every field the register renders as a BRANCH rather than as a value is checked by name,
#               because a branch leaves no hole for the derived probe to find — absence would publish a
#               claim the capture never made, in a document with nothing visibly wrong with it. And the
#               turn rows must agree with each other on which fields they carry. **What this still does
#               NOT see is four named items, not a number**, and they are written in `verifyShape()`'s
#               own docblock in `../../cli/ab-run.mjs` — three of the branch-read fields are permitted to
#               be ABSENT, because the 2026-08-31 capture predates them and cannot be re-captured.
#   isolated    it records `operatorEnv: "isolated"`. A baseline over an unisolated arm is refused here
#               as well as at the turn, because a record is the thing a later reader trusts.
#   invocation  the recorded invocation carries no flag that would dissolve arm A's compiled
#               enforcement — which is the treatment under test.
#   total       the matrix is total over `k`: every (scenario, arm, run) present exactly once, and no
#               id spawned twice.
#   nonces      every turn's nonce is the one the recorded seed derives. A nonce that is not the
#               harness's cannot attribute anything.
#   arithmetic  the published cells are a fresh fold of the per-turn rows.
#   register    `../../evals/ab/baseline.md` is regenerated from the snapshot and compared BYTE FOR
#               BYTE, through the same renderer that wrote it, and carries its limitation block.
#
# Milestone 8, the *A/B baseline recorded* clause, session 6d. The arms are `../../evals/ab/arm.md`,
# the scenarios and grading rules `../../evals/ab/corpus.md`, the graders' own discrimination
# `../../evals/ab/graders.md`.
#
# ## Why this one is a snapshot plus a register, when every other register here is byte-compared alone
#
# Every other generated document in this repository is derived from the **tree**, so it can be
# re-derived on any commit and held to the world. A baseline is derived from **events** — agent turns,
# which do not repeat — and a rail that demanded forty fresh turns per commit is a rail nobody runs.
#
# The house already answered this for review-loop metering: the events land in a committed
# machine-readable snapshot, and the register is held to **that**. `./review-loop.sh` states the reason
# and it is the same one here — *"a published figure that can drift from its own data is the
# hand-maintained tally in a new costume"*. So the unreproducible half is the snapshot alone, the
# register cannot drift from it, and the register says both of those things on its own face.
#
# ## What a green here does NOT establish, and the list is not short
#
# **It says nothing about whether Portulan helps.** It says the published document agrees with the
# capture beside it. The figures themselves are `k = 5` per cell and support a recorded rate and
# nothing else — no significance, no interval, and no claim that a difference between two cells is a
# difference between the arms. `../../evals/ab/corpus.md`'s *What may not be concluded* is the carrier
# and the rendered register cites it rather than restating it.
#
# **It does not re-run the experiment**, and it cannot: this recipe spawns no agent, holds no
# credential, and would be a very different thing if it did.
#
# **A compliant cell whose `attempted` is zero measured silence**, not compliance — two of the four
# scenarios are compliant when an arm does nothing at all. The register renders that as such; this
# recipe checks the arithmetic, not the reading.
#
# **It cannot see whether the arms were the ruled arms.** It reads what the snapshot records about
# isolation and the invocation; that those records are true of the run is the runner's refusals, one
# layer earlier, and the maintainer's ruling before that.
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
# that through would print a finding about a baseline nothing had recorded. The defect this repository
# has now met five times, in doctor.sh first.
for required in cli/ab-run.mjs cli/ab-grade.mjs cli/ab.mjs evals/ab/corpus.md; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the A/B baseline\n' "$required" >&2
        exit 2
    fi
done

printf 'ab-run: checking evals/ab/baseline.md against evals/ab/baseline.json — no agent is run\n'
# **The root is named ON THIS LINE.** ../../cli/pinned-roots.live.test.mjs matches per line and cannot
# tell one mode of a tool from another, so a root on a continuation reads as a check with no root.
node cli/ab-run.mjs --verify --repo-root .
status=$?

case "$status" in
    0 | 1 | 2) ;;
    *)
        printf 'verify: ab-run exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        status=2
        ;;
esac

exit "$status"
