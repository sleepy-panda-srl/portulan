# Merge discipline — enforcement, limits and history

> The rest of the gate map's [Merge discipline](../gate-map.md#merge-discipline--an-open-thread-blocks-the-merge), after the
> rule it opens with.

**One carrier holds a merge for review, and it is the platform's**: `required_conversation_resolution` on
`main`, in [the floor](../gate-map.md#the-platform-floor). Every review thread blocks the merge until it is
resolved, whoever opened it — the maintainer, an agent's review, or any other reviewer — and resolving is
the maintainer's judgement, carried with his approval of the merge ([identity.md](identity.md)). A thread is
answered on that thread, and a finding with no thread, such as one in a review's body, in one pull-request
comment: [`memory/an-answer-lands-on-the-thread-that-raised-it.md`](../memory/an-answer-lands-on-the-thread-that-raised-it.md).
*Resolved* is still not *adjudicated*: a reviewer can resolve its own thread, as recorded in
[the floor section](platform-floor.md), so `resolvedBy` says whose judgement closed one.

**What this gives up, stated rather than left to be found.** No CI job asks for a review and nothing waits
for one. A review someone requests can land after the merge, on a closed pull request, which is the defect
the 2026-07-27 ruling below was made against, and no rule here now prevents it. What stands there is the
maintainer: every merge here is Gated ([identity.md](identity.md)), so whether to wait for a review he
expects is his decision at the merge he approves.

## Retired 2026-10-30: the review was awaited, not just resolved

**Copilot review left this repository's review path on 2026-10-30, by the maintainer's decision.** His
words: *"remove copilot request CI step. And anything related to Copilot reviews from the CI/CD"*. The
`copilot-request.yml` workflow and its `workflow-filters` fixtures left the tree with it. The
`copilot auto-review on pull requests` ruleset and the `copilot-request` environment with its secret are
his to remove, as settings changes; whether they are gone is read from the API, never from here
([platform-floor.md](platform-floor.md)). What follows is the rule as it stood.

**Ruled 2026-07-27: a pull request could not merge until Copilot's feedback had been *awaited* and
*resolved*.** Browsing closed pull requests, he had found merges that landed **before** Copilot's round on
the final push arrived, so the feedback reached a pull request that was already closed. The two halves had
different carriers:

| Half | What it meant | What carried it |
|---|---|---|
| **Resolved** | No Copilot thread was left unaddressed | `required_conversation_resolution` on `main`, which still holds every reviewer's threads |
| **Awaited** | A **round** on the **current head** had landed — and a review object was not a round | The `copilot-reviewed` check until 2026-09-23; from then the session that owned the pull request, in a line its ready message carried |

**No check awaited the round from 2026-09-23**, his ruling of 17:21 UTC and his choice at 21:22 UTC: *"Work
with coordinator on this, the whole process needs to be rethought, discarded, approach completely
differently if need be - anything that's actually more streamlined, with less friction than it is now.
Today too many PRs have CI red because of the Copilot review step."* `copilot-reviewed` had never been a
required context, so it never held a merge. It went red at its three-minute close on #431, before any round
had been asked for, and on #432 a minute before the round landed, and it read every round of that day as
unrecognised, because Copilot's review body had moved to a new format (`## Copilot review overview`) under
its matcher.

**From then the session that owned the pull request awaited the round** on its current head, read the
review in whatever form Copilot filed it, threads or body, and fixed or answered each finding; its ready
message named the review, the commit it reviewed, and what was fixed and what answered, or that the round
found nothing, or that no round landed and what was seen. Merging without a round was his call, in his
words of 14:07 that day: *"This shouldn't be an error and it shouldn't cause the CI to fail."* The head SHA
was the whole design: a review of an earlier commit described a different tree from the one merging. A body
saying Copilot *"encountered an error and was unable to review this pull request"* was not a round
([#286](https://github.com/sleepy-panda-srl/portulan/issues/286)), and a draft drew none. That half was
discipline rather than a rail, taken knowingly, because the rail had cost a red on most of a day's pull
requests and held none.

**CI asked for the round where the ruleset did not**, from 2026-09-23 to 2026-10-30. The ruleset requested
one on a pull request a person opened and on every push to it; `copilot-request.yml` asked, with the
maintainer's token, on one a bot opened ([identity.md](identity.md) records why the request was his). It
judged no round.

**Two records retired with the loop**, both naming Copilot's leaving the review path as their condition:
[`a-review-loop-needs-a-bound.md`](https://github.com/sleepy-panda-srl/portulan/blob/7d72356/.portulan/memory/a-review-loop-needs-a-bound.md)
bounded its length, and
[`a-review-is-awaited-not-just-resolved.md`](https://github.com/sleepy-panda-srl/portulan/blob/7d72356/.portulan/memory/a-review-is-awaited-not-just-resolved.md)
carried the awaited half. A third, on where an answer lands, named the same condition; the maintainer's
decision kept its reviewer-neutral part, cited above.

**Whether Copilot was worth it was to be measured on demand, not in CI**, on the coordinator session's
delegated call of 2026-09-23: over ten rounds on pull requests a session opened, against a bar of at least
three rounds with a real finding the coordinator session's draft review had missed, at most one wrong
finding per two real ones, and a median round of seven minutes or less, with Copilot to leave the review
path on his word below it. **It never ran**: the review-loop snapshot was last refreshed on 2026-08-26,
before that call, and no record of the ten rounds exists, so the 2026-10-30 decision is his word and not
the measurement's outcome. [`cli/review-meter.mjs`](../../cli/review-meter.mjs) derives the submission counts, and its
register, [`evals/review-loop/register.md`](../../evals/review-loop/register.md), is now the historical
record of that loop rather than a reading of a live one.

**What left with the check on 2026-09-23.** `copilot-review.yml` and its fixtures: the three-minute window
and the 20-minute budget before it, the round matcher and its #286 classifier, the promotion of suppressed
low-confidence notes into threads, the derived verdict the agent identity submitted and dismissed, and the
re-run re-request. Proposal [`0023`](../proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md)'s
exit (2) had been retired earlier the same day. The history is in the handoffs:
[2026-07-27](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-07-27-the-review-lands-before-the-merge.md),
[2026-07-28](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md),
[2026-07-29](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-07-29-the-verdict-is-derived.md),
[2026-08-18](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-08-18-a-review-object-is-not-a-round.md),
[2026-09-23 c](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-09-23-c-the-copilot-review-window-is-three-minutes.md),
[2026-09-23 g](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-09-23-g-a-copilot-window-with-no-round-is-reported-not-failed.md) and
[2026-09-23 j](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-09-23-j-the-session-awaits-copilot-and-no-check-does.md).
The text this file carried before 2026-10-30 is at `git show 7d72356:.portulan/gate-map/merge-discipline.md`.
