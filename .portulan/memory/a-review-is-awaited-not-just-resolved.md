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
the check went **red** on a head with no Copilot review, printing that head's SHA and `Review authors
seen: none`; Copilot then reviewed **that exact SHA** and the `pull_request_review` re-trigger fired. It
did **not** go green on its own — GitHub held the bot-triggered run as `action_required`, awaiting a
maintainer's approval. So the rail works and **costs one click per pull request**, which is recorded as a
cost rather than smoothed over.

**Three limits, stated because the rule is weaker than it sounds.** The reviewer's login is a platform fact
the workflow hard-codes; a rename surfaces as a permanent red rather than a silent pass, which is the
right failure direction and still a fragility. And *resolved* is not *adjudicated*: a reviewer can
resolve its own thread — measured on [#44](https://github.com/sleepy-panda-works/portulan/pull/44) — so
this rule guarantees the round **happened before the merge**, not that anyone agreed with it.

**It composes with the autonomy mode rather than substituting for one.** A mode decides whether an agent
raises a ship-step prompt; this is a required status check, and floor rows hold at every mode. Under
`auto`, where no prompt is raised, this check still refuses. That composition is the reason the rule is
worth more under a loose mode than under a strict one.

**Retire when:** Copilot review is no longer part of this repository's review path, or the platform gains
a native *"require a review from this app on the current head"* setting that makes the workflow redundant.
