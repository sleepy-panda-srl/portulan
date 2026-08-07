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
section down, in the same breath as the 29%: those were "pushes Copilot had nothing to say about", which a fix-round
cannot be, since a fix-round is a push answering something. **Re-labelled, not re-counted** — the figures
are as measured on 2026-07-28 and nobody has re-derived the corpus in fix-rounds. The retire threshold at
the foot of this file is in these same submission units._

## What one round is — added 2026-07-30

**A round is a Copilot review the working session answers with a push.** Rule 4's bound counts those pushes
and nothing else. **The maintainer's ruling, Marius Cetanas, 2026-07-30**, taken because the four rules below
had been counting rounds since 2026-07-28 without ever defining one — and because three merged records of
[#105](https://github.com/sleepy-panda-works/portulan/pull/105) had by then disagreed three ways about how
many it received, none of them matching any countable thing on the pull request. _(Phrased "the working
session" rather than "this session": a rule outlives the session that wrote it, and an indexical in a
permanent definition means something different to every later reader.)_

**The PUSH is the unit, and that sentence is load-bearing rather than a restatement.** *Reviews answered* and
*pushes that answer* come apart whenever one push discharges more than one review — which #105 does:
**`c6b6a25` answered suppressed notes from two separate reviews at once**, the provenance path raised at
15:29:27Z and the `tierRank` fail-open raised at 15:58:20Z. Counting reviews-answered gives **six** there;
counting answering pushes gives **five**. **The push governs** — because rule 1's currency is the push
(*"a push costs a whole round"*), because rule 4 bounds pushes, and because rule 1 already requires fixes to
be batched, so a push that clears several reviews at once is the rule working rather than a discount being
taken. **Note the direction, since it is not what you would guess:** here the push unit yields the *smaller*
count, so it is not simply the stricter reading — it is the one the rest of the file already prices.
Correspondingly, a review answered across several pushes costs one round **per push**.

**This clause was derived rather than dictated, and then ratified.** It was added 2026-07-30 after the first
fresh-context re-derivation of #105 returned a different number from the errata's and the gap turned out to
be the unit rather than the arithmetic. It was written as a derivation, flagged as one on
[#119](https://github.com/sleepy-panda-works/portulan/pull/119) with the alternative quantified (on the
review reading #105 is **six**, on the push reading **five**), and put to the maintainer rather than merged
under his name. **He ratified it verbatim on 2026-07-30 — *"yes, push is the unit — that's what I meant"*** —
so the sentence now carries the same authority as the rest of the definition. Recorded this way because the
distinction it turns on is the one this whole rule exists to protect: a clause an implementer inferred and a
clause the maintainer ruled are different things, and a record that blurs them is the defect, not the tidy
version.

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
answered them** — `d814e0a`, `9c19064`, `e09a49a`, `a328ebf` (carrying `08d7d10`), and `c6b6a25` — so #105 ran
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
A grep for a numeric round count matches **seventeen** records across **33 lines**; of those, **at least ten
claims in nine records** name a specific pull request. **A floor rather than a figure, deliberately:** these
are prose claims that wrap across lines, so any line-based grep undercounts them — `docs/plan.md`'s
2026-07-26 entry states one and is invisible to the filter because *"on the pull request"* straddles a line
break. **All three attempts at this census were wrong in the same way**, and the third is why the number is
given as a bound: the pattern kept being narrower than the claim it was testing — first missing whole
records, then missing every claim whose pull-request number sat **inside a markdown link** rather than bare,
so that `on #73` matched and the linked form did not. **That is the standing
hazard in auditing prose rather than code**, and it is the same shape as the miscount this whole change
exists to correct: a method that can only see the well-formed instances reports the rest as absent.
**Not correcting them is this
repository's own rule about rules:** both record floors in `docs.sh` are forward-only cutoffs, *"because a
rule written after a record cannot bind it without rewriting the record to suit the rule."* A definition
reaches further than a rule, though — it changes how a reader parses old text rather than what an old author
owed — so the cutoff is stated here rather than left to be inferred from the uncorrected claims themselves.

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
   **A round whose finding is a SIBLING of an earlier round's fix does not spend the bound — added
   2026-08-07.** *Sibling* is operational so the count stays re-derivable from the diffs after the fact,
   which is the property the 2026-07-30 definition bought and this file calls the half that closed: a
   finding whose governing rule **already existed elsewhere** — in this change or in the tree — when the
   defect was written. The exemption exists because this class *generates its own next round*: a sibling
   of round N's fix cannot surface before round N+1, so a bound that counts pushes retires the loop
   exactly where the class is still producing. Measured on
   [#164](https://github.com/sleepy-panda-works/portulan/pull/164): **eight of its thirteen rounds** were
   siblings by this test, six of them after the bound. The exemption **buys rounds and does not remove
   the gate** — every extension past two is still the maintainer's to grant and never the session's to
   assume, as it was granted on #160, #163 and #164 one at a time.

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

**Rule 2 turned out to protect something bigger than a wasted submission, measured 2026-07-30 on #105.** Its
records landed **second** — before a single fix round had been pushed — were patched **three times** as the
loop ran, and still stopped one push short of the end. The result was three merged carriers disagreeing about how
many rounds the pull request had received — two, three and two, and the true figure was five, so **no
carrier was right, and the two that agreed were both wrong**. **That is not three misreadings of
one fact; it is the mechanical consequence of writing a record while the number it states can still
move.** Had the records landed after the final push they would have been written once and all three would
have agreed. So rule 2's cost is not only the submission a documentation push spawns — it is that a record
written mid-loop is *a claim about a total that has not happened yet*, and the errata to fix it is
permanent. Read this as the reason rule 2 is not the soft one of the four.

**And the loop had no fixed point.** Its stopping condition was *"Copilot is silent"*, but every fix is
new input to the next submission, so it terminated by luck rather than by convergence. **Nine submissions
on #49** — the figure the table above carries in the same unit — is what that looks like. Rules 1 and 4
give it a bound that does not depend on the reviewer running out of things to say.

**What the sibling exemption costs, and the two precedents it is choosing between — added 2026-08-07.**
The bound and the exemption pull opposite ways and the record already contains both readings, so the
choice is stated rather than smoothed. [#85](https://github.com/sleepy-panda-works/portulan/pull/85) read
the bound strictly: the same finding arrived verbatim in **rounds three through seven** and was triaged
each time rather than pushed — correct under rule 4 as written, and the product of that triage is
[#91](https://github.com/sleepy-panda-works/portulan/issues/91), which then **stayed open nine days**
(filed 2026-07-29, closed 2026-08-07 by [#166](https://github.com/sleepy-panda-works/portulan/pull/166))
— and the change that finally closed it recurred the same class inside its own fix, caught by Copilot's
first round. _(This sentence read "still open" until the hour #166 merged, which is the live-fact class
the pre-commit checkpoint exists for; corrected in the open rather than quietly.)_

#164 read it the other way and ran **eleven rounds past**, on the
maintainer's grant each time, and every one of those rounds found a real defect. So triage is not a free
disposal: it is a deferral whose measured half-life here is *indefinite*, and the sibling exemption is
the judgement that deferring a sibling of the rule **currently under repair** is the worse of the two
false economies. What the exemption must not become is a licence to run forever, and the stop signal is
**the taper** — findings growing progressively more marginal, as #164's last three did (a directory named
`README.md`, a FIFO in a workspace). That reading is a judgement no check can make, so it stays
**deliberately outside the countable bound and belongs to the maintainer**, exactly as rule 4's *invalid*
judgement does. The round count says how long the loop has run; only the taper says whether it is done.

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
and the two endpoints, which is how #105 was found to be three rounds over. An unmechanisable rule whose
compliance cannot even be checked in hindsight is not a habit with a record; it is a number nobody can
dispute. That was the actual gap, and it is the half that closed.

**Retire when:** Copilot review stops being part of this repository's review path, or the
**submissions-per-pull-request** figure is measured below 2.0 — **the submission units of the table above,
not fix-rounds** (this metric was named "rounds-per-pull-request" until 2026-07-30; renamed with the
definition, threshold unchanged) — for a full milestone, at which point the bound is costing more attention
than the iteration it prevents.
