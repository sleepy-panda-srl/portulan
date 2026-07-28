# Handoff — awaiting a review is a pending check, not a failed one

**State.** Branch `awaiting-a-review-is-not-a-failure`, one commit `a561854`, **not pushed** — push and
pull-request open are Gated and were left to the maintainer. Three files:
[`../../.github/workflows/copilot-review.yml`](../../.github/workflows/copilot-review.yml) rewritten to
wait rather than fail, plus the two documents that stated the behaviour it changes
([`../gate-map.md`](../gate-map.md) *Merge discipline*,
[`../memory/a-review-is-awaited-not-just-resolved.md`](../memory/a-review-is-awaited-not-just-resolved.md)).
All five verify recipes green, each read for its exit code; suite 309/309.

**The occasion.** The maintainer brought a failing run of the awaited-half checker and said the rule needs
to stop reporting failures when there is nothing to review. The run was PR #54, head `6a05f59`, pushed
06:57:40Z; Copilot reviewed that exact SHA at 07:01:27Z. **The check was never wrong — it was asked too
early and had no way to say so.**

**The diagnosis, which is the part worth carrying.** The checker had two outcomes for a question with
three answers, so *the round has not arrived yet* was reported in the same colour as *the round is never
coming*:

- **Awaited.** Copilot cannot have reviewed a commit that did not exist when the run started, so **every
  push produced a red check by construction.** Every `pull_request` run in this workflow's history is a
  failure; the green always arrives on a later run. Rounds measured 1m53s–3m47s (#49, #54, #57).
- **Not owed.** Ruleset `copilot auto-review on pull requests` carries `review_draft_pull_requests: false`,
  so on a **draft** no round is owed and none is coming. The old check red-X'd every push for the life of
  the draft, and no push, no wait and no review could have cleared it.
- **Missing.** The only one that deserved the colour it got.

A red that is *expected* on every push is how a gate gets read as background weather. That is the failure
mode this repository already has a name for from the other direction — the point of
[`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
is that a signal nobody acts on is not coverage.

**Decisions + why.**

- **Pending, not green, for the awaited state.** The job now polls inside its own run, so the check sits
  *in progress* while the round is outstanding. This was the whole design constraint: an unknown answer
  must not be a success. Exiting 0 while waiting — and equally a job-level `if:` skip, since GitHub scores
  a **skipped** required check as passing — would have opened the exact window the rule was written to
  close. A pending check blocks a merge just as hard as a red one and says the true thing.
- **Red is kept for the round never arriving.** 20-minute budget, five times the slowest round measured,
  so expiry means a fault rather than slowness — which is the only way the red at the end of it is worth
  reading. An unreadable API is retried, never taken as an answer, and if it is still unreadable at the
  budget it reports failure with the last error named. Still fail closed.
- **`pull_request_review` dropped, and this is what it bought.** It existed to flip the check green when
  the review landed, and could not: the triggering actor is the bot, so GitHub held the run as
  `action_required` — **the click this rail cost on every pull request**, recorded in the gate map as its
  honest price. Waiting inside the `pull_request` run, which is not bot-triggered, removes the trigger and
  the click. It also removes a class of false red nobody had named: the agent's own replies to Copilot are
  submitted as reviews (`portulan-agent[bot]`, empty body), and each one re-ran the check and printed a
  fresh failure mid-round — three times on 2026-07-27 alone (20:35:57 ×2, 21:26:26). **What is left is the
  tail:** if the budget expires, nothing re-triggers the check and a maintainer re-runs the job. The same
  click, surviving only in the case that is already a fault.
- **The relaxation, stated as one rather than buried.** Exactly one thing that used to be red is now
  green: **a draft pull request.** Everything else either kept its verdict or got stricter. This is the
  change to scrutinise, so the argument in full: GitHub refuses to merge a draft at all, `ready_for_review`
  is in the trigger list and re-runs the real check, and nothing that could previously merge unreviewed
  became mergeable. **The residual window, named rather than found later:** marking ready does not change
  the SHA, so for the seconds between that click and the new run reporting, the head's newest check run is
  the draft-era success. **Nothing else covers that window**, and the first version of this handoff and
  of the workflow comment both claimed otherwise: `workspace-verify` and `pr-labeled` run on draft pushes
  too, so on a mature draft they are already green on that SHA and `ready_for_review` re-runs neither,
  and conversation resolution is trivially satisfied because Copilot never reviewed the draft. The only
  guard is that a merge here is Gated and human — acceptable today, and **not acceptable the moment
  auto-merge is enabled**, which is the interaction to own before that setting changes. Caught by this
  session's fresh-context supervisor, not by the implementer. The alternative was a red that no action
  could clear, which is not a stricter gate — it is a gate that traps the change.
- **Superseded heads exit 0, and that is not a third relaxation.** A run whose head moved reports against a
  commit that is no longer the head, and a merge is gated on the head commit's check runs. `concurrency`
  with `cancel-in-progress` should normally get there first; the branch exists for when it does not.
- **`|` and not a tab as the field separator, in both reads.** A tab is **IFS whitespace**, so
  `IFS=$'\t' read` drops a leading empty field and collapses adjacent separators. A null `head.sha`
  arrived as `<tab>false` and was read as `head=false` — past the no-head-SHA guard, spending the whole
  budget comparing reviews against the string `false`. Fail-closed by luck rather than by design, and now
  by design. Present in the original since #56; found by exercising the script rather than by reading it.
- **Two claims-drift siblings fixed in the same stroke**, per the 2026-07-27 ruling that the defect class
  sets a fix's scope: the gate map's merge-discipline section called this *"a required status check"* four
  paragraphs above saying it is *"not yet required, deliberately"* — and branch protection confirms the
  latter, `main` requires only `workspace-verify` and `pr-labeled`. The memory record promised **three**
  limits and listed two. Both sit inside the passages this change rewrote; correcting one wrong claim while
  leaving its neighbour is the thing that ruling forbids.
- **Deliberately not done: a pass path for a pull request with zero changed files.** It is also literally
  "nothing to review", and it would have been one line. What Copilot does there is unmeasured, and an
  unverified pass path in a merge gate is worth less than the noise it removes.

**Verification, in the lab.** The step script is extracted from the YAML **by a parser, not by slicing
text**, and exercised against a stubbed API over thirteen cases — review present, landing on a later poll,
dismissed, null `commit_id`, never arriving, draft, head moved mid-wait, unreadable pull request,
unreadable reviews, absent head SHA, and four for the notes extraction, two of them driven by real Copilot
review bodies. The `late` case is the one that matters: green on the third poll where the old shape went
red on the first. The extraction method is not incidental — slicing by string prefix once let a multi-line
string whose continuation lines sat at column 0 pass all thirteen while the workflow itself no longer
parsed.

**Verification, on the platform** — the 0007 obligation, discharged where it counts, on
[#63](https://github.com/sleepy-panda-works/portulan/pull/63):

| Head | Job start → green | Polls | Click needed |
|---|---|---|---|
| `d4db12b` | 10:41:57Z → 10:44:01Z, **125s** | 5 | none |
| `1a61a54` | **3m12s** | — | none |

The log reads `waiting (1s of 1200s)` … `waiting (94s of 1200s)` … `found: copilot-pull-request-reviewer[bot] reviewed d4db12b (COMMENTED)` → `GREEN`. **No `action_required`, no maintainer approval, on either run** — the cost the first cut recorded as one click per pull request is gone, measured rather than predicted.

**The surfacing step earned its place on the same pull request.** Round one printed one suppressed note,
round two printed two. **All three were threadless**, none had a Resolve control, and none would have been
seen without it. Round one's was a correct fix with a wrong diagnosis — it claimed the indented here-doc
bodies reached `read` with leading spaces, when a YAML block scalar had already stripped them; the
here-strings landed anyway, because the old form was correct only while those lines carried exactly the
block indent. Round two's two were refused with evidence: jq's `join` treats null as the empty string and
does not error, so the suggested coalesce was a no-op that would have left a defensive line asserting a
hazard that does not exist.

**For the next session.** This check is **still not a required status check** and this change does not make
it one — so none of the above blocks or unblocks a merge mechanically yet. Joining the floor remains one
Gated settings command, and it is now blocked on a measurement nobody has taken: the repository is public,
and whether the Copilot ruleset requests a round on **fork** pull requests is unknown. If it does not,
every outside contribution reds out after twenty minutes the day this becomes required. One follow-up is
carried rather than smuggled in: the regression harness stubs `gh`, so the workflow's `--jq` filters are
executed against null-bearing input only as a one-off measurement, not by the suite.

**Seam scan clean** across files, commit message, and branch name.
