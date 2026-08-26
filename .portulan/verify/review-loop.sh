#!/usr/bin/env bash
# Portulan workspace — verify recipe: the review-loop register still says what its snapshot says.
#
# One check:
#   review-loop   ../../evals/review-loop/register.md is regenerated from
#                 ../../evals/review-loop/snapshot.json and compared BYTE FOR BYTE, through the same
#                 renderer that wrote it.
#
# Milestone 8, clause (c): *review-loop metering **in the telemetry clause** — rounds per pull
# request, pushes per round, empty-round rate.* Quoted whole, because the locative phrase is part of
# the criterion and this line had dropped it. The argument for the clause is in
# ../../docs/milestones/m08.md and the mechanism is in ../../cli/review-meter.mjs; what belongs here
# is why the recipe exists at all.
#
# **What "in the telemetry clause" was read to mean**, said out loud because this clause's *unit* was
# argued at length while its own preposition was not. It places (c)'s subject under the telemetry
# heading; it does not make (c) a deliverable OF the OTel clause. ../../evals/README.md has listed the
# two as separate bullets since milestone 8 session 0, and the row names each separately. So (c) ships
# whole here, and the still-open **OTel opt-in config** clause owes an emission path for these figures
# if he reads the phrase the other way — which is why they are written as machine-readable JSON with a
# rendered register beside them, rather than as prose an exporter could not consume.
#
# ## What it rails, and why that is not what the suite rails
#
# `../../cli/review-meter.test.mjs` proves the arithmetic is right. It cannot prove that the figures
# this repository PUBLISHES were produced by that arithmetic, because the register is a committed
# Markdown file and a committed Markdown file can be edited. A published figure that can drift from its
# own data is the hand-maintained tally in a new costume — which is the exact defect the whole clause
# exists to retire, so shipping it inside the fix would have been the joke writing itself.
#
# So this recipe holds the register the way ./index.sh holds the memory index: generated, byte-compared,
# and a hand-edit survives until the next run and no longer.
#
# ## Why it does NOT talk to GitHub, though the figures come from there
#
# A required check answers *does this tree hold its own claims*. Fetching would make the answer move
# with the network, with a token, and with whatever merged in the last hour — three ways for a rail
# to go red about the world rather than about the tree.
#
# **This paragraph used to end "and CI here installs nothing, so `gh` is not on the runner at all",
# and that is false.** Caught at the pre-commit checkpoint: `gh` ships on `ubuntu-latest`, four
# workflows here run it with no install step, and one of them is the REQUIRED `pr-labels` check. The
# ../identity.md analogy it drew does not transfer either — `claude plugin validate --strict` is kept
# out of the recipe set because INSTALLING it would make this workflow a build, and `gh` needs no
# install. The conclusion survives on the sentence above, which never rested on the false one.
#
# The cost is stated rather than hidden: **this recipe cannot tell a current snapshot from a stale
# one.** It checks that the register matches the snapshot, never that the snapshot matches the world.
# Refreshing is `node cli/review-meter.mjs --fetch`, run by a person, and nothing here fires when
# nobody runs it — the same silence https://github.com/sleepy-panda-srl/portulan/issues/344 tracks for
# the drill calendar. Filed as https://github.com/sleepy-panda-srl/portulan/issues/356.
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

# The runner's own presence is a precondition, not a red — `node` on a missing file exits 1, and
# passing that through would print a finding about a register nothing had read. The defect this
# repository has now met four times, in doctor.sh first.
for required in cli/review-meter.mjs evals/review-loop/snapshot.json evals/review-loop/register.md; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the review-loop register against its snapshot\n' "$required" >&2
        exit 2
    fi
done

printf 'review-loop: regenerating evals/review-loop/register.md from its snapshot and comparing byte for byte\n'

node cli/review-meter.mjs \
    --snapshot evals/review-loop/snapshot.json \
    --register evals/review-loop/register.md \
    --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # 2 is "could not judge", passed through rather than translated — the arm ./compile.sh was missing
    # for one checkpoint, where a genuine exit 2 fell to the catch-all and printed a sentence about the
    # tool misbehaving when it had not.
    2) exit 2 ;;
    *)
        printf 'verify: review-meter exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
