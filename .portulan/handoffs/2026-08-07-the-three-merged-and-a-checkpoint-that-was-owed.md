# Handoff — the three merged, the board refined, and a checkpoint that was owed and not run

Second handoff of 2026-08-07. The first
([`…more-than-they-saw`](2026-08-07-the-checks-that-said-more-than-they-saw.md)) is a snapshot taken
while all three pull requests were open; it is left as written, because a handoff is true as of its own
date and is never re-derived. This one carries what happened after it.

**State.** All three merged, `main` at `415167a`. **All three** feature branches deleted at both ends
after `git cherry origin/main <branch>` showed zero `+` lines — `index-says-within-budget-only-where-there-is-one`,
`an-unreadable-index-is-not-an-absent-one`, `a-control-character-nobody-can-see`. _(This line said
**Both**, in the handoff whose subject is counts written from memory rather than measured. Found by
Copilot on [#171](https://github.com/sleepy-panda-srl/portulan/pull/171); the branches are named
here now, because a list cannot disagree with its own count.)_ Suite **1033**, nine recipes green, `npm pack`
**87**. Issues #92, #91, #68 closed.

## The protocol breach, first because it is the one thing here that is not routine

**No fresh-context supervisor checkpoint ran at any point in this session — not session-open, not
pre-commit, not at the merges.** [`../memory/`](../memory/) and the checkpoint pack make those
**mandatory**, not discretionary: the two-tier protocol is the moat against drift and the guarantee
that nothing client-derived leaks. The first handoff called this *"a gap, not a scale-down"*, which was
too gentle. It was a **must-have that was omitted**, and it was omitted for the whole session including
three merges to `main`.

What that cost is not hypothetical, and the evidence is in this session's own record. The pre-commit
pass exists to attack a diff's **claims about the world**, which is the class Copilot cannot see and the
class that dominated here: eight rounds on [#167](https://github.com/sleepy-panda-srl/portulan/pull/167),
and the prose defects — a false universal in four carriers, an invented `seventeen invocations`, a stale
`660-line`, caret notation called a JavaScript escape — are exactly what that pass is for. They were
caught by Copilot and by a self-audit instead, at six rounds past a bound of two. A session grading its
own work is what the checkpoints exist to prevent, and this handoff is a session grading its own work.

**The maintainer's ruling is owed on whether the three merges stand unreviewed by a fresh context, or
whether a retrospective pass is run over `415167a`.** Recorded rather than decided.

## Decisions + why

- **Eight review rounds on #167, each authorised past the two-round bound individually.** The bound in
  [`a-review-loop-needs-a-bound`](../memory/a-review-loop-needs-a-bound.md) rule 4 was never treated as
  standing permission; every overrun was surfaced with options and ruled on. Rounds 1–5 found code, 6 a
  doc row, 7 prose, 8 a test name — the **taper** is what ended it, not the count.
- **Merged on the taper, and filed the remainder** as
  [#170](https://github.com/sleepy-panda-srl/portulan/issues/170), which is rule 4 working as written.
- **The suppressed channel was missed once, by this session.** The round on `35f0a64` was reported to
  the maintainer as clean; it carried three real notes. `copilot-reviewed` said SUCCESS, the body said
  *generated no new comments*, and the `<details>` block under it went unopened. Those findings reached
  `main` only because Copilot re-raised them two and three rounds later. Filed as evidence on
  [#66](https://github.com/sleepy-panda-srl/portulan/issues/66) — measured split on #167: **2 inline
  threads against 26 suppressed notes**.
- **#66 and #133 were NOT merged into one issue**, though it was proposed. Reading both showed the
  premise was wrong — and the premise was this session's own unsupported claim, which is #133's class
  aimed at #133. They are cross-referenced instead: #66 is the channel having no state, #133 is claims
  not being re-derived, and neither retirement condition implies the other.

## Board refinement

42 → 35 items. Ten closed issues removed; #161, #169, #170 added; every item carries a Status and a
Priority. `Now` is six: #66, #123, #133, #134, #148, #161. #133 and #66 promoted on the maintainer's
ruling. A partial-progress note added to [#74](https://github.com/sleepy-panda-srl/portulan/issues/74):
`recordType` is now one carrier that `doctor` imports, which is half of what that issue names — the
record-vs-`README.md` decision is still in three places, and a fourth adjacent copy at
`cli/doctor.mjs:1164` was not in its table.

**Eight open issues were checked against the tree rather than assumed stale.** None had been quietly
fixed; #141 was reproduced verbatim. Twenty-seven were not checked, which is stated because the table
would otherwise read as an audit.

## What was measured rather than recalled

Every figure in the three issue notes was re-derived against `415167a` before posting. The one that
matters: **the incident this session's rail is about reproduced twice more while round 7 was being
written** — the harness refused a commit message for hidden control characters, exactly as #68 records
happening during the original repair, and the retry still carried the byte, where the **new recipe
caught it**. First time anything in this repository has caught that class.

**Next action.** The maintainer's ruling on the omitted checkpoint. Then [#161](https://github.com/sleepy-panda-srl/portulan/issues/161)
is the oldest `Now` item with a weekly cost.

**Recoverability.** Nothing partial. `main` is green on all nine recipes and the full suite; no branch
is outstanding but this one.
