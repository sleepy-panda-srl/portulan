# Task 0034 — Doctor's biggest measured lever

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Criterion.** [#515](https://github.com/sleepy-panda-srl/portulan/issues/515),
row 13: doctor names one savings lever with its figure, pinned by a fixture.

**Acceptance criteria.**

- When ordinary doctor has session measurements, it shall compare demotion and
  restart estimates over the same horizon and multipliers and name one winner.
- When doctor runs statically, it shall state that session levers were not compared.
- When measurements are absent or incomplete, it shall report the limit without
  changing validation's verdict or opening another host-record reader.
- When an estimate is shown, the report shall show its input-equivalent figure
  and assumptions.

**Plan.** Compare measured context demotions with the existing ledger's recorded
restart, over one horizon and read multiplier. Subtract a routing allowance from
each demotion and the fresh write from restarting. Show input-equivalent tokens,
the unused-material assumption and unmeasured resume cost. Static mode names its
narrower evidence; no new host reader, validation failure or automatic demotion.
Pin both winners, nonpositive and absent evidence, stable ties and read boundaries.
Run all yielded recipes, independent pre-commit review, seam scan and finish;
open one labeled PR. Row 13 remains open.

**Session-open.** Independent `/root/checkpoint_515_open` requested comparison
with the existing restart measurement, a visible static limit and cross-lever
fixtures. The revised plan received APPROVE with those changes included.

**Limits.** These are review candidates with estimated upper bounds, not dollar
savings. Model and cache-lifetime changes have no comparable estimate. The
demotion allowance is a measured example routing line, not a compiled edit.

**Pre-commit.** Independent `/root/checkpoint_515_precommit` returned APPROVE
for the six staged paths. All 31 yielded recipes were exercised; sandbox-limited
checks passed with permitted sockets/index access and a temporary npm cache.
The full suite passed 3,488 of 3,490 cases; the two stale roster cases were
repaired by regeneration and all 17 roster tests then passed. Five isolated
mutations failed as expected. Strict plugin validation and the staged seam scan
passed, the latter with seven refusal controls. Review also repaired a manual-only
skill suppressing the note, the comment budget, task shape and host isolation.
Actual savings, retained quality after a demotion, model/cache comparisons and
resume costs remain undemonstrated. Final record-fold review and finish follow.
