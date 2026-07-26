# Task — a harness for the verify recipes

**Status.** Open, unscheduled, and deliberately not absorbed into milestone 3, session 0. Written as a
task rather than left in a handoff because it has now been handed forward twice, and a carried item that
lives only in prose is one nobody is accountable for. _(`CODEOWNERS` took four handoffs to land, which is
the local evidence for that claim.)_

**Goal.** The five verify recipes are the machinery every "done" in this repository rests on, and nothing
tests them. `doctor` and `plugin-lint` each have a suite; the shell that invokes them has none.

**Why, with the count.** Every defect below was a **fail-open in scaffolding rather than in a check** —
the guard was never where the check was. All were found by review or by accident, none by a test:

1. `docs.sh` reported GREEN when `git ls-files` failed — empty list, zero iterations, confident pass.
2. `json.sh` inherited the same shape from it.
3. The transitional CI job would have reported a skipped required check as satisfied.
4. `doctor.sh` passed a missing validator through as exit `1` — a red verdict about workspaces nothing
   had looked at.
5. `tests.sh` piped `find` into `wc -l` without checking `find`; a partial failure yields a
   plausible-but-short count, so the suite runs a subset and reports on the whole.
6. `doctor.sh` named its workspaces but did not audit that the list matched the tree.
7. A diagnostic in `doctor.sh` word-split and glob-expanded the very name it existed to print.
8. `docs.sh`'s `map` check could not see a top-level **symlink** at all — `awk -F/ 'NF > 1'` yields only
   directories that contain tracked files, and git tracks a symlink as one path with no `/`. It had
   silently stopped covering the tree the day the tree gained one (milestone 3, session 1). The shape
   worth noting for the harness: this was not a check that failed, it was a check whose *input set* was
   short, which is the same defect as 1, 2 and 5 and the fourth time it has appeared here.

**Acceptance criteria.**
- [ ] When a recipe's precondition fails — no `git`, no `node`, a missing validator, an empty
      enumeration — the harness shall assert the recipe exits `2` and not `0` or `1`.
- [ ] When a recipe's underlying check fails, the harness shall assert it exits `1`.
- [ ] When every recipe is enumerated, the harness shall assert that the set it tests equals the set
      [`../workspace.json`](../workspace.json) declares — so a recipe added without a test is loud.
- [ ] When the harness itself cannot enumerate, it shall exit `2`. _The rule it exists to enforce
      applies first to itself._

**The known difficulty, stated so it is not rediscovered.** `tests.sh` cannot be run from inside the
suite `tests.sh` runs. The harness is therefore either a sixth recipe that runs the other five in a
sandbox with faked preconditions, or a test module that invokes each recipe as a subprocess with a
doctored `PATH` and a scratch tree. Neither is free, and choosing badly under time pressure at a
milestone close is how this gets done twice.

**Lane.** full — it changes the verify machinery, which [`../gate-map.md`](../gate-map.md) places in the
full lane on its own.

**Context.** [`../handoffs/2026-07-25-doctor-and-the-demo-workspace.md`](../handoffs/2026-07-25-doctor-and-the-demo-workspace.md),
open question 1 · [`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md)
— the rule these defects keep evading · [`../verify/README.md`](../verify/README.md).
