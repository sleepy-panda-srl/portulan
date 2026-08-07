# 0021 — The suppressed channel has no state, and #66 is a ruling rather than an implementation

**Status.** Proposed — the maintainer's ruling is what this asks for.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/176

## Why this is a proposal and not the change [#66](https://github.com/sleepy-panda-works/portulan/issues/66) describes

[#66](https://github.com/sleepy-panda-works/portulan/issues/66) asks that Copilot's suppressed
low-confidence notes be posted as real review comments at their `file:line`, so each becomes a thread
and `required_conversation_resolution` — already required on `main` — gates it. Building that would
**invert rule 3 of [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md)**,
which reads *"Threads block; suppressed notes do not"* and carries the maintainer's ruling of
2026-07-28. It is a rule change, and [`../gate-map.md`](../gate-map.md)'s Propose tier says where a rule
change starts:

> An idea that adds an axis, a mode, or a surface starts as a proposal. It is written into `proposals/`
> and ruled on there — never opened as an implementation pull request with tests.

That tier prices the other route with its own measurement:
[#53](https://github.com/sleepy-panda-works/portulan/pull/53) and
[#55](https://github.com/sleepy-panda-works/portulan/pull/55) built a three-mode autonomy axis and
hardened it through seven review rounds before the ruling that declined it — **declined as unnecessary
rather than rejected as wrong**, which is the part that makes the precedent sting — so the whole build
was waste. #66's own body ends by naming the open question — *"whether that is enough is the design
question"* — which is the sentence that decides the route.

## What has been measured since #66 was opened

Re-derived against the API on 2026-08-07. **Units: a *submission* is a Copilot review arriving on a
push, which is what these figures count. It is not a *round*** — rule 4's unit — and
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) exists in part
because that conflation produced three disagreeing records of
[#105](https://github.com/sleepy-panda-works/portulan/pull/105).

**The channel carries most of the findings.**

| Pull request | Inline threads | Suppressed notes |
|---|---|---|
| [#81](https://github.com/sleepy-panda-works/portulan/pull/81) | 3 | 11 |
| [#85](https://github.com/sleepy-panda-works/portulan/pull/85) | 6 | 17 |
| [#167](https://github.com/sleepy-panda-works/portulan/pull/167) | **2** | **26** |

Three non-consecutive pull requests are not a trend and no trend is claimed here. #167's figures:
`/pulls/167/comments` filtered to login `Copilot` returns **2**; of the **10** submissions from
`copilot-pull-request-reviewer[bot]`, **nine** carry a `<summary>Suppressed comments (N)</summary>`
block, and the counts sum to **26**. _(#81's and #85's figures are the memory file's own re-measurement
of 2026-07-30, cited rather than re-derived, and it counted a different header spelling —
`Comments suppressed due to low confidence (N)`. The spellings interleave; the totals are comparable,
the method is not identical, and saying so is cheaper than implying one sweep produced all three rows.)_

## The finding that changes what #66 is about

**Thirteen of #167's twenty-six notes never surfaced outside a collapsed `<details>`.** They were on the
page — inside Copilot's own review body, which is where a suppressed note always sits — and nothing
expanded them onto it. Three separate faults, and only one of them is the one anybody had noticed:

| Submission | Notes lost | Why |
|---|---|---|
| `d02111f` | 5 | the workflow run was **cancelled** |
| `35f0a64` | 3 | the workflow run was **cancelled** |
| `cd902d3` | 2 | the workflow run was **cancelled** |
| `064331d` | 1 | its submission raised an inline comment, so no verdict review is posted — **by design** |
| `d21a341` | 2 | the verdict review said *"3 … quoted below"* and **quoted one** |

**Ten of the thirteen were lost to the merge gate cancelling itself.**
[`../../.github/workflows/copilot-review.yml`](../../.github/workflows/copilot-review.yml) carries a
`concurrency` block keyed on the pull-request number, whose `cancel-in-progress` is `true`, with the
reason stated in its own comment: *"A push supersedes the run waiting on the commit it replaced."* The
intent is sound and the side effect was not foreseen — **that run is the only thing that would have
quoted the superseded submission's notes, and Copilot's review of the superseded head arrives anyway,
after the cancel.** Measured: the run for `d02111f` started 14:47:55 and was killed at 14:55:19;
Copilot's review of `d02111f` landed 14:58:40. For `cd902d3` the margin was five seconds. **Every
submission in the table above ran to a `cancelled` conclusion, and every submission not in it ran to
`success`** — across all ten, with no exception in either direction, and `064331d` the single
in-table exception that succeeded and lost its note by design.

**Two more were lost inside the extractor.** On `d21a341` the verdict review states a count of three and
quotes one. The `awk` that lifts the block ends on `/^#+[[:blank:]]/`, and the first note's quoted
snippet is a **shell comment at column 0**, so extraction stopped at the opening fence of note one. The
column-0 anchor is deliberate and its reasoning is sound — it exists so an *indented* `#` inside quoted
code is not mistaken for a heading — but a column-0 `#` inside quoted code was not considered, in a
repository whose reviews routinely quote shell files back at it. **A verdict review therefore posted a
false count onto a pull request that merged**, which is [#133](https://github.com/sleepy-panda-works/portulan/issues/133)'s
class arriving inside the machinery built to prevent it.

**One of the cancelled submissions is the one this project got wrong.** The handoff of 2026-08-07
records that the submission on `35f0a64` was reported to the maintainer as clean and carried three real
notes. Two of the three have clear counterparts in later submissions; the third — a brittle threshold in
`cli/control-chars.test.mjs` — appears in no later submission and reached `main` by independent work
**six minutes before the note was published**. So *"they reached `main` only because Copilot re-raised
them"* is true of two of the three and is not a general account; the handoff's sentence is quoted
faithfully in the record and is narrowed here rather than repeated.

## What #66 would cost, stated rather than waved past

Rule 3 is a calibration and the rule prices it: on
[#63](https://github.com/sleepy-panda-works/portulan/pull/63) the suppressed notes ran one correct fix
with a wrong diagnosis, two flatly wrong, and one genuinely right. **That taxonomy is cited and its total
is not re-derivable** — the memory says four, #66's body says *"two of six"*, and summing #63's
suppressed headers by the method used above gives nine across six submissions. Three carriers, three
numbers, in the file whose subject is that a count needs a named unit. Named here as an open
discrepancy rather than silently picking one.

**At #167's ratio, #66 means twenty-six blocking threads on one pull request** — twenty-five after
dedup, since only one anchor repeats — against a bound of two fix-rounds. And the escape #66 offers,
resolve-as-invalid with a reasoned reply, is not the agent's to take:
[`../gate-map.md`](../gate-map.md) makes resolving *the judgement that a review point is settled* the
maintainer's, travelling with his merge approval and never ahead of it. **So twenty-six threads is
twenty-six resolutions on his hand.** That number is what the ruling turns on, and #66's body does not
state it.

## Three shapes

1. **As #66 describes it** — every note becomes a thread at its `file:line`. The signal becomes
   complete: `CLEAN` means both channels are answered. Maximal cost, and it inverts rule 3 outright.
2. **Repair the surfacing mechanism and change no rule.** This is now **three defects, not one**: the
   concurrency cancel (ten notes), the column-0 truncation (two, plus a false count on a merged pull
   request), and the by-design silence on an inline-comment submission (one). Notes stay non-blocking,
   so rule 3 is untouched and this is an implementer's change rather than a proposal. It does **not**
   give the channel state: an expanded note is still not a thread.
3. **One aggregate thread per submission.** Rule 3 already prescribes one batched pull-request comment
   as the answer to a submission's notes; this gives that batch a *place that carries state*. The
   channel becomes gated — `CLEAN` stops being true with unread notes — at **one resolution per
   submission rather than one per note**, and low-confidence notes stay non-blocking individually,
   which is the calibration rule 3 was defending.

**The drafter's recommendation, flagged as the drafter's.** Shape 2 is owed whatever the ruling: three
of its four faults are plain defects in machinery this repository already decided it wanted, and the
concurrency one silently disarms the merge gate's own surfacing on any pull request that pushes while a
run is waiting — which is every busy pull request. Shape 3 is the one worth ruling on, because it is the
only one that answers #66's actual complaint — *the channel carries no state at all* — without paying
#66's price. Shape 1 is the faithful reading of #66 and is the most expensive.

**What shape 2 is not:** a substitute for the ruling. Every note in the table above was *surfaced
correctly* on the submissions that were not cancelled, and the channel still carried no state on those —
which is the whole of #66 and is untouched by any repair.

## Enforcement

Shapes 1 and 3 both earn a rail: the thread is gated by `required_conversation_resolution`, already
required on `main`, so nothing new has to be believed. Shape 2 earns none by itself — and that is the
argument for it rather than against it, since what it fixes was invisible to every gate for a whole
pull request. A regression test over the extractor is available and cheap; the concurrency fault needs a
decision about what a superseded run owes, which is why it is named here rather than patched in passing.

Whichever is chosen, the observation procedure ships with it, per
[`0007`](0007-every-watcher-ships-with-its-observation-procedure.md).

## What this proposal deliberately does not do

- **It does not implement any of the three shapes**, and does not assume the answer is shape 3.
- **It does not amend [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md).**
  Rule 3 stands until the maintainer rules otherwise; this records what is now known against it.
- **It does not fix the concurrency race or the extractor.** Both are shape 2, both are defects rather
  than rule changes, and folding a repair into the proposal that discovered it would put an
  implementation inside the artifact whose whole purpose is to be ruled on first.

## Provenance

`form=link` `href=https://github.com/sleepy-panda-works/portulan/issues/66` — deferred from
[#63](https://github.com/sleepy-panda-works/portulan/pull/63) and promoted to `Now` on the maintainer's
ruling recorded in the board refinement of 2026-08-07. The surfacing table, the concurrency correlation
and the extractor truncation were measured on 2026-08-07 against `/pulls/167/reviews`,
`/pulls/167/comments` and `/actions/runs`. **They were measured because a fresh-context pre-commit
checkpoint refused the first draft of this file**, which had attributed all eleven missing notes it then
counted to the by-design branch alone — the right defect list reached by the wrong mechanism, which is
the error this repository names most often and the reason the checkpoint is not optional.

**Decision.** Marius Cetanas — pending.
