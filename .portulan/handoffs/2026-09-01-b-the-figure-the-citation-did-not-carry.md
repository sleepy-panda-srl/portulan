# 2026-09-01 — the figure the citation did not carry

**Milestone 8, session 7b.** No row moves. This is doctrine work under
[`../gate-map.md`](../gate-map.md)'s *"Doctrine, tier and floor work takes a checkpoint even when no row
moves"* — the A/B clause already closed at session 6d, and **row 8's Status cell is untouched by this
change.** The defect was found under session 7's `release-eval` clause and deliberately left there,
because it belongs to the A/B clause.

## What landed

The A/B baseline's aggregate — `6/20` each arm — stood in **three live prose sentences**
(`evals/README.md` ×2, `evals/ab/arm.md` ×1) as a sum typed from a reading of the register's rows, with
nothing checking it. A re-run would have left all three stale and silent: this repository's most-named
defect class, a hand-maintained figure whose subject can move.

1. [`../../cli/ab-run.mjs`](../../cli/ab-run.mjs)'s `renderRegister()` now **derives** the aggregate from
   the same cells the rows come from, with the caveat that it is a sum of four counts of five and not a
   rate over twenty trials — and it **marks a total that folds a cell which measured silence**, because
   the contrast table already marked such a cell and the headline is the figure other documents cite.
   Five new tests; `evals/ab/baseline.md` regenerated via `--write`.
2. The three sentences now **cite** the register instead of restating it.
3. The rule is registered as `ab-baseline-figures` in [`../rule-carriers.json`](../rule-carriers.json).

## The precondition nobody had noticed: the carrier did not carry the figure

`evals/ab/baseline.md` contained **no `6/20`**. It rendered per-cell counts only — `5`/5, `0`/5, `0`/5,
`1`/5 — and the aggregate existed nowhere but in the prose that was about to be swept. **A citation is
only a reduction if the cited document carries the number**; otherwise "see the register" sends a reader
to sum four rows by hand, and the first reader who types that sum back into prose recreates the defect.
So the renderer had to change before the sweep could mean anything. That is why this session touched
`ab-run.mjs` at all, and it is the half of the work the brief did not anticipate.

The figure is now **derived and byte-compared**, so it cannot go stale at all. That — not the new
registry entry — is the defence that matters: [`../../core/operating/evolution.md`](../../core/operating/evolution.md)
ranks removing what would otherwise need enforcing above enforcing it. The registration is the second line.

## The brief's stated constraint was false, and it was measured false rather than argued false

The task carried a constraint: *registering before the sweep would red on merged, reviewed prose.* **It
would not.** `cites` is a per-**file** substring test, and both live carriers already cited
`baseline.md` for unrelated reasons — `evals/README.md:44`, and `evals/ab/arm.md:150` **in the same
sentence as the restatement**. Building the rule and running `scan()` against the pre-sweep tree returned
`findings: []`; a control with an unmatchable `cites` returned both findings, proving the machinery
fired. The rail would have printed **green** over exactly the prose this session existed to remove.

The order (sweep, then register) was still right — but for a different reason than the one given, and the
false reason is recorded here because it was one edit from becoming the registry's own comment.

**The consequence is a real limit, and it is written into the entry rather than smoothed over:** this
rail **cannot catch a regression in the two files just swept**, because both still legitimately cite the
register. What it can catch is a *new* in-scope carrier that restates without citing — concretely
`evals/ab/graders.md`, which is in scope and cites nothing. That is where the forced red was planted.

## What it does not cover, stated because a rail that overclaims is worse than none

- **It is keyed to numerals.** The tells carry the literals `6/20` and `9/20`, so a future *new* aggregate
  — `arm A 7/20` hand-typed into uncited live prose — matches nothing here. **That blind spot contains
  this sweep's own replacement sentences**, which the pre-commit checkpoint caught and which is the
  honest half of the change: `evals/README.md` and `evals/ab/arm.md` still assert the *result* in words
  (*the headline is a tie*, *an arm-A lead*) — the same derived claim spelled without numerals. They are
  now **bound to the 2026-08-31 capture date**, so a re-run makes them historical rather than false. That
  dating, not this rail, is what holds them.
- **Three restatements sit permanently outside this rail, not one.** `docs/plan.md` row 8's Status cell
  carries `a tie, 6/20 each` in the most prominent place in the tree, and `docs/milestones/m08.md`
  carries the aggregate **twice more** in live declarative prose (lines 774 and 784). All are
  unreachable because `docs/plan.md` and `docs/milestones/` are globally excluded. **That is not
  design.** Whether those paths belong on the exclude list is unsettled and filed as #367, which the
  registry's own top comment already flags.
- It does not touch proposal 0020's class. One rule is registered; every unregistered rule stays uncovered.

## Verification

**25 recipes green** (`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs`).
`rule-carriers` **forced red** by planting the swept sentence in `evals/ab/graders.md` — it named the
file, the rule, the tell and the carrier, exit 1 — then restored to green. `ab-run` green, so the
regenerated register still byte-matches its renderer. `ab-run` suite 61/61.

Two traps worth the next session's time: **`timeout` is not on macOS**, and a run harness using it
reported all 25 recipes red at exit 127 — a false red that a less noisy exit code would have hidden.
And **`pack-identity` compares the working tree against the git INDEX**, so it reds on unstaged edits
and says nothing is wrong once they are staged.

## Provenance, and one thing a reader cannot open

The reporting handoff `2026-09-01-a-release-carries-an-eval-result.md` **does not resolve in this tree.**
It lives on the unmerged branch `m8-s7-a-release-carries-an-eval-result` (f9009d60), which is not an
ancestor of `main` (e192f6b5 at the time of writing). The registry entry says so rather than pointing at
a path a reader cannot open. **That branch also adds a 26th recipe (`release-eval`), edits
`docs/plan.md` and `docs/milestones/m08.md`, and — the part that matters — **edits `evals/README.md`
too, where its copy still carries both pre-sweep sentences.** So whichever of the two merges second can
**reinstate exactly the prose this session removed**, and by the rail's own file-level-citation limit it
will print **green** over that. Resolve that merge by hand against the registry entry; no rail will do
it. This change's "25 recipes" is a count taken on `main`, not after s7.

No issue number is cited anywhere in this change: `gh` could not be reached from this worktree, and an
invented number is worse than a named absence.
