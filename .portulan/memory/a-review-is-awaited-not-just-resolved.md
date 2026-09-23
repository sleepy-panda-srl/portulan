# A review is awaited, not just resolved

**type:** rule
**scope:** workspace — every pull request merged into `main`
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-review-lands-before-the-merge.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-27: *a pull request cannot merge until Copilot's
feedback has been awaited and resolved.* Taken from his own observation while browsing **closed** pull
requests, where merges had landed before Copilot's round on the final push arrived.

**A merge waits for the Copilot round on the commit it is actually merging, and for that feedback to be
resolved.** Two halves, two carriers: the session that owns the pull request for *awaited*,
`required_conversation_resolution` for *resolved*. The session awaits the round on its final head, and its
ready message names the review and the commit it addressed, in the one-line form
[`../gate-map/merge-discipline.md`](../gate-map/merge-discipline.md) fixes. A pull request no session owns
is awaited by whoever merges it.

**Why it holds:** the repository already had the resolved half and had been reading it as the whole rule.
Copilot is requested on every pull request, so *"Copilot reviews everything"* was true and load-bearing in
everyone's head — while nothing made a merge wait for the request to be answered. The window between a
final push and a review arriving is small, ordinary, and exactly where a merge lands when someone is
moving fast. The feedback then reaches a closed pull request and is disregarded by nobody in particular,
which is worse than being argued with.

That is the third distinct instance of
[`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md) in this
subject area, and the pattern is sharp enough to state: **a watcher that is only *requested* is not a
gate.** Requesting a review, enabling an alert, and adding a bot all create the feeling of coverage.

**The head SHA is the rule, not an implementation detail.** A review of an earlier commit does not
satisfy it. That is the defect itself — the review existed and described a different tree from the one
merging — so a reader asking *"does a Copilot review exist?"* answers yes on every case this rule was
written for. The ready line names the commit so that it can be checked against the head in one look.

**A review OBJECT is not a round — 2026-08-18,
[#286](https://github.com/sleepy-panda-srl/portulan/issues/286).** Copilot returned a review reading only
*"encountered an error and was unable to review this pull request"*, and the check of the day counted it,
because it asked whether a review object existed — right login, right commit, not dismissed — and never
whether a judgement had happened. The pattern above has a sibling: **an artifact a watcher produced is not
the judgement it was asked for.** An error notice is no round, whoever reads it.

**Amended 2026-09-23 — no check awaits the round.** His ruling of 17:21 UTC, and his choice at
21:22 UTC, removed `copilot-review.yml`, whose `copilot-reviewed` check had awaited the round since
2026-07-27. It was never a required context, so it held no merge; that day it went red at its
three-minute close on #431 and #432, and it misread every round after Copilot's review body changed
format under its matcher. His words: *"Today too many PRs have CI red because of the Copilot review
step."* Its window, round matcher, promotion of suppressed notes, derived verdict and re-run re-request
left with it; their history is in the handoffs that merge-discipline.md lists.

**A rail given up, stated rather than smoothed over.** The awaited half is discipline now, the class the
pattern above warns about, taken knowingly: the rail cost a red on most of that day's pull requests and
held none. What makes it acceptable here is that every merge is Gated, so the maintainer reads the ready
line against the head at a merge he approves anyway. **If merges here stop being Gated, this half needs a
rail again**, and it should be one that reads the round rather than a clock.

**Two limits.** *Resolved* is not *adjudicated*: a reviewer can resolve its own thread — measured on
[#44](https://github.com/sleepy-panda-srl/portulan/pull/44) — so this rule guarantees the round
**happened before the merge**, not that anyone agreed with it. And a round that never lands does not hold
the merge: the ready line says what was seen, and merging without a round is his call, on his ruling of
14:07 that day: *"This shouldn't be an error and it shouldn't cause the CI to fail."*

**Retire when:** Copilot review is no longer part of this repository's review path.
