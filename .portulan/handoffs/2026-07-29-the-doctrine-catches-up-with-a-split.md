# Handoff — the doctrine catches up with a split it did not see coming

**Date:** 2026-07-29 · **post-M6-session-0, no milestone row touched** · Branch
`per-agent-memory-lands-in-row-7` · closes [#98](https://github.com/sleepy-panda-srl/portulan/issues/98)

**State.** `main` at `c6b6a25`, all eight recipes green, seam clean. **No criterion moves.** This is the
doctrine half of a ruling whose row halves were already in the tree.

## What happened, because the process failure is the finding

**Two sessions put the same question to the maintainer within the hour, neither knowing of the other.**
The milestone-6 session asked and was told to **expand row 6**; that amendment was graded by a fresh
Fable 5 context and merged in [#105](https://github.com/sleepy-panda-srl/portulan/pull/105). This
session asked and was told **milestone 7**, recorded the ruling on #98, and opened
[#109](https://github.com/sleepy-panda-srl/portulan/pull/109) against that row.

Neither session was wrong about what it had been told. **Both were wrong to believe they had the whole
answer.** When the collision surfaced it went back to him rather than being resolved by either, and he
ruled a third thing both had missed — verbatim: *"Go with the third option — row 6 declares, row 7
validates."*

**The near-miss is worth more than the fix.** This session had a rebase in progress with a conflict whose
two sides were "row 6 from `main`" and "row 7 from this branch". Resolving it either way, or by union,
would have shipped a doctrine sentence naming one row while the other carried a deliverable — and the
grep that finds that class runs at *session open*, not in any rail. It was caught because the row-6
amendment says *persona declares its memory scope* and never says *per-agent memory*, so the first
grep here came back empty and the conflict had to be read rather than resolved.

## What the split actually is, and why no criterion moved

Row 6 already demanded the **declaration** — the resolving pack's persona declares its memory scope, and
the demonstration shows that scope landing in the adopter's own layer, empty until earned. Row 7 already
owed the **validation** — `doctor` checking a persona against its five-part contract, of which the memory
scope is one. So the ruling reconciles two real arguments instead of splitting the difference, and needed
**no edit to either row**. `0016` was right that a pack is the first artifact distributing per-persona
material an adopter does not own; #109 was right that the row holding the checker is where a declaration
should start resolving to something. Both were half-answers.

## What this change is

`core/operating/memory.md` stops saying *owed at milestone 6* and states the split, with the settled
question removed rather than left reading as open. `0016`'s status note records the same. That is all —
the record of the split itself lives in
[`docs/milestones/m06.md`](../../docs/milestones/m06.md) via
[#112](https://github.com/sleepy-panda-srl/portulan/pull/112), which is the milestone-6 session's to
own and deliberately not reached into from here.

## Corrections this branch made to itself, before and after the ruling

- **The row-7 criterion amendment is gone entirely**, along with its `m07.md` section and that file's
  preamble fix. Under the ruling no criterion edit is needed, so an amendment would have been change for
  its own sake in the file whose subject is why criteria change.
- **A wrong ordinal in four carriers.** *"The persona contract's fifth part"* — `core/personas/README.md`
  lists memory scope **fourth**. Found by the pre-commit checkpoint; the ordinal is gone rather than
  corrected, because three carriers disagreed about it and nothing needed it. Checked against `main`:
  the merged milestone-6 text carries no ordinal, so nothing there needs the same repair.
- **Two claims resting on an unmerged branch**, since merged: `spec/pack.schema.json` cited as shipped,
  and a persona count including one that had not landed.

## For the next session

- **The `m07.md` preamble defect is unfixed and now has five siblings** — `m06`, `m07`, `m08`, `m10`,
  `m11` each claim everything below them was relocated verbatim. **`m06.md` is already live**, carrying
  authored sections beneath that claim. It wants one sweep, not five amendments.
- **Nothing rails the doctrine↔row correspondence.** This near-miss is the second time in two days that
  a session-open grep was the only thing standing between the tree and a promise pointed at the wrong
  row. The memory record's own `Retire when` names the lint that would fix it; nobody has built it.
- **Two sessions can be given different answers to one question in the same hour.** Neither did anything
  wrong procedurally. If that is worth preventing rather than detecting, it is a maintainer's mechanism —
  an issue claimed before it is asked about, or a single place questions are queued.
