# Handoff — the channel that carried the findings, and the gate that threw them away

Fourth handoff of 2026-08-07, and the first of three from one working thread: the maintainer asked for
the top three `Now` items addressed one by one, **one pull request each**, and ruled that each carries
its own handoff and Session log entry rather than the thread carrying one — `identity.md`'s definition
of a session is one branch and one pull request, and three pull requests are three sessions under it.
This one is [#176](https://github.com/sleepy-panda-works/portulan/pull/176), for
[#66](https://github.com/sleepy-panda-works/portulan/issues/66).

**State.** Proposal `0021` written, and shape 2 of it implemented — the concurrency key and the
fenced-block fix in [`copilot-review.yml`](../../.github/workflows/copilot-review.yml), with three
fixtures added to [`../verify/workflow-filters.mjs`](../verify/workflow-filters.mjs), which already
lifts these programs and runs them against real review bodies. All three were forced red against the
old programs first, and the extractor's failure reproduces `d21a341` exactly: it stops after note one.
Nine recipes green.

## What #66 asked for, and why this is a proposal

#66 wants Copilot's suppressed low-confidence notes posted as real review comments, so each becomes a
thread and `required_conversation_resolution` gates it. That **inverts rule 3** of
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md), which carries
the maintainer's ruling of 2026-07-28, and the gate map routes a rule change to `proposals/` rather
than to an implementation pull request — #53/#55 being the priced precedent. So the argument was
written and the ruling asked for.

## The part that was not in #66, and how it was nearly missed

The first draft counted eleven lost notes on [#167](https://github.com/sleepy-panda-works/portulan/pull/167)
and attributed all of them to the one mechanism anybody had noticed: the verdict step stays silent when
a submission raised an inline comment. **A fresh-context pre-commit checkpoint refused it** and sent the
session to `/actions/runs`, where the real cause was sitting:

- **`cancel-in-progress: true`, keyed on the pull-request number.** A push during the wait killed the
  run that would have quoted the superseded submission's notes — and Copilot's review of that head
  arrives anyway, after the cancel. **Ten of the lost notes, across three submissions**, `cd902d3` by a
  margin of five seconds. `35f0a64` is the submission a session reported to the maintainer as clean.
- **The extractor terminated on a column-0 `#`.** Copilot quotes the line each note is about, this
  repository's reviews quote shell, and a shell comment starts with `#` at column 0. On `d21a341` the
  verdict review announced *"3 … quoted below"* and quoted one — **a false count posted onto a pull
  request that merged**, the count matcher and the extractor disagreeing about one body, which is the
  drift the workflow's one-matcher design exists to prevent.

The corrected figure is **thirteen of twenty-six across five of nine submissions**, and the correction
made the case for #66 stronger while falsifying the table that argued it. **The right defect list
reached by the wrong mechanism is the error this repository names most often**, and it was caught by
the checkpoint rather than by the suite, by Copilot, or by the session.

## What shipped, and the instruction that changed the scope

The proposal originally declined to fix either defect, on the argument that a repair inside the artifact
meant to be ruled on first is an implementation smuggled past a gate. **The maintainer overruled it on
2026-08-07** — *"address all of them as part of these PRs"*, offered against the alternative of filing
them as issues — so shape 2 ships here. The declined argument is left standing in the proposal rather
than rewritten, because a record that tidies away the reasoning it lost destroys what makes the ruling
legible.

**The concurrency change is the one to watch.** The group now carries the head SHA and nothing cancels
anything, so a superseded run keeps a runner until its own round lands — measured at 1m53s–3m47s on this
repository, against a 20-minute budget only spent when a round never comes. The gate is unaffected: each
run reports against its own commit. Undemonstrated: **no run has yet been observed completing after
being superseded**, because this branch's own rounds arrived before any push overtook them. That is the
first thing to check on the next busy pull request.

## The second carrier this session nearly shipped, and the recipe that refused it

The regression test for the extractor was first written as **a new file, `cli/notes-extraction.test.mjs`**,
which lifted the `awk` out of the workflow and ran it against a fixture. That harness already existed:
[`../verify/workflow-filters.mjs`](../verify/workflow-filters.mjs) lifts *every* jq **and awk** program
out of these workflows and runs each against real review bodies, with an anchor binding each fixture to
a program and checked in both directions. The session read the file's header — *"every jq program a
workflow runs"* — and stopped there.

**Nothing caught the duplication. What caught it was a different fault in the same change**: the fence
rule had been factored into a shell variable and spliced into each program, and `workflow-filters.mjs`
can only lift an awk program written as a **single-quoted argument**. It reported *"4 awk invocation(s)
in the block and 1 readable"* and exited **2 — could not run**, which is
[`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md)
working exactly as designed: it refused to report on programs it could no longer read, instead of
passing over them. Chasing that exit 2 is what surfaced the harness.

So the fence rule is written out in all three programs rather than shared, the new file is deleted, and
the three fixtures live in the harness that already owned this job. **Repetition a harness executes
beats a shared literal it cannot see** — and the anchors themselves went stale in the same change and
said so, which is the check-in-both-directions half earning its keep.

_Recorded because the near-miss is the class this repository names most often, it was aimed at the
review machinery by the pull request about review machinery, and no rail was watching for it._

## What the loop cost, and where it ended

Two rounds, inside the bound. Round 1 carried one inline thread and two suppressed notes, all three
correct and all three fixed in one push. Round 2 carried one suppressed note claiming unbalanced
Markdown emphasis, **refuted against GitHub's own `/markdown` endpoint** rather than argued —
`**A *b***` is well-formed and renders as it should. The taper is the signal, per the standing note, and
it is clean here: substance, then a rendering claim that was wrong.

**Worth recording for the proposal's own subject:** both of round 1's real findings arrived through the
suppressed channel, and neither would have blocked anything.

## Next

The ruling on shapes 1 and 3 is what this pull request exists for. Nothing else here is blocked on it —
shape 2 stands on its own as defect repair.
