# Handoff — the tests rail has been seen to fire

**Date:** 2026-07-30 · **post-M5, no milestone row touched** · Branch
`the-tests-rail-has-been-seen-to-fire` · drill run on
[#118](https://github.com/sleepy-panda-srl/portulan/pull/118), closed unmerged

**State.** `main` at `5a707e3`, eight recipes green, seam clean. One drill, both directions, and a
survey that turned out to be the larger half of the finding.

## What was actually unproven

Four things were already established, and this session re-read all four live rather than trusting the
brief. All four held:

- `tests` is one of eight recipes in [`../workspace.json`](../workspace.json), running
  `node --test "cli/**/*.test.mjs"` via [`../verify/tests.sh`](../verify/tests.sh).
- [`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml) reads `verify.recipes`
  from the manifest, so **declaring** a recipe is what enforces it ([proposal 0004](../proposals/0004-ci-runs-every-declared-recipe.md)).
  Nothing had to be added to include `tests`; it was already included.
- Branch protection on `main`, read live: required checks `workspace-verify` and `pr-labeled`, both
  pinned to app 15368, `strict: true`, `enforce_admins: true`, `required_conversation_resolution: true`.
- A red recipe does fail the job and block the merge — #117, `docs` red on run `30530283558`.

So nothing here needed building, and the instruction not to "add machinery on a false premise" was the
right instruction: the premise was true, and the gap was **evidential**, not mechanical.

## The survey is the finding, and it is bigger than the brief said

The brief said every observed red had come from `docs`, never from `tests`. That is right and it
understates the position. Counted from the check-run annotations across the whole history of
[`verify.yml`](../../.github/workflows/verify.yml) — the only workflow that has ever run a recipe —
**`workspace-verify` has failed 5 times in 416 runs**, and **one rail of eight had ever been observed
red on a pull request.**

Worse than the count: **none of the five was a drill.** Two were the `proposal` red that
[`../verify/README.md`](../verify/README.md)'s Known limits already predicts on any branch adding a
proposal, two were a genuine link defect caught in flight on #117, and the fifth never reached a recipe
at all — `actions/checkout@v4` refused for not being SHA-pinned, so the job died before the loop. Every
red this repository has seen in CI arrived by accident.

That reframes the task. It was scoped as one rail's missing evidence; it is a **register** that was
nearly empty, and milestone 8's calendar is what fills it. The register now lives in
[`../verify/README.md`](../verify/README.md) under *The forced-red drills*, as a subsection of
Provenance rather than a new file — the same place every local forced red is already recorded, so a
drill and a red-first design sit in one place and the next drill adds a row.

## The drill

Two pushes on a throwaway branch, in both directions, because a rail that only ever reds proves nothing
about its green — a recipe hard-wired to fail produces the identical red transcript.

| Push | Tree | Run | Result |
|---|---|---|---|
| `45c931b` | `cli/drill.test.mjs`, `assert.equal(1, 2)` | `30532642890` | **failure** · `verify recipe tests exited 1` · 675 tests, 674 passing |
| `f89ed35` | that file deleted, nothing else moved | `30532774286` | **success** · `tests: 7 test file(s) found` |

`mergeStateStatus` read **`BLOCKED`** at the red head and `CLEAN` at the green one. The full transcript,
the quoted log lines and four things it settles — the block is attributable to this rail alone,
`mergeable` is the wrong field, a draft reports the real merge state, and a red recipe does not abort
the loop — are in [`../verify/README.md`](../verify/README.md). Not repeated here.

**Isolation was checked before the push, not asserted after it.** With the drill file present, seven
recipes exited `0` and `tests` exited `1`; so the red is the rail under drill and not collateral.

## What is left, and for whom

**Six rails have still never been observed red in CI:** `json`, `doctor`, `plugin`, `compile`,
`workflow-filters`, `index`. The gap is narrower than it looks in one respect — all eight run through
the same loop in the same job, and that shared seam is now covered twice by two different recipes — and
not narrower at all in another: what stays uncovered is per-recipe CI behaviour, which this repository
already knows bites in at least three ways (shallow checkout, `doctor`'s filesystem-resolved claims,
clean-checkout-versus-working-copy). Those are the drills milestone 8 owes, and the argument for each
is written into the register beside the empty cell.

**One thing deliberately not done:** no merge was attempted. `BLOCKED` is GitHub's own answer about
whether the merge is available, not a refusal provoked at the API — and provoking one is barred by
[`../gate-map.md`](../gate-map.md), because the maintainer merges. `enforce_admins: true` is what
stands behind that last inch, and no pull request can demonstrate that about itself.
