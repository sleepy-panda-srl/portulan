#!/usr/bin/env bash
# Portulan workspace — verify recipe: the A/B treatment arm carries what it was ruled to carry, and
# nothing else.
#
# One check, which is three questions `../../cli/ab.mjs --check` answers in one pass:
#   total     every path under `.portulan/` is classified by exactly one disposition, and every
#             disposition matches something. **An unclassified path is exit 1** — the check ran and found
#             a file that would ride into the treatment arm, which is the finding this rail exists to
#             produce. **A stale disposition is exit 2**, because a defect in the declaration is not a
#             verdict about the arm. This comment said 2 for both until the pre-commit checkpoint read it
#             against the code: it was the one carrier stating the collapsed thing.
#   rule 2    `../../evals/ab/arm.md`'s rule 2 — *no move authors a normative sentence* — separates its
#             own adversarial corpus, including the cases it is required to MISS.
#   register  `../../evals/ab/register.md` is regenerated from a fresh construction of both arms and
#             compared BYTE FOR BYTE.
#
# Milestone 8, the *A/B baseline recorded* clause, session 6b. The argument is in
# ../../docs/milestones/m08.md, the denotation in ../../evals/ab/arm.md and the corpus in
# ../../evals/ab/corpus.md; what belongs here is why the recipe exists at all.
#
# ## Why totality is the check and the contents are not
#
# `../../evals/ab/arm.md` enumerates the construction moves and argues each one. That argument is a
# judgement and a rail cannot grade it. What a rail CAN grade is whether the enumeration is **total** —
# and totality is exactly what failed. Built to that file's six rows and vendored, the treatment arm
# carried customer zero's `memory-index.md` (30 rule titles over an empty store), `handoffs-index.md`
# (146), `rule-carriers.json` (five entries naming the A/B clause) and `labels.json`, with `doctor`
# GREEN over all of it.
#
# The cause is structural rather than careless: `../../cli/vendor.mjs` carries **every ordinary file**
# under a workspace directory, so a specification that names what to remove leaks whatever it forgot.
# This recipe makes the next forgotten file a red on the commit that adds it, instead of a passenger in
# an experiment nobody re-reads.
#
# ## What it does NOT establish, and the list is not short
#
# **It grades no arm's behaviour.** No agent is run here, no scenario is graded and no baseline figure
# exists. The graders and their level-1, attribution and level-2 discrimination fixtures are session
# 6c's; the run is 6d's. A green here says the instrument builds the arm it was ruled to build — it says
# nothing whatever about whether Portulan helps.
#
# **`arm.md`'s rule 2 is checked in part, and the part is smaller than a first draft of this comment
# claimed.** The `deletion` and `emptying` kinds add no sentence, so nothing can be authored and they are
# covered in full. The `substitution` kind is checked against a **17-word marker list**, and it misses
# **every mandate not spelled with one of those words** — a class, not a case. Attacked with fifteen
# sentences a reasonable implementer would write, thirteen got past, including the whole imperative mood
# and *"Done is demonstrated, not asserted"*. Six of the corpus's cases are misses the suite requires to
# STAY missed, because a corpus in which everything is caught measures the corpus. What this rail
# establishes is that the careless spelling is caught; it does not establish that a replacement authored
# nothing, and a person still reads the added sentences.
#
# **It does not check the arm against a HOST.** Whether Claude Code actually invokes the arm's compiled
# `Stop` hook is `../../evals/ab/corpus.md`'s acceptance test, and it cannot live in a verify recipe: it
# needs a real agent turn, which would make this recipe spawn one on every commit. It is run by hand —
# `node cli/ab.mjs --stop-probe --into <arm>` — and its result recorded in the session that ran it.
#
# **`--construct` builds under the OS temp directory** and the working tree is never touched. The
# builder refuses to write outside it without an explicit `--into`.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape. `git`
# is here because the builder makes each arm a git repository: every adopter's tree is one, and a
# grader reading what an arm left behind needs a diff to read.
for need in dirname git node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The runner's own presence is a precondition, not a red — `node` on a missing file exits 1, and passing
# that through would print a finding about an arm nothing had built. The defect this repository has now
# met five times, in doctor.sh first.
for required in cli/ab.mjs evals/ab/arm.md evals/ab/corpus.md evals/ab/register.md .portulan/workspace.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the A/B arm construction\n' "$required" >&2
        exit 2
    fi
done

printf 'ab: constructing both arms and comparing evals/ab/register.md byte for byte\n'
# **Both roots are named ON THIS LINE.** ../../cli/pinned-roots.live.test.mjs matches per line and
# cannot tell one mode of a tool from another, so a root sitting on a continuation reads as a check with
# no root, inheriting the machine it runs on.
node cli/ab.mjs --check --workspace .portulan --repo-root .
status=$?

case "$status" in
    0 | 1 | 2) ;;
    *)
        printf 'verify: ab exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        status=2
        ;;
esac

exit "$status"
