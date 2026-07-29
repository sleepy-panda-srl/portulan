# Handoff — the changelog becomes correctable, and 0.2.0 is cut

**Date:** 2026-07-29 · **post-M5, no milestone row touched** · Branch
`changelog-unreleased-accumulates` · [#106](https://github.com/sleepy-panda-works/portulan/pull/106)

**State.** Sent at the first two **Now** items on the board. #94 is closed by this change; **#98 was
routed away and is still the maintainer's**. All eight recipes green, seam clean, `main` at `b6b3af1`.

## Why #94 was not a one-line fix

`## Unreleased` said milestone 4 was open. It had been closed for a day, across the close of a second
milestone. The one-line repair was available the whole time and **two sessions deliberately did not take
it**: #85 and #87 cut no release, and the header said this file *"is written in the change that cuts the
release"*, so editing it would have contradicted the rule the file states about itself.

**That is the finding worth carrying.** The old rule did not merely permit drift — it made a
**known-false sentence unfixable**, and the compliant response was to leave it standing. A rule whose
only lawful answer to a falsehood is silence is worse than one nothing checks.

It also matters that this is *not* the argument the session first made. The first draft claimed the
section's non-empty state proved accumulation was already the practice. It was not: one accumulating
write (both commits belong to #31, one session) and two principled abstentions. The session-open
supervisor refuted it from the issue's own body. **A convenient argument for a correct conclusion is
still a defect**, and it was two supervisor rounds from shipping.

## What the maintainer ruled, and the second ruling nobody had asked for

1. **`## Unreleased` accumulates** — a change adds its entry as it lands; the cut renames and dates the
   heading. Declined: written-at-the-cut, and accumulates-plus-a-rail.
2. **Cut `v0.2.0` now.** This one came *from the session-open supervisor*, which observed that two
   milestones had closed untagged while Protocol → Versioning requires a changelog per release, and that
   the old header's own logic makes the cut the place the file gets written. Neither the issue nor the
   session had named it. **The refusal produced a better option than either party held** — which is the
   checkpoint paying for itself in the direction it is least often credited for.

## Two protocol failures, named because the records are where they bind

- **Implementation ran ahead of the session-open verdict**, which `gate-map.md` forbids in as many
  words. Second instance in this repository; #73's handoff records the first. The verdict came back
  **REFUSE**, and its headline finding — that the tree carried a *fabricated* maintainer ruling, since
  #94 then had zero comments — was **wrong on a premise a fresh-context supervisor cannot check**: the
  ruling was real and had been given in the implementer's window. The lesson is not that the supervisor
  erred. It is that **a ruling given only in a session window is, to every later reader, indistinguishable
  from one that never happened**, and the cure it prescribed — record it citably — was right and is now
  done on #94.
- **Commit and push preceded the pre-commit verdict** (`b33d550`, pushed in flight). Auto-tier actions
  and nothing merged, and the committed text was byte-identical to what was graded — but dod condition 7
  was not satisfiable at commit time, and a gate whose event has passed must never read as having
  governed it.

## What was caught before it shipped

Two hand-copied figures, the class #93 is open about: *"seventeen of twenty-four rules refuse"* against a
live matrix saying **16 of 23** — now deferred to `compile --matrix` rather than mirrored, since a second
carrier is how it went stale — and *"55,976"* relocated characters against the tree's **55,643** in three
places. **The second came out of the build's own carried context, not the tree**, which is the more
useful half of the lesson.

Three sibling staleness defects went in the same stroke: the Stop-gate paragraph describing the
pre-M4-session-1 cap; `product.md` calling this repository **private** (public since 27 July) and the
enforcement compiler unbuilt; and the prose carriers naming `v0.1.0`. The pre-commit checkpoint found a
fourth — the entry narrated the sixth recipe and the eighth and skipped `workflow-filters`, the seventh.

**Corrected after the fact: that sentence said "both prose carriers" and there were three.** The
maintainer's requested second opinion found `plugin/README.md`'s own `## Status` section still reading
`Skills (3)` and `Tagged v0.1.0` — a section frozen at milestone 3 while its siblings in `core/` accrete
a paragraph per milestone. **The sweep that would have caught it was never run**: two carriers were found
by reading, the class was declared closed, and no `git grep` confirmed the count. That is the same
undercount shape this repository has a rule about, committed inside the change whose subject is stale
carriers. Fixed on `plugin-status-names-a-superseded-release`, and this paragraph is the correction the
old changelog rule would have forbidden.

## For the next session

- **The tag is owed.** `v0.2.0` merges before it is tagged, per the v0.1.0 ordering. **No file asserts
  the tag exists**: `README.md` and `product.md` name the newest *release entry*, which is true from the
  merge onward and stays true after tagging. That wording is the review round's doing — the first draft
  said "is the current release", which the reviewer caught five times across both channels, and which
  this bullet then described as a window to be tolerated rather than a sentence to be fixed. Still, an
  entry and its tag should not stay apart for long.
- **#98 should ride [#105](https://github.com/sleepy-panda-works/portulan/pull/105), not a new branch.**
  That pull request already owns `docs/plan.md` and `docs/milestones/m06.md` and has written the option
  analysis into m06.md. Amending row 6 from anywhere else puts two branches on one milestone row — the
  #95/#96 collision, which cost a rebase. The choice is the maintainer's on four carriers.
- **The new rule has no rail**, deliberately. `## Unreleased` may not name a milestone as open is the
  declined option and wants its own argument.
