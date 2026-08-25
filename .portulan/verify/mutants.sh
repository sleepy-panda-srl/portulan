#!/usr/bin/env bash
# Portulan workspace — verify recipe: the gate corpus can tell a working matcher from a broken one.
#
# One check:
#   mutants   ../../cli/compile.mjs's matcher region is broken on purpose, one declared operator at a
#             time, and each mutant is graded against ../../evals/goldens/gates/ — the corpus that
#             claims to cover those matchers.
#
# Milestone 8, clause (b), first half: *mutation testing over both matchers.* The argument for the
# clause is in ../../docs/milestones/m08.md and the mechanism is in ../../cli/mutants.mjs; what belongs
# here is why the recipe exists at all.
#
# **It stands in a gap the sibling recipe states out loud.** ./goldens.sh prints on every green that
# it is a PRESENCE floor — one trivial fixture per rule satisfies it while proving nothing
# adversarial, and no check there can tell the difference. This one can: it does not ask whether a
# fixture exists, it breaks the matcher and asks whether the corpus NOTICES. A corpus that cannot
# tell a working matcher from a broken one is a corpus whose green means nothing, and until this
# recipe existed nothing in this repository could tell those two apart.
#
# It went red on its first run and found that the corpus — 224 adversarial cases at the time — failed
# to notice eleven separate breakages of the matchers it covers. Every one of them is now a fixture.
#
# **What this recipe CANNOT establish**, said here rather than left to be assumed from a green: that
# the corpus's attacks are REALISTIC. Mutation adequacy measures whether the kill-set discriminates,
# not whether it resembles anything an adversary would type. Judging that is a reviewer's job, and
# ../../cli/mutants.mjs prints the limit on every green rather than letting the exit code imply more.
#
# The judgement lives in ../../cli/mutants.mjs, which the test suite covers; this wrapper does the
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

# The runner's own presence is a precondition, not a red — the defect a reviewer found in doctor.sh
# and this repository has now met five times.
for required in cli/mutants.mjs cli/goldens.mjs cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot run the mutation census\n' "$required" >&2
        exit 2
    fi
done

if [ ! -d evals/goldens/gates ]; then
    printf 'verify: evals/goldens/gates/ is missing — the fixture corpus is this census kill-set\n' >&2
    exit 2
fi

printf 'mutants: breaking the matcher region of cli/compile.mjs on purpose, and asking whether the gate corpus notices\n'

# ---------------------------------------------------------------------------------------------
# **The resolution root is PINNED, for the reason ./compile.sh states at length.** A required check
# answers *does this tree hold its own claims*, so its answer may not move with what happens to be
# installed on the machine running it. Naming the root replaces every other source.
#
# The runner refuses host discovery internally as well — it reaches the policy through
# ../../cli/goldens.mjs, which passes `discovery: null` whatever the command line says — so this pin
# is the second of two carriers rather than the only one.
# ---------------------------------------------------------------------------------------------
node cli/mutants.mjs --workspace . --pack-root packs --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # 2 is "could not judge", passed through rather than translated.
    2) exit 2 ;;
    *)
        printf 'verify: mutants exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
