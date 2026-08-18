# Handoff — the gate map restated a rule it should cite

**Off the milestone row. Full lane**, per the triage threshold's *any change to this gate map*.
Pull request [#201](https://github.com/sleepy-panda-srl/portulan/pull/201).

## The defect

[`../gate-map.md`](../gate-map.md)'s *Merge discipline* section summarised the review-loop bound in one
sentence: *"one push per round, records land last, threads block but low-confidence notes do not, and
after two fix-rounds the remainder becomes an issue rather than another push."*

**The third clause had been false since 2026-08-07.** Rule 3 of
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) was reversed in
place that day, on the maintainer's ruling of shape 1 of
[`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md). The gate map went on denying the
promotion for two days — while `copilot-review.yml`'s `Suppressed notes are promoted to review threads`
step was already making those threads. A second, narrower carrier disagreeing with its rule is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s class, and the carrier that
disagreed is the file a fresh-context agent reads to learn what it may do.

## Why the repair is a citation and not a patched clause

Both routes were open, and the choice is measurable rather than stylistic. **Patching clause three alone
would have left clause four wrong in the other direction**: rule 4's two-fix-round bound acquired its
**sibling exemption** on the same 2026-08-07 date, and the enumeration states it flat. Two of the four
clauses had drifted, so a clause-level fix would have corrected one carrier while knowingly leaving its
neighbour — inside the change whose entire subject is that defect.

Citing is the repair `0020` prescribes for prose (*"one carrier, and the others reach it. In prose that
is citing"*) and the one [`../dod.md`](../dod.md) conditions 6 and 7 were repaired **into**. The old
sentence is kept **quoted as retired history**, matching how the record itself keeps *"Until 2026-08-07
it read …"*: a sentence labelled retired cannot drift.

## Two siblings, and one sweep deliberately refused

Per the 2026-07-27 ruling — the defect class sets a fix's scope. Both siblings are the same defect, this
paragraph restating the record instead of citing it:

- **The four figures carried a retired unit.** *"110 rounds … 3.7 each"* is the record's own table, which
  was re-labelled **submissions** on 2026-07-30, *"re-labelled, not re-counted"*. The gate map carried
  the retired label for ten days — in the one repository whose record on this subject exists partly
  because a unitless figure produced three disagreeing accounts of #105.
- **`review_on_push: true` was said to spawn "a round"**, which the record's own *what is therefore NOT a
  round* list names a submission.

**Refused, and named rather than half-done:** the gate map uses "round" for *a Copilot review arriving*
at roughly 25 sites, including the title of
[`0023`](../proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md). That reading is not wrong
in narrative prose — the record's distinction governs what a **count** is measured in — so the fix is
scoped to the counted figures, and the vocabulary sweep is its own change on `0020`'s own precedent for
refusing to fold a prose sweep into a doctrine diff.

**Also deliberately not swept:** the same enumeration at `docs/plan.md:1422` and in
[`2026-07-28-awaiting-a-review-is-not-a-failure.md`](2026-07-28-awaiting-a-review-is-not-a-failure.md).
Both are dated 2026-07-28 records of what shipped that day, and a forward-only cutoff is this
repository's own treatment of records written before an amendment — stated in the record and again in
`0020`.

## What the round found, which is the part worth keeping

**Copilot round 1 caught the change committing its own defect class.** The rewrite said
*"`review_on_push: true` means every push draws one"* — leaving the unit to the reader, three clauses
after its antecedent, **inside the paragraph whose whole subject is that a figure without a named unit
is unusable**. Taken; it now names the submission. Round 2 was clean and the derived verdict is approve.

That is the second time in this arc that the outside reviewer, not the author, found the class inside
the fix for the class — `0020`'s own incident report says the same of #166.

## For the next session

- **No fresh-context pre-commit checkpoint ran on this diff.** Stated rather than skipped quietly, per
  the gate map's own fallback: *"If supervision is unavailable in a session, that is stated plainly and
  the maintainer reviews the diff."* It is a breach of `dod.md` condition 7, in the same shape the board
  sweep of this date already recorded, and it is recorded here for the same reason.
- **The thread on #201 is unresolved and stays that way.** Resolution is the maintainer's judgement and
  travels with his merge approval, never ahead of it.
- **The vocabulary sweep is unfiled.** Roughly 25 sites in `gate-map.md` use "round" for a review
  arriving. Whether that is worth a change at all is a judgement — the record's unit obligation attaches
  to counted figures, and nothing here is miscounted.
- **This change is independent of `migrate-the-review-loop-record`**, which touches only the record file
  and is owned by another session. This one touches only `gate-map.md`; they neither conflict nor need
  ordering, and this change now depends on that file's **path** rather than its wording.
