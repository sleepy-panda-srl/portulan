#!/usr/bin/env bash
# Portulan workspace — verify recipe: every release from milestone 8 onward carries an eval result, and
# each one still says what its own capture says.
#
# One check, which is several questions `../../cli/release-eval.mjs --verify` answers in one pass, **and
# it runs no recipe**:
#   released    the versions `../../CHANGELOG.md` records are the released set; `## Unreleased` is the
#               re-seeded accumulator and is never one
#   cut         the newest release heading is the version `../../package.json` declares. A cut moves both
#               and a disagreement means one moved alone
#   present     every release from `0.1.3` onward has `../../evals/releases/<version>.json`
#   shape       each record declares itself one, carries an integer verdict per recipe, and prints the
#               reason for every excluded row
#   passed      no record shows a rail at a non-zero exit. A release may not carry an eval result that
#               records a rail it did not pass
#   register    each `../../evals/releases/<version>.md` is regenerated and compared BYTE FOR BYTE,
#               through the same renderer that wrote it
#   invented    no record exists for a version `../../CHANGELOG.md` never cut — the set is graded in both
#               directions, because a record for a release that does not exist reads as evidence
#
# Milestone 8's ninth clause, added by the maintainer's ruling of 2026-08-24: *a release carries an eval
# result*. `../../docs/plan.md`'s Protocol → Versioning is the mandate, `../../docs/milestones/m08.md`
# the legislative history, and `../../cli/release-eval.mjs` the mechanism and the argument.
#
# ## EVERY governed release, permanently — and the design this replaced graded one
#
# A rail keyed to the tree's current cut state protects the newest record and nothing else: the moment
# `0.1.4` is declared, `0.1.3`'s record can be deleted or edited and no check is looking at it. A record
# layer graded one record at a time is not a graded record layer. So the subject is the whole released
# set from `0.1.3` onward, on every commit, forever. Found by a fresh-context second opinion before the
# rail was written.
#
# ## What a green here does NOT establish, said rather than left to the exit code to imply
#
# **It says nothing about whether the release is good.** It says each release carries a record, that each
# record agrees with the capture beside it, and that no capture records a red. What any single recipe's
# green establishes is that recipe's own documentation's business.
#
# **It does not re-run the recipes.** The verdicts in a record were measured once, by
# `release-eval --capture`, at the commit the record names — not at the tag, because a record is
# committed *in* the change that cuts the release and cannot name a commit that does not exist yet. The
# record prints that rather than hiding it, the way `./ab-run.sh`'s capture prints `clean`.
#
# **It cannot see a tag or a published release body.** `../gate-map.md` keeps `tag-a-release` and
# `publish-a-release` Gated, and both happen outside any tree a check can read. The honest answer to the
# amendment's *"a rail or a person"* is therefore **both**, split by what each can reach: this recipe on
# the pull request, `release-eval --tagged` from
# `../../.github/workflows/publish-github-packages.yml` at the release act, and a person for the rest.
#
# **It cannot see whether a maintainer tagged a tree whose accumulator was never renamed.** That
# ordering is human-owned prose in `../../CHANGELOG.md`, in a file that says of its neighbouring rule
# *"nothing checks this"*. `--tagged` is what catches it, and it catches it at publish rather than here.
#
# Exits 2 — could not run, never a green — when a precondition fails, per
# ../memory/verify-preconditions-fail-closed.md.

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

# The runner's own presence is a precondition, not a red — the arm ./goldens.sh states, and the defect
# this repository has now met four times: `node cli/release-eval.mjs` on a missing file exits 1, and
# passing that through would print a finding about a release set nothing had read.
for required in cli/release-eval.mjs CHANGELOG.md package.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot grade the release records\n' "$required" >&2
        exit 2
    fi
done

printf 'release-eval: checking that every release from milestone 8 onward carries an eval result that agrees with its capture\n'

node cli/release-eval.mjs --verify --repo-root .
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
        printf 'verify: release-eval exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
