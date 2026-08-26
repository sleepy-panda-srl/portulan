# Handoff — the figure going to him came from the wrong thirty, and fix-rounds cannot be counted at all

**Date:** 2026-08-26 · **M8 (Evals & telemetry), session 3** · Implementer: Opus 5.

## What landed

Clause **(c)**, review-loop metering. `cli/review-meter.mjs` derives the figures
`a-review-loop-needs-a-bound.md` bounds the loop on; `evals/review-loop/snapshot.json` is the captured
data and `register.md` the published figures, regenerated and byte-compared by the new `review-loop`
recipe; a drill for it takes the roster to 22, and it was forced red and fired. Five clauses remain.

## The two findings worth more than the tool

**The loop weighs 4.67 submissions per pull request a month on.** 140 submissions over the 30 most
recently merged, and 67.1% raising no inline comment. The record's figures are 3.7 and 29%.

**They are not a disagreement — they are disjoint corpora.** His window is the thirty most recent as of 2026-07-28 and names #44, #49 and #57; this one runs
#301–#354. No pull request is in both. The inequality between the rates does hold in the direction the
bound requires — found-nothing ⊆ no-inline, and 29% ≤ 67.1% — but they describe different populations,
so it is not evidence about the suppressed channel's size, and an earlier draft of this file asserted
that it was.

**Reported, not folded in.** The table is his, ratified 2026-07-28; the curated layer is human-owned, and
an implementer quietly correcting a ratified figure inside the change that re-derives it would be the
two-carrier defect arriving in its own repair.

**Fix-rounds are not derivable from the API, and this is the honest answer rather than a shortfall.**
The 2026-07-30 ruling already said the method — *"count pushes, then look inside each one"* — and the
counterexamples are both on the pull request that produced it: `08d7d10` answered an inline finding and
**was never a reviewed head**, and `cff3e4e0` follows a 4,087-byte finding-bearing submission while
answering none of it. Any mechanical rule gets the second wrong in the direction that flatters the
loop. So the tool computes none, estimates none, and prints nothing mistakable for one.

## The unit turns on a date, and reading it the modern way would have built the wrong thing

The criterion was written **2026-07-28**; *round* was redefined **2026-07-30**. In today's unit the
clause asks for something no API can answer; in the unit its own words were written in, it asks for
something exactly derivable. What settles it is not an implementer's preference but the record's own
`Retire when:` — *"the submission units of the table above, **not fix-rounds**"*. The meter therefore
counts submissions and never prints the bare word *round* for a figure.

## Two of the three metrics were one metric

Pushes came out **exactly** equal to submissions — 140 and 140 — because `review_on_push: true` draws
one per push. So the criterion's *"pushes per round"* is **1.00 by construction** in submission units,
and pushes-per-finding-bearing-submission is not a second measurement either: it is
`1/(1 − the no-inline rate)`, and 140/46 = 3.04 = 1/(1 − 0.671). Three columns of which two are
algebraically one column reads as more evidence than it holds, so the coincidence is **detected** and
printed on every run and in the register — and, on the checkpoint's adjustment, the literal 1.00 is
printed under its own name rather than left to be inferred from the paragraph about it.

## The trap that cost a run, for the fourth time here

`--fetch` against the live repository **printed nothing, exited 0, and wrote no snapshot.** The entry
guard was `import.meta.url === \`file://${process.argv[1]}\``, `import.meta.url` percent-encodes, and
this working copy lives under a path with spaces — **a green that is the tool never starting.**
`rule-carriers.mjs` designates the form, `goldens.mjs` and `drills.mjs` carry it with the comment
saying it was the third instance, and I wrote the broken spelling anyway. The same patch took
`process.exit` to `process.exitCode`, which `control-chars.mjs` settled here for the adjacent reason.
**A designated form that three files carry and a fourth still gets wrong is an argument for a rail, not
for another comment.**

## What was deliberately not built

**The empty-round rate is an upper bound** — [#355](https://github.com/sleepy-panda-srl/portulan/issues/355).
Separating *found nothing* from *carried only suppressed notes* needs the awk in `copilot-review.yml`,
fixtured in `verify/workflow-filters.mjs` — one carrier, and a **workspace**-layer one while the tool is
engine. **But the boundary forbids a copy, not the metric**, and I first wrote it as though it forbade
both: `workflow-filters.mjs` already lifts and runs those programs, and `--fetch` already spawns, so the
closing move is one lifted program and one stored integer. Left for budget, and the issue says so.

**The snapshot does not refresh itself** — [#356](https://github.com/sleepy-panda-srl/portulan/issues/356).
The recipe compares a register to a snapshot, never a snapshot to the world, so a stale capture and a
current one are the same green. #344's silence problem in a second place; the two want one mechanism.

## Supervision — one checkpoint of two, and the one that ran changed the numbers

**Session-open was self-graded and is not a checkpoint.** The session opened under an instruction not
to spawn agents, so the opening pass was mine on my own plan. Eight adjustments came out of it and are
folded in; a pass that grades its own plan is worth listing and is not worth calling supervision.

**Pre-commit ran in a fresh context**, on the maintainer's authorisation mid-session, and returned
**REQUEST-CHANGES** on twelve adjustments. All twelve are folded in. What it caught is the argument for
the moment in one line:

- **The window was ordered by pull request NUMBER, not merge date.** `gh pr list --limit 30` sorts by
  number and nothing re-sorted; the snapshot itself carried three inversions, sampling #303 and missing
  #301 under a register claiming *"the 30 most recently merged"*. **Every published figure was against
  the wrong corpus, including the one being escalated to him for a ruling** — 4.47 where the named
  window measures 4.67. Found from evidence inside the committed snapshot, which I had generated and
  not read.
- **`head` was uncontracted where `inline` was contracted**, so stripping every head exited 0 and
  regenerated a register printing `pushes 0` — the exact thing `meter()`'s own comment forbids one
  field over.
- **A false claim about the runner**: *"CI here installs nothing, so `gh` is not on the runner at all"*.
  `gh` ships on `ubuntu-latest` and four workflows here use it, one a required check.
- **Two of my measured figures did not reproduce** — #105 is seven of fifteen, not six; #342 is ninety
  of a hundred and two, not seventy-four of eighty-one. Both were true **mid-loop** and stale at merge.
  A hand-counted figure about a growing subject, inside the change built to retire exactly that.
- **`commit_id` stability is an open issue** (#253), and I stated it as a settled property at a second
  site — which is precisely what that issue's retirement condition forbids.
- **The 3.7-vs-4.67 delta is not a disagreement.** His window names #44, #49, #57; mine runs #301–#354.
  Disjoint. I had framed a month's drift as a re-count coming out different.

**Neither the plan nor I would have found the window defect.** It is visible only by reading the
generated data against its own heading, which is the one thing the author of both is least able to do.

## The review loop — two fix-rounds, and every finding was a false green

**Round 1, two inline findings, both real.** `--check` and `--write` without `--register` returned
**exit 0 having compared nothing** — so a person who typed the flag and forgot the path was told
everything was fine. And the missing-register test wrote an empty snapshot, which `validateSnapshot`
had just started refusing, so it exited 2 at the snapshot and asserted nothing about a missing
register while still passing.

**Round 2, two findings, both through the SUPPRESSED channel** and both promoted to gating threads by
this repository's own step. `validateSnapshot` refused `window.merged === 0` — making the tool reject a
snapshot **its own `--fetch` can write** for a repository with no merged pull requests, a validator
disagreeing with its producer. And `mergedAt` was compared **lexicographically**, so any string ordered
against any other: a window stamped `"yesterday"` would have passed while the register claimed it was
by merge date. Both parse the value now, on both sides of the split.

**Round 3, three notes, two findings, and both are SIBLINGS** — so under rule 4's 2026-08-07 exemption
they do not spend the bound, and the judgement that they are siblings is mine and is recorded here to be
overruled. The suite's header and one case still carried the **mid-loop** counts, 6 of 15 and 74 of 81,
while `review-meter.mjs` had already been corrected to the at-merge 7 of 15 and 90 of 102 — *a factual
contradiction between two files of one change, about counts, inside the change built to end
hand-counting.* The governing rule was enforced at another site of the same operation when the defect
was written, which is the exemption's own test, and it is `0020` word for word: the earlier repair
stopped where the checkpoint had quoted it. **A third live carrier in `cli/README.md` was found by
sweeping rather than by being told**, which is the only part of this worth any credit. The second
finding is round 1's finding one site over: `--pool 30 --limit 30` did not trip a guard reading `<`,
so the case fell through into the real `--fetch`, ran `gh`, and took its exit 2 from the fetch failing.
The guard now reads `<=`, matching the prose beneath it that had argued `<=` all along, and three cases
assert the **message** rather than the digit.

**All six findings are one class, and it is this change's own subject.** Something reported success
without doing its job: the flag that compared nothing, the test that asserted nothing, the validator
that could not fail, the ordering check that could not fail, the guard that let its own case through,
and the counts that contradicted their sibling file. Add the entry guard that exited 0 having run
nothing and the window that measured the wrong thirty, and this session shipped **eight false greens**,
six of them caught by a reviewer rather than by me.

**Where the bound stands.** Two fix-rounds spent; round 3 claimed under the sibling exemption. The
exemption buys rounds and never the gate — a fourth round is the maintainer's to grant and not mine to
assume, so anything further becomes an issue.

## State

`main` @ `420fd66` at branch point. Every recipe the manifest yields ran green in this working copy,
exit codes read directly; `drills --check` green at 22; the `review-loop` drill forced red and fired.
**And both rails ran green on CI** — `workspace-verify` and `forced-red` on `ubuntu-latest`, which is
the half a local run cannot establish and the pre-commit checkpoint named as owed. Seam scan clean over
every changed path, the commit message and the branch name, with a planted-term control reddening.
