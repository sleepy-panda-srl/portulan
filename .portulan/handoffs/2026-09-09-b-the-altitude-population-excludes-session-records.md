# Handoff — 2026-09-09 (b): the altitude population excludes session records

**What landed.** One of milestone 8's three named-undemonstrated items is closed: `gradeAltitude` no
longer counts a session record as promotion. The evidence narrative is the new *Residue — 2026-09-09*
section of [`../../docs/milestones/m08.md`](../../docs/milestones/m08.md); this records the why the diff
does not carry.

**The authority question was the whole risk, and I got it wrong first.** Three carriers reserved the
predicate to the maintainer because *moving a target after seeing figures is selection*. His instruction
was *"Address the two open items"* — and my session plan wrote that this **was** his ruling on the
predicate. The session-open checkpoint corrected it: the instruction lifts the hold and chooses nothing.
The distinction matters because it decides who owns the shape if it turns out wrong. So the predicate is
proposed, graded fresh-context, and ruled by his merge — and the PR body says so explicitly, with the
two rejected alternatives named, so merging is a choice rather than a default.

**Why the exclusion is named for record slots and not for the mandate.** My first rationale was *"the
mandate compels the write, so it is the same case as a planted path"*. The checkpoint showed that is
false in a way that would have done damage: planted paths have harness-fixed *content*, while condition 8
fixes only the handoff's *existence*; and worse, *"mandated therefore excluded"* as a principle would
exclude `.portulan/memory/` the day a condition mandates a memory entry — hiding exactly the promotion
the scenario exists to catch. The rule that survives is about **layers**: a session record is not one.
The mandate is the incident that surfaced the class, and the code now says that in those words.

**The rail could not have caught this, and finding that out was the checkpoint's best catch.** My plan's
forced red was "break the exclusion and watch `ab-grade` fail" — and it would not have failed:
`DELTAS.altitude.compliant` wrote only a task file, so `discriminate()` produced no handoff anywhere and
removing the exclusion left the recipe green. A discrimination fixture that cannot fail when the thing it
grades is broken is not a rail. The compliant delta is now what a compliant arm-A tree actually is under
the treatment — task file **and** dated handoff — and removing the exclusion now drives the recipe to
exit 1. I verified that by doing it.

**The trap I nearly walked into after the forced red.** Restoring with `git checkout -- cli/ab-grade.mjs`
reverted the whole repair, not just the perturbation, because the repair was uncommitted. Caught by
grepping for `isSessionRecord` and finding zero. Force reds on uncommitted work need a copy, not a
checkout — the working tree is not a baseline you can return to.

**The pre-commit checkpoint returned A-W-A (6 binding, 5 optional), all folded, and found no defect in
the mechanism — every finding was a claim the prose made that the code did not support.** Two are the
same class and it is the one worth carrying: **a docblock asserting a pin that did not exist.** One said
`isSessionRecord` was exported "so a test and `ab-run.mjs` can name the same set" — no test imported it,
and `ab-run.mjs` must *not* use it, since its classifiers are frozen at the capture-era predicate on
purpose. The other said precedence was "pinned in both the tasks+memory and tasks+memory+handoff shapes"
— but changing the compliant delta had put a handoff into *every* `delta: "compliant"` fixture, so the
bare tasks+memory case was pinned by nothing at the moment the sentence claimed it was. Both pins exist
now. A claim that a rail exists is exactly as checkable as the rail, and neither of these had been
checked. It also caught my own forced-red measurement reported short — five findings across four checks,
where I had written three.

**What I deliberately did not do.** No re-run of the A/B matrix: repairing an instrument is not
re-running an experiment, and saying the numbers *would* change is a prediction. `baseline.json` is not
rewritten — it records what was measured under the predicate then in force. The register's bytes do move,
for prose only, because its bullet described the grader in the present tense and that sentence goes false
on merge; the two capture-era classifiers are frozen and labelled, since tracking the repaired grader
would stop the bullet firing on the very capture it exists to warn about, undoing this morning's repair.

**The re-classification is disclosed rather than discovered.** Arm A 3/5, arm B 0/5 under the repaired
predicate, computed from the capture's own recorded evidence and stated in `corpus.md` beside the date,
with the policy: an instrument defect is repaired whichever arm it favours, before the next measurement
rather than after seeing one. This repair happens to favour the treatment arm. That is precisely why it
is disclosed in that shape rather than mentioned in passing.

**The second item is still open and it is his.** `acceptedUnder.reRunWhen` reads NOT DISCHARGED.
Measured here, not assumed: all three credential variables unset, no `apiKeyHelper`, so the isolated stop
probe refuses at exit 2 as it did at the close. One command discharges it:

```
export CLAUDE_CODE_OAUTH_TOKEN=…          # or `claude setup-token` once
node cli/ab.mjs --stop-probe --into <tmp> --seed <recorded> --operator-env isolated
```

A rail to block the `0.1.3` cut on it was proposed and **refused** at the session-open as scope creep —
the obligation sits on the corpus's scenario admission, not on the baseline a release ships against, so
the gate would block on a non-dependency; and converting a scheduling pointer into a precondition is a
tightening only he may make. It is also not re-pointed again: it moved once already today, and a third
move in one day is motion rather than progress.

**Seam scan.** Clean across the changed files, the commit message and the branch name. Nothing here
touches private context.

**Still owed on this row.** The `0.1.3` cut carrying `evals/releases/0.1.3.{json,md}` and a second close
pass reading the tagged tree; the hook receipt above; and `0034`'s drafting, commissioned by the close
and still not performed.
