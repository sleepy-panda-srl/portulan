# The table stops being its own archive, and the rows keep the law

**Date:** 2026-07-29 · Post-M5 reconciliation · [#96](https://github.com/sleepy-panda-works/portulan/pull/96)

The package the maintainer deferred with *"Merge #80 as is. We'll reconcile after M5 lands"*, landed as
one pull request. What follows is the *why* — the log entry is the pointer.

## The measurement that set the shape

The milestone table held **63,420 characters** and **only ~11% of it was criterion**. That number is
the whole argument. The rest was amendment argument, session notes and close-evidence narrative — all
of it reviewed, merged and worth keeping, and none of it what a session opening `docs/plan.md` needs
in order to learn what it must build. Milestone 4's Status cell alone was **16,505 characters on one
line**. The file every session boots from was paying that cost on every boot.

So the remedy was never deletion and never summary. It was **relocation**: the row keeps the law, a
per-milestone file keeps the legislative history, and the history moves byte-for-byte.

## What made the relocation safe, and what nearly made it unsafe

The mechanical part was cheap: cut each cell at literal markers, assert the segments re-concatenate to
the original, refuse to proceed on any unaccounted byte. That held — 55,643 characters moved with zero
loss, re-checkable from `HEAD`.

**The expensive part was everything the mechanism could not see, and both supervisors earned their
keep there.**

Session-open found that cutting the four open rows at `**Criterion amended` would have moved **law**
out with the argument. The done rows were safe by accident of practice — this repository folds an
amendment's operative wording into the criterion cell when it amends — but the open rows never got
that fold, so their entire post-amendment obligations lived inside the argument block. Milestone 6
would have been left demanding *a* resolving pack, which is exactly the stub its amendment exists to
refuse. Milestone 8 would have shown four clauses where the law has eight. The fix is the statute-book
model: the operative sentence stays in the row verbatim *and* the full block stays in the file, with
the duplication declared rather than hidden.

It also found that **21 relative links break** the moment text moves one directory deeper. That would
have redded `links` — this workspace's oldest rail — on the pull request itself.

Pre-commit found the one I would have shipped: **milestone 5's row had lost the handoff-series
deliverable entirely**. The generated index over `.portulan/handoffs/` was added by the 2026-07-28
amendment precisely so the row would name what `loop.md` promises it, and my split had left the row
naming neither it nor its argument. That is the same defect class session-open caught on the open rows,
in a row I had already treated as handled — which is the argument for two checkpoints rather than one.
It also reconstructed milestone 4's whole 16,505-character Status cell back out of `m4.md` to prove
byte-identity **after auditing my checker and finding half of it decorative**.

## The rail, and why it may be retroactive

`record`'s entry budget has a forward-only cutoff, and that was correct: a rule written after a record
cannot bind it without rewriting the record to suit the rule. The `plan` rail has no cutoff, and the
distinction is not convenience. **Its remedy is relocation, which preserves a merged record
byte-for-byte.** Every historical row can comply without one word being lost, so retroactivity costs
the record nothing — and a cutoff would have exempted precisely the rows that motivated the rail.
Retroactivity is honest exactly when compliance destroys nothing, and the conservation proof is what
establishes that here rather than asserting it.

The scoping is the other half. Both text patterns are anchored to table rows because
`[Ss]ession [0-9]+ of` matches **8 Session log entries** and **8 of the 12 new milestone files** carry
`**Criterion amended` — that being the relocated argument. A file-wide grep would have redded the
archive it had just created, on its first run. The session-note pattern is also deliberately wider than
the shape the brief named: milestone 3 used a lowercase bullet-led `· session N of` where 4 and 5 used
`(Session N of`, and a rail written to one spelling would have reported green over 4,126 characters of
the table it was minted from.

A fourth assertion exists only because pre-commit found the fail-open inside the rail: a row containing
an escaped `\|` did not parse into five cells, fell out of the budget loop, and passed — under a summary
line still claiming twelve rows examined. An unparseable row is now a refusal, and the budget reports
how many rows it could **read** rather than how many exist.

## What I did not settle

**The handoff-series budget is still the maintainer's**, and this change deliberately does not move it.
Exactly **one** librarian pass has run — 2026-07-29 — which is not the same thing as *the staleness pass
shows the series impeding it*. The recommendation on record stands (no budget; the generated index is
the read-cost remedy; revisit on the named trigger) and one data point does not fire that trigger. It is
stated as open in the pull request body so it cannot lapse into a default by silence.

One residual is disclosed rather than resolved, on pre-commit's note: `core/operating/memory.md` now
names milestone 6 as per-agent memory's arrival while proposal 0016 declines to promise that row will
build it. Milestone 6's session-open grep will therefore meet a doctrine promise the row does not carry.
The honest answers are a criterion amendment or a reworded doctrine sentence, and both are the
maintainer's — the same routing `a-doctrine-promise-belongs-in-the-row-it-names.md` prescribes.

## Verification

All eight recipes run; suite **635/635** across 79 suites, measured rather than derived. `docs.sh` red
on exactly one check before this handoff landed — `proposal`, because 0016 could not name its own pull
request before that pull request existed, which is the documented Known limit and clears with this push.

**Seam scan clean** over the diff, the commit message and the branch name.

## Follow-up after the merge — #101

Two rulings arrived after `7726c50` landed, both correcting the same misjudgement of mine.

**Milestone 9 had no file**, because it has never been worked and the reconciliation had nothing to
move out of row 9. I had already made this mistake once, about milestones 0 and 1, and given the same
reason. The maintainer's objection is the better one both times and it is not about duplication: **a
gap behind one row invites the inference that some rows are exempt from carrying their history**,
which is precisely the reading the fidelity-note split exists to prevent one column over. Declaring
the absence costs one file. Leaving it inferred costs the property.

The generalisable form, since I got it wrong twice: *the unit is the series, not the row.* Asking
"does this row have anything to relocate?" gives the wrong answer, because the file's job is not only
to hold history — it is to make the presence of history checkable at a glance. A missing file is
indistinguishable from an unwritten one, which is the same shape as *nothing to report* versus *did
not look*, a distinction this repository's own recipes are built to preserve.

**The series is zero-padded** — `m0..m9` → `m00..m09` — because a directory that grew past nine
entries sorts 0, 1, 10, 11, 2, 3. All 24 references in `docs/plan.md` moved with the files; `links`
passing over the renamed tree is what proves none was missed, rather than my having checked.

**Three denominators moved with them** and were enumerated *before* pushing rather than found by
review: the root README's "a file per milestone that has one" (now "one file per milestone", true
again), and "8 of the 11" in both `verify/README.md` and this handoff, now 8 of 12. That count is
load-bearing — it is the measurement justifying why the `plan` rail is anchored to table rows rather
than grepping the file tree. This is the class the six review rounds above found five separate times,
and the only reason it did not cost a seventh is that it was treated as a known failure mode instead
of a surprise.
