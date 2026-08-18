# Handoff — the loop doctrine merged, and the rail that watches reviews was found blind

**Continues** [`2026-07-30-the-loop-gets-its-fresh-verdict.md`](2026-07-30-the-loop-gets-its-fresh-verdict.md).
Same working stretch, past midnight: that handoff covers drafting [#137](https://github.com/sleepy-panda-srl/portulan/pull/137)
through its two checkpoints; this one covers landing it. **Milestone state: none moved.**

## What landed

[#137](https://github.com/sleepy-panda-srl/portulan/pull/137) **merged** — `main` = `2939050`, five
commits, rebased linear. The merged tree was re-verified in a **clean clone**: eight recipes green,
756/756, kernel 44/60. Branch auto-deleted.

## The decisions a later session would otherwise re-derive

- **Two rebases, and the second one mattered more than it looked.** #135 landed while #137 was open and
  brought **its own 2026-07-30 amendment to milestone 7's row file** — deliberately *drafted and not
  applied to the row*, where #137's is *applied*. Concatenating them would have left two sections with the
  same date and the same `(an expansion)` suffix and opposite statuses, indistinguishable to a reader. So
  #137's now names its subject in the heading and states that it **is** applied, against the other's
  explicit statement that it is not. **Neither narrows the other and row 7 reads correctly with either,
  both, or neither applied** — that sentence is in the file because it is the thing a future reader will
  want and cannot derive.
- **Why the row edit stayed applied at all.** The session-open checkpoint ruled it into the diff on the
  ground that every M1–M8 amendment landed as a merged diff, and a body-only draft would owe a second act.
  #135 chose the other convention for its own amendment. Both are now in the tree; the divergence is
  recorded rather than silently normalised, because normalising it would have meant overwriting a merged
  session's deliberate choice.
- **The handoff index is generated, so a rebase regenerates it.** After the first rebase it was staged and
  uncommitted — CI would have gone red on `index`. Regenerating is not an edit: every field is derived from
  the series and held current by byte comparison.

## The finding worth carrying: a rail that reports "none" when it means "could not see"

Copilot's round on the merge head carried a suppressed note. **The derived verdict said there were none.**

`.github/workflows/copilot-review.yml` matches the review body against the literal
`comments suppressed due to low confidence`. Copilot's markup has moved to `Suppressed comments (N)`. The
old string is not a substring of the new one, so the block is not found and the workflow takes its
*absent* branch.

The workflow **already legislated against exactly this**. It carries two branches — absent, and
present-but-unparseable — and the second says of itself *"Copilot's markup has probably changed … **This is
not a report of zero notes.**"* That branch is unreachable, because reachability is decided by the same
stale literal. So it emitted the sentence whose entire purpose is to assert that it looked, at the one
moment it had not.

**Why this is worse than a missed note.** The suppressed channel has no thread and no gate, and this
project has measured that it **carries most real findings**. A silent zero there is the review loop's least
visible failure, and nothing retains the bodies, so the number of past rounds that reported a false zero is
**unknown and not recoverable** without a hand sweep. Filed as
[#142](https://github.com/sleepy-panda-srl/portulan/issues/142); the final round on #137 was swept by
hand instead, and was genuinely clean.

It is the class `.portulan/memory/a-checkers-coverage-is-measured-not-named.md` names, and a live argument
for milestone 8's **forced-red drill** clause: a rail that has quietly stopped firing is found by the
incident rather than by the drill, which is precisely what happened.

## Also filed

[#143](https://github.com/sleepy-panda-srl/portulan/issues/143) — the proposal-names-its-PR rail forces a
commit to exist before the first pre-commit checkpoint has anywhere to stand. It records the breach #137
committed, the compliant path that existed, and three options, with the rule-change one marked as the
maintainer's and belonging in a proposal rather than an issue.

## Open, for whoever picks this up

- [#144](https://github.com/sleepy-panda-srl/portulan/pull/144) also adds a 2026-07-31 handoff and a
  `docs/plan.md` entry. Whichever of the two lands second **rebases and regenerates the handoff index** —
  the `record` check counts entries against handoffs per date, so both records must be present and balanced.
- The **M6 close-hold and #135's M7 residence amendment are still drafted and unapplied**, as is `vendor` as
  the switch's carrier. All three are the maintainer's to ratify.
