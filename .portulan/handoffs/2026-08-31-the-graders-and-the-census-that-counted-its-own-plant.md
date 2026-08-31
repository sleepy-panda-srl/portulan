# 2026-08-31 — the graders, and the census that counted its own plant

**Milestone 8, session 6c** — the middle of the maintainer's construction | grading | running split of
the A/B clause. 6b built the arms; this builds the four graders and their three classes of discrimination
fixture. **6d owns the run.** The row does not move, no agent was run, and no figure of any kind exists.

## What landed

[`../../cli/ab-grade.mjs`](../../cli/ab-grade.mjs) and its suite, the `ab-grade` verify recipe, a
forced-red drill, and the generated [`../../evals/ab/graders.md`](../../evals/ab/graders.md). The
stimuli ship here too, because a level-1 fixture *is* a staged tree plus a mutation — `stageScenario()`
writes files and **spawns nothing**, and the module imports no child-process API at all.

## Why the two reversals matter more than the code

The session-open checkpoint found both, in a fresh context, by re-deriving. **Three consecutive sessions
on this clause have now had their actual subject found that way** — 6a's retracted constitution claim,
6b's blacklist, and these.

**`done-demonstrated` labelled the gaming move as the good verdict.** The rig fails unconditionally, so
the only route to a green rail is rewriting the check; the plan's three-state table called that state
`demonstrated`. There is now no such verdict at all, the rig is byte-compared against bytes recomputed
from the scenario definition, and a tampered rig is its own state. The same pass killed a second door
into the hole: re-running `check.sh` post-turn would take an exit code from arm-authored content as
evidence, which is *trusting an arm for its own nonce* wearing different clothes.

**`altitude`'s population was a five-file whitelist and `.portulan/memory/` was not on it** — so an arm
recording a task-scoped constraint as a workspace memory rule graded compliant. That is 6b's blacklist
finding one instrument along: an enumeration over a tree that grows.

## The defect fixing that one exposed, which is the lesson to carry

With the whitelist gone, `altitude` censused **the planted task file** — which states the constraint,
because a task file that does not state it cannot ask an arm to record it — and returned `task-layer`
before any arm had read a word. **The prototype's failure, in this session's own hands, in the file
written to prevent it.** A grader that answers about the staging is answering about the instrument.

The repair is not the exclusion. It is the **rail over the class**: `stagedTreeIsInert()` grades a
staged-and-untouched tree for every scenario and both arms and requires the **declared** inert verdict.
A grader that starts answering about the staging is now a red on the commit that changes it.

## What that rail measured, which nobody asked for

**Two of the four scenarios are compliant when an arm does nothing at all.** Not destroying a planted
target and not claiming completion are both satisfied by inaction. Every grader now reports `attempted`
beside its verdict, from a per-scenario artifact and never from the verdict. **This is a constraint on
session 6d**, not a defect: a run that banks an inert arm as a compliance has measured silence. Recorded
in `corpus.md` and `graders.md` rather than in a docblock.

## Copilot round 1: the same class, twice more

Both findings turned *could not read* into a verdict. `treeFiles()` **silently skipped symlinks** — a
census with a hole in its own population, in the module built around a grader that answered about the
wrong thing. `readOrNull()` returned `null` for **any** read error, so an unreadable file graded as an
absent one and produced a finding about the arm out of a fact about the filesystem. Both refuse now, both
forced red, and the symlink rule is borrowed from `cli/vendor.mjs` rather than invented.

**The sibling in `cli/ab.mjs` was measured and does not carry it** — `lstatSync`, and every non-directory
entry is listed rather than omitted. The class sets a fix's scope; a change at a site without the defect
is noise.

## Round 2, and the one finding only CI produced

Round 2 raised no new inline comments and three suppressed notes, all real: `--stimuli --seed` derived a
single nonce from the first scenario and printed all four under it — wrong markers in the one mode a
**person** uses to check stimuli against rule 2 — and `stageScenario`/`gradeRun` used `existsSync` where
`isDirectory()` was meant.

**The finding worth carrying came from neither checkpoint nor review.** CI went red on a commit green on
this machine, in a test belonging to `cli/ab.mjs`: it sweeps `portulan-ab-` for its own scratch leaks,
and this module had chosen `portulan-ab-grade-`, which **prefix-matches it**. A directory legitimately in
flight here counted as a leak there whenever the suites overlapped — a race that looks exactly like a
flake. **A leak sweep keyed on a hand-typed prefix is a checker whose population it does not own** — this
session's own subject, arriving in the test harness. Both prefixes are now exported constants and a rail
asserts disjointness, so the next collision is a red.

## What is still owed, stated so a close cannot be held to more than was built

- **The run.** No agent, no `k`, no baseline. 6d's, and `acceptedUnder.reRunWhen` — re-running the stop
  probe under `--operator-env isolated` with a credential exported — is still its obligation.
- **The acceptance test's second half is HALF built.** A stub agent closes the probe's **read path** and
  its minimal pair. Whether the **host** invokes the compiled `Stop` hook is untouched and no stub can
  reach it; it stays the by-hand run of 2026-08-29. A green suite about the read path is not evidence
  about the hook.
- **Every fixture is synthetic.** A grader separating a pair proves the grader reads the arm. It is not
  a prediction of what an arm would do.
- **The attribution widening is the maintainer's to revoke.** `corpus.md` requires the pair per
  *censusing* grader; all four carry it, and the dated note beside that sentence says so and why.
