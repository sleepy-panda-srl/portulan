# A review is awaited, not just resolved

**type:** rule
**scope:** workspace — every pull request merged into `main`
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-review-lands-before-the-merge.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-27: *a pull request cannot merge until Copilot's
feedback has been awaited and resolved.* Taken from his own observation while browsing **closed** pull
requests, where merges had landed before Copilot's round on the final push arrived.

**A merge waits for the Copilot round on the commit it is actually merging, and for that feedback to be
resolved.** Two halves, two mechanisms:
[`../../.github/workflows/copilot-review.yml`](../../.github/workflows/copilot-review.yml) for *awaited*,
`required_conversation_resolution` for *resolved*.

**Why it holds:** the repository already had the resolved half and had been reading it as the whole rule.
Copilot is requested on every pull request by ruleset, so *"Copilot reviews everything"* was true and
load-bearing in everyone's head — while nothing made a merge wait for the request to be answered. The
window between a final push and a review arriving is small, ordinary, and exactly where a merge lands
when someone is moving fast. The feedback then reaches a closed pull request and is disregarded by nobody
in particular, which is worse than being argued with.

That is the third distinct instance of
[`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md) in this
subject area, and the pattern is now sharp enough to state: **a watcher that is only *requested* is not a
gate.** Requesting a review, enabling an alert, and adding a bot all create the feeling of coverage; only
something that refuses creates the coverage.

**The head SHA is the rule, not an implementation detail.** A review of an earlier commit does not
satisfy it. That is the defect itself — the review existed and described a different tree from the one
merging — so a checker matching on *"a Copilot review exists"* would have reported green on every case
this rule was written for.

**Demonstrated on the pull request that introduced it**, both halves, per
[`a-watcher-earns-its-place-by-being-watched`](../proposals/0007-every-watcher-ships-with-its-observation-procedure.md):
the check went **red** on a head with no Copilot review, printing that head's SHA and an authors-seen line naming no reviewer (the exact
wording lives in the workflow and may drift; the observation, not the string, is the record); Copilot then reviewed **that exact SHA** and the `pull_request_review` re-trigger fired. It
did **not** go green on its own — GitHub held the bot-triggered run as `action_required`, awaiting a
maintainer's approval. So the rail worked and **cost one click per pull request**, recorded as a cost
rather than smoothed over.

**Amended 2026-07-28 — awaiting is pending, not failing, and the click is gone.** The first cut answered a
three-state question with two colours: it could not distinguish *the round has not arrived yet* from *no
round is coming*, and reported both as failure. That made the red on the first row **guaranteed** — Copilot
cannot review a commit that did not exist when the run started — and the red on the second row
**permanent**, because the ruleset carries `review_draft_pull_requests: false` and a draft is never sent.
Rounds measured 1m53s–3m47s across #49, #54 and #57. The check now waits inside the `pull_request` run it
already has, so awaiting shows as a pending check that blocks a merge just as hard; a draft reports success
with its reason, which opens nothing, since GitHub will not merge a draft and `ready_for_review` re-runs the
real check. Removing the `pull_request_review` trigger removed the `action_required` click with it — and
also a class of false red, since the agent's own replies to Copilot are submitted as reviews and each one
re-ran the check mid-round.

**Three limits, stated because the rule is weaker than it sounds.** The reviewer's login is a platform fact
the workflow hard-codes; a rename surfaces as a permanent red rather than a silent pass, which is the
right failure direction and still a fragility. *Resolved* is not *adjudicated*: a reviewer can
resolve its own thread — measured on [#44](https://github.com/sleepy-panda-works/portulan/pull/44) — so
this rule guarantees the round **happened before the merge**, not that anyone agreed with it. And the wait
has a budget: 20 minutes, five times the slowest round measured. Past it the check reds and **nothing
re-triggers it**, so a maintainer re-runs the job — the old click, surviving only in the case that is
already a fault.

**It composes with the autonomy mode rather than substituting for one.** A mode decides whether an agent
raises a ship-step prompt; this is a status check, and floor rows hold at every mode — it is not yet
required, deliberately, per the gate map. Under `auto`, where no prompt is raised, this check still
refuses. That composition is the reason the rule is worth more under a loose mode than under a strict one.

**One state cannot clear, and its exit is doctrine rather than machinery — added 2026-08-09.** A head
can wait out the whole budget with the re-request accepted and no round arriving — measured twice on
[#157](https://github.com/sleepy-panda-works/portulan/pull/157)'s rebased heads, cause unexplained,
authorship the surviving lead ([#161](https://github.com/sleepy-panda-works/portulan/issues/161)). The
ruling on [`../proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md`](../proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md),
exit (2): the check stays red, and merging past it is the maintainer's explicit per-occurrence act,
recorded on the pull request before the merge. **Not a weakening** — `copilot-reviewed` is not a required
context, so the platform never held this door; what the record buys is that routing around the gate stops
being invisible.

**Retire when:** Copilot review is no longer part of this repository's review path, or the platform gains
a native *"require a review from this app on the current head"* setting that makes the workflow redundant.
