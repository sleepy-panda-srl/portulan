# A review loop needs a bound

**type:** rule
**scope:** workspace — every pull request opened against this repository
**provenance:** `form=link` `href=../handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-28: *"this feedback loop can grow out of hand; it
hinders development more than it helps"*, taken **the same day** he made the loop mandatory
(*"this feedback loop process is a must and must be upheld moving forward"*). Both rulings stand: the
obligation to answer Copilot is not withdrawn, the unbounded iteration is.

**The measurement that changed it**, over the 30 most recently merged pull requests:

| Measure | Over the 30 most recently merged pull requests |
|---|---|
| Copilot **submissions** | **110** across 30 pull requests — **3.7 each** |
| Submissions that found nothing at all | **32 (29%)** |
| Pull requests needing 4+ submissions | **12 of 30** |
| Worst | #49 at nine submissions; #44 and #57 at eight |

_Units — the rows above were headed "rounds" until 2026-07-30 and are re-headed here, because the
definition below put them in different units than the rule they justify: every figure counts
**submissions** — a Copilot review arriving on a push — and not the fix-rounds rule 4 bounds. The
numbers are untouched; only the unit they were always in is now named. The file says so itself one
section down, in
the same breath as the 29%: those were "pushes Copilot had nothing to say about", which a fix-round
cannot be, since a fix-round is a push answering something. **Re-labelled, not re-counted** — the numbers
are as measured on 2026-07-28 and nobody has re-derived the corpus in fix-rounds. The retire threshold at
the foot of this file is in these same submission units._

## What one round is — added 2026-07-30

**A round is a Copilot review this session answers with a push.** Rule 4's bound counts those pushes and
nothing else. **The maintainer's ruling, Marius Cetanas, 2026-07-30**, taken because the four rules below
had been counting rounds since 2026-07-28 without ever defining one — and because three merged records of
[#105](https://github.com/sleepy-panda-works/portulan/pull/105) had by then disagreed three ways about how
many it received, none of them matching any countable thing on the pull request.

**The PUSH is the unit, and that sentence is load-bearing rather than a restatement.** *A review answered
with a push* and *the pushes that answer* come apart the moment one review is answered across two pushes,
which is not hypothetical: on #105 review 4 raised an inline finding and a suppressed one, and they were
answered by **different** pushes five and thirty-four minutes apart. Counting reviews-answered gives six
there; counting answering pushes gives five. **The push governs, so a review answered across several pushes
costs one round per push** — because rule 1's currency is the push (*"a push costs a whole round"*) and
rule 4 bounds pushes, and because the alternative lets a session split one answer across many pushes and be
charged once. Added 2026-07-30 after the first fresh-context re-derivation of #105 returned a different
number from the errata's, and the gap was this unit and not the arithmetic.

**A records-only correction counts.** A push that fixes nothing but a record — a figure the reviewer caught
disagreeing with itself across carriers — still spends a round, because it is still a push answering a
finding. Ruled the same day against the alternative, which was an exemption a session could route fixes
through. Rule 2 keeps records out of the *middle* of the loop; it does not make them free when they are
the answer.

**What is therefore NOT a round.** Each of these was counted as one somewhere before today:

- **A submission.** `review_on_push: true` means Copilot reviews every push, so submissions count pushes
  rather than fix-rounds — including the submission on the branch as opened, which precedes any fix.
- **A submission carrying no inline thread.** The suppressed channel carries most of this repository's real
  findings — **17 suppressed notes against 6 inline comments on #85, and 11 against 3 on #81**, plus on #105
  the `tierRank` fail-open that let an invalid gate policy compile. A definition counting only threads would
  make the channel that finds the most cost the least, and would leave a session free to push indefinitely
  so long as the findings arrived suppressed. _(Those two figures were carried in this repository's memory
  as "14 of 19" and "9 of 11" and are **replaced by a re-measurement of 2026-07-30**, counting suppressed
  notes from the `Comments suppressed due to low confidence (N)` headers and inline comments from
  `/comments`. The old pair reproduces under no method anyone stated, and it was propagated into this rule
  unre-derived — in a rule whose whole subject is that a count needs a named unit. Both readings support
  "most"; only one of them can be checked.)_
- **A finding, and a reply.** Rule 1 settles both already: fixes are batched, so a round is answered once
  and not per finding, and a reply costs nothing.

**Measuring it takes two queries, and the reviewer has two logins.** The findings are in
`/pulls/N/reviews` (the review *bodies*, which is where suppressed notes live) and `/pulls/N/comments`
(the inline threads). The fix-rounds are not in the API at all — they are the pushes that answered, read
from `git log`. **The reviewer is `copilot-pull-request-reviewer[bot]` on `/reviews` and plain `Copilot`
on `/comments`**: a filter on either login returns **zero** from the other endpoint, which is how #105's
count was first mis-measured as zero. **Measured 2026-07-30 across ten pull requests spanning this
project's whole history** — #44, #49, #57, #63, #81, #85, #95, #105, #115, #119 — and every one returns
exactly those two spellings, one per endpoint, with no overlap in either direction.

**Two carriers here read as contradicting that, and do not.**
[`copilot-review.yml`](../../.github/workflows/copilot-review.yml)'s header records
`copilot-pull-request-reviewer[bot]` as "raising threads on #44", and [`../gate-map.md`](../gate-map.md)
says the same of that pull request. Both name the **actor** that raised the thread, identified by the login
its *review* carries — neither is a claim about what `/comments` returns for it, and on #44 `/comments`
returns `Copilot` like everywhere else. The workflow matches on `/reviews` and never queries `/comments`,
so its own behaviour is unaffected either way; both spellings are in its list, which is why a rename shows
up as a red rather than as silence. **Recorded because the near-contradiction is what a hand-counter meets
first** — it was raised against this very rule in review and cost a measurement to settle.

**Measured on #105, the pull request that forced the definition.** Eight submissions, all `COMMENTED`,
each on a distinct commit, and **not one of them empty** — every submission carried at least one finding
once the suppressed channel is read. Two carried inline threads (three findings, then one). **Five pushes
answered them** — `d814e0a`, `9c19064`, `e09a49a`, the push carrying `08d7d10`, and `c6b6a25` — so #105 ran
**three rounds past this bound**.

**The fifth push is the one a careless count loses, and losing it is instructive.** `08d7d10` answered
review 4's inline finding — a `filePath` description claiming a containment its pattern did not deliver —
and it was **never a reviewed head**: it rode inside the push whose head Copilot reviewed next. So the
branch has **ten commits on `main` and only eight reviewed heads**, and any count that enumerates the
reviewed heads and reads their subjects — which is how this was first counted as four — cannot see it.
**Count pushes and then look inside each one; do not count the commits the API happened to name.** Found by
the fresh-context pre-commit checkpoint, not by the session that wrote the errata.
It was not knowably over at the time, because the definition did not exist until today; that is what makes
the correction to its three records errata rather than a fault, and it is recorded that way in
[the handoff](../handoffs/2026-07-29-the-cascade-gets-its-middle-layer.md) and the Session log.

**This definition is forward-only, from 2026-07-30, and every earlier record is deliberately left alone.**
A grep for a numeric round count matches **seventeen** records in this tree; **nine** of them state a count
for a *specific* pull request, carrying **twelve** such claims — `docs/plan.md` (three), and one or two each
in [`../verify/README.md`](../verify/README.md) and seven handoffs. **Not correcting them is this
repository's own rule about rules:** both record floors in `docs.sh` are forward-only cutoffs, *"because a
rule written after a record cannot bind it without rewriting the record to suit the rule."* A definition
reaches further than a rule, though — it changes how a reader parses old text rather than what an old author
owed — so the cutoff is stated here rather than left to be inferred from twelve uncorrected claims.

**An earlier draft of this paragraph said "four records" and gave a ground that would not hold.** It claimed
#105 was corrected because *its carriers contradicted each other*, and that a lone earlier record
"contradicts nothing". Both halves failed the fresh-context check. The census was four because the sweep
used a narrower pattern than the claim it was testing. And the contradiction ground **proves too much**:
[`../verify/README.md`](../verify/README.md) says *"Two Copilot rounds on #64"* while
[the jq handoff](../handoffs/2026-07-28-every-jq-filter-a-workflow-runs-is-exercised.md) says *"One Copilot
round on #64"* — two merged carriers, one pull request, different numbers, and **#64 in fact drew four
submissions**, so neither is even the submission count. That is #105's exact shape. If contradiction alone
licensed the correction, #64 would be owed one too.

**So the honest ground is narrower and is stated as such: #105 was corrected because the maintainer directed
it.** The three-way disagreement is why the directive was warranted, not an independent licence — and #64's
pair is left standing under the forward-only cutoff, **named here rather than quietly spared**, because a
cutoff that only ever gets applied where nobody is looking is not a cutoff. Anyone minded to correct #64
needs a ruling first, exactly as #105 did.

## The rule

1. **One push per round.** Fixes are batched; a round is answered once, not per finding. **This bounds
   pushes, not replies** — every thread still gets its own, per rule 3. The two are different currencies:
   a push costs a whole round; a reply costs nothing. **A reply is not itself the gate.**
   `required_conversation_resolution` clears when a thread is **resolved**, and resolving is a judgement
   that a point is settled — [`../gate-map.md`](../gate-map.md) makes it the maintainer's, travelling with
   his merge approval and never ahead of it. The reply is what the loop obliges; the resolution is what
   opens the gate, and they are not the same act or the same person's.
2. **Records land last.** The handoff and the `docs/plan.md` Session log go in the final push or after
   the merge — never between rounds.
3. **Threads block; suppressed notes do not — and they are answered in different places.** An
   unresolved thread is the gate (`required_conversation_resolution`), and each one is answered **as a
   reply on that thread** — `POST /repos/{o}/{r}/pulls/{n}/comments/{comment_id}/replies` — never as a
   general pull-request comment. **The gate stays closed until the thread is resolved** — reply
   *placement* never opens it, per rule 1 — so what a misplaced answer costs is not the gate but the two
   things that lead to it: the reader hunting for a summary somewhere else on the page, and whoever
   resolves finding nothing on the thread to judge. The low-confidence notes in a review *body* carry
   **no thread and no comment id**, so there is nowhere for a reply to sit: they are answered once, in
   a single batch, as a pull-request comment. **That is the exception, not the pattern** — a note is
   answered in a general comment *because the platform gives it nowhere better*, and one batched reply
   for a round's threads would be a choice to answer in the wrong place. They are **never a reason to
   push again**.
4. **Two fix-rounds, then triage.** After the second round of fixes, whatever remains becomes an issue
   linking the comment. It does not become another push, and it does not hold the merge.

## Why it holds

**The loop's length was driven by pushes, not by findings.** Ruleset `copilot auto-review on pull
requests` carries `review_on_push: true`, so every push spawns a **submission** and the standing rule
attached a survey-and-reply obligation to each one. That is where 29% of all **submissions** came from —
pushes Copilot had nothing to say about, each still costing a full cycle. Measured on
[#63](https://github.com/sleepy-panda-works/portulan/pull/63): its third **submission** was spawned by a
**handoff correction**, a documentation-only push that could not have needed review. Rule 2 exists for that
observation alone. _(This paragraph said "round" in all three places until 2026-07-30. Every one of them
meant a submission — a fix-round cannot be a push Copilot had nothing to say about — so they are re-worded,
not re-measured, exactly as the table above was.)_

**Rule 2 turned out to protect something bigger than a wasted round, measured 2026-07-30 on #105.** Its
records landed **second** — before a single fix round had been pushed — were patched twice as the loop ran,
and still stopped one push short of the end. The result was three merged carriers disagreeing about how
many rounds the pull request had received — two, three and two, and the true figure was five, so **no
carrier was right and no two carriers agreed**. **That is not three misreadings of
one fact; it is the mechanical consequence of writing a record while the number it states can still
move.** Had the records landed after the final push they would have been written once and all three would
have agreed. So rule 2's cost is not only the round a documentation push spawns — it is that a record
written mid-loop is *a claim about a total that has not happened yet*, and the errata to fix it is
permanent. Read this as the reason rule 2 is not the soft one of the four.

**And the loop had no fixed point.** Its stopping condition was *"Copilot is silent"*, but every fix is
new input to the next submission, so it terminated by luck rather than by convergence. **Nine submissions
on #49** — the figure the table above carries in the same unit — is what that looks like. Rules 1 and 4
give it a bound that does not depend on the reviewer running out of things to say.

**Rule 3 is a calibration fix, not a downgrade.** GitHub itself files those comments as *low
confidence*, and the repository had been treating them exactly like threads. On #63 the four
suppressed notes ran: one correct fix with a wrong diagnosis, two flatly wrong (they claimed jq's
`join` errors on null; it treats null as the empty string), and one genuinely right — a regression the
rewrite had introduced. **They are worth reading. They are not worth blocking on**, and the surfacing
step added by that pull request is what makes reading them cheap enough to keep doing.

## What is deliberately NOT withdrawn

The guarantee. A merge still waits for a Copilot **submission** on the commit it is actually merging —
a submission and never a fix-round, since what is owed there is that the reviewer has *looked* at the
merging commit, which is satisfied by a submission that finds nothing and could not be satisfied by a
fix-round at all —
([`a-review-is-awaited-not-just-resolved.md`](a-review-is-awaited-not-just-resolved.md)) and still
requires threads resolved. That half is cheap — measured at 125s and 3m12s on #63, with no maintainer
click — and it is the half the maintainer's 2026-07-27 ruling was actually about. What this rule bounds
is the *process* built on top of it, which nobody ruled and which grew on its own.

**Nothing checks this rule.** It is prompt-level discipline, and it should be read as such rather than
as a rail — [`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md)
applies to it as much as to anything else here. Rules 1 and 2 are mechanisable (a workflow can count
pushes since the last round, or refuse a push touching only `handoffs/` while a round is outstanding);
rule 4 needs the *invalid* judgment that no check can make. Until then this is a habit with a record,
and the record is honest about which it is.

**The 2026-07-30 definition does not change that, but it does change what a human can audit.** Rule 4 is
still not mechanisable — *did this push answer a finding* is the same judgment as before, and a machine
counting pushes since the first submission would charge the bound for pushes that answered nothing. What
the definition buys is that the count is now **re-derivable after the fact** by a reader with `git log`
and the two endpoints, which is how #105 was found to be two rounds over. An unmechanisable rule whose
compliance cannot even be checked in hindsight is not a habit with a record; it is a number nobody can
dispute. That was the actual gap, and it is the half that closed.

**Retire when:** Copilot review stops being part of this repository's review path, or the rounds-per-
pull-request figure is measured below 2.0 **in the submission units of the table above, not in fix-rounds**
(the units clause was added 2026-07-30 with the definition; the threshold itself is unchanged) for a full
milestone, at which point the bound is costing more attention than the iteration it prevents.
