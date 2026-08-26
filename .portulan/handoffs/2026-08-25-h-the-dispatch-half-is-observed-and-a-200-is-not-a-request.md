# Handoff — the dispatch half is observed, and a 200 from GitHub is not a request

**Date:** 2026-08-25 · **M8 (Evals & telemetry), session 2, follow-up** · Implementer: Opus 5.

## What landed

Three things, all on the maintainer's instruction after [#343](https://github.com/sleepy-panda-srl/portulan/pull/343) merged.

1. **[#343](https://github.com/sleepy-panda-srl/portulan/pull/343) merged** as `da9c06e` — clause (d) is
   in `main`. Every recipe the manifest yields ran green on the merged commit and the sweep was re-run
   there: **21 of 21 forced red and fired on `da9c06e`**, which is a verdict about the tree that landed
   rather than the tree that was reviewed.
2. **The calendar's `workflow_dispatch` half is now OBSERVED** — run
   [`32883413709`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32883413709), dispatched the
   moment the merge put `drills.yml` on the default branch, 21 of 21 on `da9c06e`. Recorded in
   [`../verify/README.md`](../verify/README.md)'s register, in the gate map's watcher table, and in
   [`../../evals/README.md`](../../evals/README.md) — the three carriers that had said, before the answer
   existed, exactly where it would go.
3. **Two findings filed** rather than folded: [#347](https://github.com/sleepy-panda-srl/portulan/issues/347)
   and [#348](https://github.com/sleepy-panda-srl/portulan/issues/348).

## Half a watcher is vouched, and the halves are listed apart on purpose

`0007` asks for the procedure *"run once and its result recorded"*, and this watcher has two triggers with
two different answers. The dispatch is answered. **The schedule is answered by its first Thursday run and
by nothing earlier**, so the carriers now say *half-vouched* rather than either *unvouched* or *works* —
collapsing the two into one claim is the over-reading the register exists to prevent, and it would have
been the easy sentence to write on the strength of a green dispatch.

## The finding worth keeping: a 200 establishes nothing

The maintainer granted an extra review round, and **re-requesting Copilot could not fetch it.** Measured
on #343, twice:

| Body | Exit | `requested_reviewers` after |
|---|---|---|
| `reviewers[]=Copilot` (already reviewed the PR) | 0 | `[]` |
| `reviewers[]=not-a-real-user-xyz` (**a login that does not exist**) | 0 | `[]` |

The second row is the control and it is the one that matters: **a 200 from that endpoint does not
establish that the login resolves, let alone that a request was created.**

**And `copilot-review.yml` rests a diagnosis on exactly that inference.** It sets `rerequest_state=sent`
on a zero exit, its own comment says *"the split is on what this job ESTABLISHED with its own write, never
on the list alone"*, and the `sent` arm then prints *"GitHub ACCEPTED it, so a request WAS created for this
actor"* and *"the login is not worth checking: GitHub accepted it, so it resolves."* Both are refuted by
the control. So the message names a cause it has not established, in the two sentences that tell a reader
not to check the one thing worth checking — `a-stated-enforcer-must-be-the-real-one`, in a file whose
comments record the same class being repaired on #89, #157 and #160, each time in the message rather than
in what the message rests on.

**Blast radius stated at its real width:** `rerequest_state` never gates the verdict — it selects which
diagnostic paragraph prints on a job that has already failed to see a round. So it misdiagnoses a failure
and manufactures no green. Filed as **#348**, board *Next*, with the repair: establish `sent` by reading
the list back, and give *asked and not accepted* the arm it currently lacks.

**Second instance of the shape in this repository**, after `gh project item-add` exiting 0 and adding
nothing. An exit code standing in for an observation.

**So the granted round arrived on the `synchronize` of an ordinary push**, which is the trigger that
workflow actually has. It found one thing — a dependency guard I had left short — and the round after it
found one note, triaged as **#347**: `--pack-root` resolves against the cwd while `--repo-root` names
another tree. Measured across `recipe-set`, `compile` and `drills`, all three refuse identically, so the
newest member matches its siblings exactly and repairing it alone would make a fifth spelling of one rule.
Eight tools take that flag; the contract is theirs to settle, not this change's.

## The merge needed a sync, and the conflicts were the ones the rule predicts

The first merge attempt was refused: `main` had moved to `ae27511` (#346) while #343 was in review,
`behind_by: 1`. Rebased and force-pushed with `--force-with-lease` per
[`../memory/a-branch-syncs-with-main-before-it-merges.md`](../memory/a-branch-syncs-with-main-before-it-merges.md),
and both conflicts were **correspondence** collisions rather than textual ones — which is what that rule
says to expect:

- `handoffs-index.md` — **regenerated** with `node cli/index.mjs`, never hand-merged. A hand-merge of a
  generated file survives exactly until the next run.
- `docs/plan.md` — both branches appended a Session log entry dated 2026-08-25. **Both kept**: the log is
  append-only and two sessions closed that day.

Then re-verified on the rebased tree rather than inherited from before it, and again on the merge commit.
`gh pr merge` also reported `fatal: 'main' is already used by worktree` — its post-merge local checkout,
not the merge, which had already landed. Worth knowing in a repository routinely holding several
worktrees: read the remote before believing that message.

## State

`main` @ `da9c06e`. Clause (d) is in; **six of nine clauses remain.** Every recipe the manifest yields is
green on `main` and the sweep is 21 of 21 there. Seam scan clean over every path this change touches, the
commit message and the branch name, with a planted-term control reddening.

**Owed to the maintainer, and only this:** the **Thursday 06:00 UTC cadence** is his to rule — the value
the clause shipped with, not a policy an implementer settled — and the schedule's own first run is what
vouches the half that is still unvouched.

## Copilot round 1 on the records pull request — two findings, both mine, both about carriers

**A row that observed one half and then called the whole thing unvouched.** The gate map's watcher row
recorded the dispatch and its final clause still read *"until then this calendar is unvouched"* — one
sentence apart, contradicting the split the same row establishes and the wording the two other carriers
had already taken. Carrier disagreement inside the row whose subject is halves answered at different
times.

**And the sweep for it found two more sites, which is the half worth recording.** Row 8's **Status cell**
said the same thing; that one is a **live current-state claim** — the scoreboard every session boots
from — so it is truthed to *half-vouched*. The session-2 **Session log entry** says it too and is
**deliberately left standing**: `docs/plan.md` is in the record layer, that entry was true on the date it
carries, and rewriting a dated record to match a later fact destroys the record in order to tidy it. The
distinction is the one `version-carriers` already encodes by excluding the record layer by path — a live
claim moves, a dated one does not.

**A comment that claimed its own provenance, falsely.** `drills.yml`'s bullet said the run id was
*"recorded in … the register, which is where this sentence said it would go — written before the answer
existed"* — but that sentence **is** the update written after the observation, so it predated nothing. A
claim about a mechanism re-derived rather than inherited is `0022`; here it was a claim about the text
itself. Reworded to attribute the prediction to the version that shipped with the workflow, whose only
checkable home is the merged history of #343.

**Neither is a mechanism defect and both are the reason this pull request exists** — it carries nothing
but records, and the records were the half that was wrong.

## The sync, again, and the conflict was again append-only

`main` moved **four** commits during this review (`0744256`, `8f2d641`, `3993de7`, and #345's
consolidation), leaving this branch `DIRTY` rather than merely behind. Rebased per
[`../memory/a-branch-syncs-with-main-before-it-merges.md`](../memory/a-branch-syncs-with-main-before-it-merges.md);
the one conflict was `docs/plan.md`'s Session log with two entries dated the same day, and **both are
kept** — the log is append-only. That is the second time in two pull requests that the predicted
collision was exactly this one, which is evidence for the rule rather than an inconvenience.

## Round 2 — a fourth carrier, and my sweep could not see it

The same sentence, in `drills.yml`'s own observation-procedure block: *"until that run exists this
calendar is **unvouched**"*, one bullet below the one recording the dispatch as answered.

**The reason it survived is worth more than the fix.** My sweep for the class grepped
`calendar is unvouched` **line by line**, and here the phrase wraps across two comment lines — so a
line-scoped matcher could not see it however many files it read. **A sweep scoped by its own grep**: the
class this repository has now met at a census *size* (session 1, round 2), at a *word form* (session 1,
round 4), and now at a **line break**. Three different reasons one matcher was narrower than the class it
claimed, in three sessions.

Re-swept **whole-file** rather than per-line — comment prefixes, emphasis and every newline collapsed
before matching, which is the only shape that can see a wrapped phrase. Two remaining matches, both read
rather than trusted to the matcher, and both correct as they stand: the note above that **quotes the grep
pattern** as part of recording this finding, and the session-2 Session log entry, which is the record
layer — `cli/version-carriers.mjs`'s `isRecord("docs/plan.md")` returns **true**, so that exclusion is a
mechanism rather than my opinion.

**Three carriers now say half-vouched and one dated record says unvouched, which is correct in both
cases** — the live claims moved, the dated one did not.
