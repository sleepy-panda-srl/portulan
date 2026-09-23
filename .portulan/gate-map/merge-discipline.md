# Merge discipline — enforcement and bounds

> The rest of the gate map's [Merge discipline](../gate-map.md#merge-discipline--the-review-is-awaited-not-just-resolved), after the
> ruling it opens with.

The two halves need different mechanisms, and only one of them existed:

| Half | What it means | What enforces it |
|---|---|---|
| **Resolved** | No Copilot thread is left unaddressed | `required_conversation_resolution` on `main` — already in [the floor](../gate-map.md#the-platform-floor) |
| **Awaited** | A **round** on the **current head** has landed — and a review object is not a round | [`../../.github/workflows/copilot-review.yml`](../../.github/workflows/copilot-review.yml) — new |

**Awaited was the gap.** The Copilot ruleset *requests* a review on every pull request a person opens,
and [`copilot-request.yml`](../../.github/workflows/copilot-request.yml) on one a bot opens, which the ruleset
does not; nothing made a merge wait for one. So a merge could land in the window between the final push
and the review arriving, and did. That is
[`memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
again — a reviewer everyone relied on, with nothing making the reliance real.

**The head SHA is the whole design.** A review of an *earlier* commit does not satisfy the check, because
that is precisely the defect: the review existed and described a different tree than the one merging. The
check matches every review's `commit_id` against the pull request's current head and re-runs on
`synchronize`, so pushing puts it back to pending. An unreadable API is still `could not look`, never
`nothing wrong`, though since 2026-09-23 the check reports it with a warning rather than failing.

**A review object is not a round — amended 2026-08-18, issue [#286](https://github.com/sleepy-panda-srl/portulan/issues/286).**
The row above said *the round has landed* and the check asked something weaker: that a review by the
right login, on the right commit, not dismissed, EXISTS. Those came apart during a platform incident.
Copilot returned a review whose entire body read *"Copilot encountered an error and was unable to review
this pull request"*, `copilot-reviewed` reported **green** on it, and the derived verdict then submitted
an **APPROVED** asserting that round *"raised no inline comment and no suppressed low-confidence note"* —
about a round that never happened. On [#283](https://github.com/sleepy-panda-srl/portulan/pull/283) the
approval was submitted **4m36s before** the only genuine round arrived, so it cannot have been derived
from it; the real round then found nothing, which made the sentence true by coincidence and left nothing
on that pull request distinguishing an earned approval from an unearned one.

The check now classifies the matched review's body before it counts as a round. A body carrying no
announcement it recognises **and** saying the reviewer was unable to review does not satisfy this half,
and the wait continues. The `unread` guard could not reach this: an error notice is a body the step reads
perfectly, and it parses to *no suppressed notes*, which is an approving state. **The guard for "I could
not look" does not fire when the answer is "I looked, and it says the reviewer could not look."**

**The residual, stated rather than left to be found.** Recognition rests on Copilot's own prose, so a body
this step cannot classify — neither round nor refusal — **greens the check** and carries no verdict. That
is the disposition an unparsable notes block already has, and it is chosen over a red on purpose: a
vendor rewording would otherwise hold every pull request in the repository until somebody edited a
matcher. The cost is real and is the honest half of the trade: if Copilot ever rewords its ERROR notice
in particular, this check goes green again on a review that judged nothing, and the only tell is the
missing derived verdict plus a loud job summary. On an App-authored pull request no verdict was coming
anyway, so there the job summary is the whole signal. Both matchers are exercised by
[`verify/workflow-filters.mjs`](../verify/workflow-filters.mjs) against bodies measured off this repository,
and a new spelling is taught **fixture first, matcher second**.

**Awaiting is pending, not failing — amended 2026-07-28.** The first cut had two outcomes for a question
with three answers, so *the round has not arrived yet* was reported in the same colour as *the round is
never coming*. Since Copilot cannot have reviewed a commit that did not exist when the run started, **every
push produced a red check by construction**, and rounds on this repository land 1m53s–3m47s later (#49,
#54, #57). A red that is expected on every push is how a gate becomes background weather. The check now
waits inside its own run: the job stays *in progress* while the round is outstanding, which blocks a merge
exactly as hard and says the true thing, until the window closes. The window is **three minutes since
2026-09-23, the maintainer's time-box**, which replaced a 20-minute budget set at five times the slowest
round measured. A window that closes with no round ends green with a warning, on [his ruling](../gate-map.md#merge-discipline--the-review-is-awaited-not-just-resolved), and so
does one whose last look could not read the API, on the coordinator session's delegated call. At the
close the check reports whatever had landed, in its job summary as well as its log:
what is on the awaited head, whether Copilot still holds the request, and Copilot's newest review on the
pull request. Rounds here have landed up to 3m47s after a push, so a round slower than the window arrives
after the report, *late* rather than *lost*, and a re-run processes it.

The same amendment closed a red that could never clear. The Copilot ruleset carries
`review_draft_pull_requests: false`, so on a **draft** no round is owed and none was ever coming; the check
now reports success there, naming the reason, which opens nothing because GitHub refuses to merge a draft
at all and `ready_for_review` re-runs the real check. The window it leaves is named in the workflow.

**Three limits, named rather than found later.** The reviewer's login is a platform fact the workflow
hard-codes, and a rename would show up as a warning on every pull request rather than a silent pass — the
failure direction to prefer, but a fragility to know about. Resolution still does not mean *adjudication*:
a reviewer can resolve its own thread, as recorded in [the floor section](platform-floor.md). This rule makes the round
**happen before the merge**; it does not make anyone agree with it.

And the third is what the wait costs when it is not enough. **This used to be a click on every pull
request**: the `pull_request_review` re-trigger fired when the review landed, but the triggering actor was
the bot, so GitHub held the run as `action_required` awaiting a maintainer's *Approve and run*. Waiting
inside the `pull_request` run — which is not bot-triggered — removed that trigger and that click. What is
left is the tail: if the budget expires before the round lands, **nothing re-triggers the check** and a
maintainer re-runs the job. The same click as before, and since the three-minute window no longer only in
the case that is already a fault: a round slower than the window needs it too, to be processed, though the
check is already green with a warning. A re-run re-requests Copilot at its first look that reads the
reviews and finds no round on the head, which is where the one re-request moved from the middle of the old
20-minute wait; a look that could not read them does not ask.

**The guarantee is bounded; the process on top of it is now bounded too — 2026-07-28.** Answering
Copilot was made mandatory and unbounded on the same day, and the unbounded half did not survive
contact: **110 Copilot submissions across the 30 most recently merged pull requests, 3.7 each, 29% of
them finding nothing at all, twelve needing four or more.** The length was driven by *pushes* rather than
findings — `review_on_push: true` means every push draws a submission, including documentation-only
ones. _Those four figures are the record's own table, cited rather than re-derived, and they count
**submissions** — the unit that file names. This paragraph headed them "rounds" until 2026-08-09, ten
days after the record re-labelled them and defined a round as a review the working session answers with
a push. The word keeps its ordinary sense elsewhere in this document; what carries the obligation is a
**counted** figure._

**The bound is [`memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md), and this
map cites it rather than restating it.** Rules 1, 2 and 4, what one round is, and the sibling exemption
of 2026-08-07 are stated there. **Where an answer lands — rule 3, and the 2026-08-07 reversal that
made the suppressed channel blocking — moved on 2026-08-10 to
[`memory/an-answer-lands-on-the-thread-that-raised-it.md`](../memory/an-answer-lands-on-the-thread-that-raised-it.md)**,
under proposal `0025`: the two were one file bounding the loop's *length* and one governing the
*channel*, which is two facts in one envelope. The bound's slot 3 keeps its number and points at the
record that now holds it, so *"rule 3"* still names the same rule wherever it is cited. Read them at
the rules, because this map no longer carries a second copy to read instead. Until 2026-08-09 it did, and two of that copy's four clauses had drifted from the file
they were summarising. It said *"threads block but low-confidence notes do not"* — a sentence **rule 3
reversed in place on 2026-08-07**, on the maintainer's ruling of shape 1 of
[`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md), so this map went on denying the
promotion the workflow had already started making. And it stated rule 4's two-fix-round bound flat,
without the sibling exemption ruled the same day. A rule with a second, narrower carrier is obeyed at
the narrower one, which is the class
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names; citing is the repair it
prescribes for prose, and it is what [`dod.md`](../dod.md) conditions 6 and 7 were repaired **into**. A
pointer cannot drift from what it points at, which a summary in another file demonstrably can, for two
days, while the workflow it describes did the opposite. **None of that touches the row in the table
above** — the merge still waits for the round on the merging head, and threads still resolve.

**The round's outcome is now displayed as a review — a derived verdict, 2026-07-29, on the
maintainer's directive.** Copilot cannot say it: the platform submits every Copilot round as a
`COMMENTED` review — never an approval, never a request for changes — by GitHub's deliberate design,
re-checked against its documentation the day this shipped. So
[`../../.github/workflows/copilot-review.yml`](../../.github/workflows/copilot-review.yml) gained a second
step that computes the verdict from the round and has the **agent identity** submit it as a real
review: a clean round is an APPROVE; a round whose only content is suppressed low-confidence notes is
an APPROVE with the notes quoted — *approve with suggestions*, and the body says the approval is not
their disposal, since each note still owes an address-or-refuse reply under the loop rule above; a
round with any inline comment submits nothing, because threads and conversation resolution already
carry findings and a second gate on a gated thing would be machinery pretending to be policy; a notes
channel that could not be read yields no verdict, loudly. Stale approvals are swept before any verdict
branch, on every run that computes one — an approval naming a commit that is no longer the head is
dismissed, and a same-head approval is withdrawn when the newest round stops supporting it (findings,
or a notes channel the step could not read). What this is **not**:
not the merge gate (required approving reviews stay 0 and every merge is the maintainer's), not
required, and not a judgement — *derived, never judged*, the sentence the identity table binds.
App-authored pull requests get no derived verdict, because the platform refuses self-approval; the
weekly librarian pull request's verdict is the maintainer's own review, which it already required. The
observation procedures for each branch, per proposal
[`0007`](../proposals/0007-every-watcher-ships-with-its-observation-procedure.md), live in the step's own
header comment; which branch its shipping pull request exercised live is recorded in that pull
request's body.

**Raising the required count is an option this creates, and it is deliberately not taken here.** "Why
zero required reviews" in [the platform floor](platform-floor.md) records the solo-maintainer arithmetic; a derived approval on
maintainer-authored pull requests plus the maintainer's own review on App-authored ones would cover
both authors *on paper*. Three limits keep that a proposal rather than a setting: whether an
App-submitted approval satisfies the required count is unmeasured on this repository — and not
measurable short of the Gated flip; a round answered by refusal with no further push earns no approval
under the branches above, so a required count would deadlock on exactly the ending the review-loop
bound legitimizes; and the carrier check is itself not yet required (the paragraph below). If the flip
is ever taken it arrives as its own proposal, the
[`0009`](../proposals/0009-a-gate-policy-beside-the-gate-map.md)–[`0011`](../proposals/0011-no-merge-from-behind-main.md)
and [`0015`](../proposals/0015-the-librarian-files-as-the-agent.md) precedent — a settings change with no
proposal behind it is a floor nobody can audit.

**It composes with the autonomy mode; it does not substitute for one.** A mode governs whether the
*agent* raises a ship-step prompt. This is a status check — a floor row once it joins the floor, per the
paragraph below — and floor rows hold at every mode. So under `gated` a merge waits for both the
maintainer's approval and this check; under `auto` the approval prompt is gone and **this check still
waits out its window**. Anyone reading `auto` as *"nothing waits"* should read this row again.

**Not yet required, deliberately** — the same reason as `pr-labeled` before it, from
[`proposals/0004-ci-runs-every-declared-recipe.md`](../proposals/0004-ci-runs-every-declared-recipe.md): a
required context that has never reported blocks every open pull request that does not carry the workflow,
and `enforce_admins` leaves nobody able to force past it. The workflow merges first; it joins the floor
after, by one command that is a repository-settings change and therefore **Gated**.

**A head that never draws a round: merging past this check is an explicit, recorded maintainer act —
ruled 2026-08-09, exit (2) of
[`proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md`](../proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md).**
_Retired 2026-09-23 by [his ruling of 14:07 UTC](../gate-map.md#merge-discipline--the-review-is-awaited-not-just-resolved): a window with no round now ends green with a
warning, so this state has no red left to merge past, and merging without a round is his call. The rest
of this paragraph and the next are the record of the procedure it replaced._
The check can be left holding a state that never clears: on
[#157](https://github.com/sleepy-panda-srl/portulan/pull/157) a rebase force-push drew no round at all
— the re-request was accepted and abandoned — and the pull request merged past the red check on the
maintainer's explicit override. That exception then became the procedure, unchanged in substance: **the
check stayed red**, because a gate that opens itself on an unexplained absence is not a gate, and the
maintainer could merge past it **per occurrence, never as standing permission**, with the act recorded on
the pull request *before* the merge — his own comment, or an agent's via [`tools/gh-bot`](../tools/gh-bot)
quoting his instruction verbatim. **The recording was the difference between an override and a habit.**

The cause is unestablished — authorship is the surviving lead
([#161](https://github.com/sleepy-panda-srl/portulan/issues/161)) — and while it stands the weekly
librarian pass meets this whenever it needs a rebase, so the expected price was **one recorded override
per stranded pass**. _Dated 2026-09-23: the lead now has a documented mechanism. GitHub bills a review on
a bot's pull request, or one a bot requests, to the organisation, and nothing here pays that share.
[`copilot-request.yml`](../../.github/workflows/copilot-request.yml) is the repair, the first bot-authored
pull request after it is the observation, and the retirement condition below stands._ Measured 2026-08-09: the scheduled pass has run **once**, and it stranded. This was
doctrine standing where a rail should eventually stand, and [`../../docs/vision.md`](../../docs/vision.md)'s
*rails, not prose* was conceded rather than contradicted — the rail was the required-context flip above,
declined then **precisely because** it would make a known strand class unmergeable at 06:00 on a
Monday with nobody at a keyboard. It was to be retired when a scheduled pass that needed a rebase drew
its round and merged with no override, when `copilot-reviewed` joined the required contexts, or when
Copilot review left the review path.
