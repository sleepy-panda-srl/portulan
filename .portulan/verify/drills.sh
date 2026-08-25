#!/usr/bin/env bash
# Portulan workspace — verify recipe: every rail this workspace yields has a drill, and every drill
# still places.
#
# One check:
#   drills   ../../cli/drills.mjs --check — the CORRESPONDENCE between the rails this workspace yields
#            and the forced-red drills declared for them: every yielded rail has one, every drill names
#            a declared rail, and every drill's anchor still places exactly once in the file it names
#
# Milestone 8, clause (d): *scheduled forced-red drills — every rail forced red on a calendar and
# required to fire.* The argument for the clause is in ../../docs/milestones/m08.md, the calendar is
# ../../.github/workflows/drills.yml, and the mechanism is in ../../cli/drills.mjs; what belongs here is
# why this recipe runs the `--check` half and not the sweep.
#
# ## The sweep is deliberately NOT what this recipe runs
#
# A drill runs its rail in a throwaway `git worktree`, and a worktree is a **commit**. ../dod.md
# condition 1 asks that every recipe ran green *in this working copy* — so a recipe that reported on
# `HEAD` would be a green about a different tree, which is the class ../gate-map.md records as *the gate
# allows in silence when it reads the wrong tree*. The sweep therefore prints the sha it drilled and
# refuses a dirty tree outright, and it belongs to the calendar and to `--working-copy` by hand.
#
# What is left for a pull request is the half that can silently drift on any commit and that no rail
# above could see: **a drill whose anchor has moved**. The commit that moves an anchored line is the
# commit that learns it, instead of the next scheduled run finding out — and finding out there is
# exactly the shape both hand-run sessions met, where a substitution missed by four spaces of
# indentation and the drill reported on nothing.
#
# ## What this recipe CANNOT establish, said here rather than left to be assumed from a green
#
# That any rail still **fires**. `--check` runs no rail at all. It is the presence-and-placement floor
# in the same sense ./goldens.sh is a presence floor for the gate corpus, and the same limit is printed
# on every green by the runner rather than left to the exit code to imply. Whether each rail fires is
# the sweep's answer, and the sweep's home is the calendar.
#
# ## The resolution root is PINNED, for the reason ./compile.sh and ./goldens.sh state at length
#
# A required check answers *does this tree hold its own claims*, so its answer may not move with what
# happens to be installed on the machine running it. `--pack-root packs` names the root, which replaces
# every other source; the runner also refuses host discovery internally, so the pin is the second of two
# carriers rather than the only one.
#
# Exit 0 green · 1 a rail has no drill, or a drill names no rail · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
#
# **`mktemp`, `tr`, `cut` and `rm` joined this list when the loadability probe below did, and they were
# missing from it for one commit.** The probe needs `mktemp` for its scratch file and `tr`/`cut` to make
# the failure readable, and without them here the recipe would die with `command not found` instead of
# translating that into the exit 2 it documents — a could-not-run wearing no diagnosis, which is the one
# thing this whole file is arranged against. `./tests.sh` states the rule this violated: *a recipe that
# lists what it runs and then runs something else is the drift this loop exists to stop.* Raised as a
# suppressed note by Copilot on #343, in the round the maintainer granted.
for need in cut dirname mktemp node rm tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The runner's own presence is a precondition, not a red — the arm ./goldens.sh states, and the defect
# this repository has now met four times: `node cli/drills.mjs` on a missing file exits 1, and passing
# that through would print "a rail has no drill" about a roster nothing had read.
for required in cli/drills.mjs cli/recipe-set.mjs .portulan/workspace.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the drill roster\n' "$required" >&2
        exit 2
    fi
done

# **And the runner's IMPORTS are a precondition too, checked by loading rather than by listing them.**
# `cli/drills.mjs` imports `goldens.mjs`, which reaches `compile.mjs`, `discover.mjs` and `inside.mjs`;
# with any of those missing, node exits 1 before `--check` runs and the passthrough below would call that
# a red finding about a roster nothing read. A hand-written dependency roster here would be one more
# carrier that goes stale the next time an import moves — the defect this whole directory keeps deleting —
# so the module is *loaded* instead, which cannot be wrong about its own import graph. Raised as a
# suppressed note by Copilot, round 1 on #343.
# **The path arrives in the ENVIRONMENT, not as an argument, and that is a finding rather than a
# preference.** The first cut passed it as `node -e '…' "$root/cli/drills.mjs"`, which sets
# `process.argv[1]` to the module — so the module's entry guard fired and the *loadability check ran the
# whole sweep*, which then refused a dirty working tree and reported that as "could not be loaded". A
# check written alongside a change inheriting that change's blind spot, in the check added to stop a
# could-not-run being read as a red. With the path in the environment `argv[1]` is unset, `isMain()` is
# false by construction, and importing is only importing.
probe=$(mktemp) || exit 2
if ! PORTULAN_DRILLS_MODULE="$root/cli/drills.mjs" \
    node --input-type=module -e 'await import(process.env.PORTULAN_DRILLS_MODULE);' 2>"$probe"; then
    printf 'verify: cli/drills.mjs could not be loaded — %s\n' "$(tr '\n' ' ' <"$probe" | cut -c1-300)" >&2
    rm -f -- "$probe"
    exit 2
fi
rm -f -- "$probe"

printf 'drills: checking that every rail this workspace yields has a forced-red drill, and that every drill still places\n'

node cli/drills.mjs --check --repo-root . --workspace .portulan --pack-root packs
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
        printf 'verify: drills exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
