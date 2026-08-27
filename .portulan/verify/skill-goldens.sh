#!/usr/bin/env bash
# Portulan workspace — verify recipe: every core skill's mandates are accounted for, and every one
# bound to a live artifact still holds.
#
# One check:
#   skill-goldens  ../../evals/goldens/skills/ is graded against the skills in ../../core/skills/ and
#                  against the live artifacts this workspace's declared slots hold.
#
# Milestone 8, the row's **original first subject** — *golden tasks per core skill*. Clause (a) built
# the gates half and said golden tasks reach the gates *"as well as the skills"*; this is the half that
# sentence always named. The argument is in ../../docs/milestones/m08.md; the mechanism is in
# ../../cli/skill-goldens.mjs.
#
# ## What it rails that nothing else does
#
# A core skill states mandates in prose, and until this recipe **nothing in the tree connected one to
# the artifacts it governs.** Two consequences, both now closed: a skill's wording could be reworded or
# a step deleted with no rail noticing, and a mandate could be stated with no carrier anywhere and look
# exactly like one that is enforced.
#
# The denominator is **derived** — the numbered steps under each skill's `## The pass` — so a fifteenth
# step is a red rather than a default. That is the difference between this and a corpus whose author
# picks which mandates to answer for.
#
# ## What it does NOT establish, printed on every run rather than left to a green
#
# **Adequacy.** A mandate can be bound and the binding trivial — clause (a)'s presence floor, restated.
#
# **Anything about the per-case `carrier` field.** The PREDICATES are pinned by import — the runner
# takes `RETIRE_WHEN` from ../../cli/doctor.mjs rather than re-spelling it — but `carrier` itself is
# **declared, reviewed metadata** and nothing links it to a check: a corpus naming a module that does
# not exist grades green, which the pre-commit checkpoint demonstrated rather than inferred. Closing
# that needs a per-mandate drill, which is ./drills.sh's shape one grain finer, and is not built here.
#
# **An agent's judgement.** Ten of fifteen mandates are adjudicated unbindable, most of them because
# they are about a decision no artifact witnesses. That ratio is printed as a **finding** — it measures
# how much of a core skill is artifact discipline and how much is judgement — and the judgement half is
# the A/B clause's subject, not this one's.
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

# The runner's own presence is a precondition, not a red — the defect this repository has met in
# doctor.sh, compile.sh, goldens.sh and review-loop.sh, each time the same way.
for required in cli/skill-goldens.mjs cli/doctor.mjs core/skills .portulan/workspace.json; do
    if [ ! -e "$required" ]; then
        printf 'verify: %s is missing — cannot grade the core-skill corpus\n' "$required" >&2
        exit 2
    fi
done

# An ABSENT corpus directory is could-not-run; an INCOMPLETE one is a red, and the runner draws that
# line itself from the derived skill set. The same split ./goldens.sh makes for the gate corpus.
if [ ! -d evals/goldens/skills ]; then
    printf 'verify: evals/goldens/skills/ is missing — the corpus is what this recipe grades\n' >&2
    exit 2
fi

printf 'skill-goldens: grading evals/goldens/skills/ against core/skills/ and the live artifacts the declared slots hold\n'

node cli/skill-goldens.mjs --repo-root . --workspace .portulan
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # 2 is "could not judge", passed through rather than translated.
    2) exit 2 ;;
    *)
        printf 'verify: skill-goldens exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
