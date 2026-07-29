# Handoff — one definition of where a Session log entry ends

**Date:** 2026-07-29 · **Triage lane, post-M5** · Branch `one-definition-of-where-an-entry-ends`

Closes [#79](https://github.com/sleepy-panda-works/portulan/issues/79), the finding
[#73](https://github.com/sleepy-panda-works/portulan/pull/73) triaged out under the review bound rather
than fixing in place.

## The defect

`docs.sh`'s `record` check held **two definitions of where a Session log entry ends**, and they
disagreed. The entry parser requires the strict marker `^- YYYY-MM-DD ·`; the seam scan re-derived the
boundary with its own looser `^- 2[0-9][0-9][0-9]-`. So an unindented `- 2026-…` line without the middle
dot did not start a new entry as far as every other check was concerned, but *did* terminate the seam
scan — and an attestation sitting after such a line read as absent. A **false red**, which this
repository has held since milestone 2 to be the worse failure, because it is the one that gets a whole
recipe switched off.

It was pre-existing, carried since the check landed 2026-07-27, and #73 preserved the line unchanged
while extending everything around it.

## The fix is a deletion, not a tightening

The obvious repair is to copy the strict marker into the second regex. That was rejected: it leaves two
carriers of one definition and buys only that they agree *today*. **The seam scan now reads the entry's
start line and its length from the parser** — the same `$tmp/entries` the budget check counts — so the
second definition is gone rather than corrected, and there is nothing left to drift.

That is this repository's most-repeated lesson (*a fact with two carriers drifts at the weaker one*)
applied to the check written to catch it, which is why it is worth more than the narrow bug it closes.
It is also the third false red found in this one check inside two days, all three in its seam half.

## Observation

Measured on the merged tree at `56d34e7`, reverted after, tree asserted clean:

| Move | Result |
|---|---|
| clean tree | green |
| attestation after an unindented dated bullet inside the entry | **green** — was `FAIL … carries no seam attestation` |
| an entry carrying no attestation at all | **red** — the negative control; the check still refuses |
| attestation wrapping between "seam" and "scan" | green — the 2026-07-28 fix, asserted as a regression guard |

The negative control is the load-bearing one: a repair that widens what counts as an attestation would
also pass an entry with none, and the point is to stop hiding a real one, not to stop looking.

## What this does not fix

The seam check still reads **presence, not truth** — a false "seam scan clean" passes exactly as a true
one does — and correspondence is still by date rather than by session. Both remain in
`verify/README.md`'s Known limits, untouched by this change.

## Provenance worth keeping

Every one of the four findings on #73 that reached real defects arrived through Copilot's **suppressed
low-confidence** channel — no thread, no Resolve control, `copilot-reviewed` green throughout — and this
was the last of them. [#66](https://github.com/sleepy-panda-works/portulan/issues/66), which proposes
promoting those notes into real threads, now has a five-for-five record behind it rather than an
argument.

## State

All recipes green, each exit code read; suite re-measured on this branch rather than carried over. Seam
scan clean across files, commit message and branch name. The handoff index was regenerated, since the
series it covers gained this file.

**The merge is the maintainer's.**
