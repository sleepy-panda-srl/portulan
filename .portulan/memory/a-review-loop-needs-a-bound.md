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

_Units: every figure counts **submissions** — a Copilot review arriving on a push — never the fix-rounds
rule 4 bounds. Headed "rounds" until 2026-07-30 and **re-labelled, not re-counted**; nobody has re-derived
the corpus in fix-rounds. The retire threshold at the foot of this file is in these same units._

## What one round is — added 2026-07-30

**A round is a Copilot review the working session answers with a push.** Rule 4's bound counts those
pushes and nothing else. **The maintainer's ruling, Marius Cetanas, 2026-07-30** — taken because the four
rules had counted rounds since 2026-07-28 without ever defining one, and because three merged records of
[#105](https://github.com/sleepy-panda-works/portulan/pull/105) disagreed three ways about how many it
received, none matching any countable thing on the pull request.

**The PUSH is the unit.** *Reviews answered* and *pushes that answer* come apart whenever one push
discharges more than one review — on #105, six against five. The push governs, because rule 1's currency
is the push and already requires fixes to be batched, so a push clearing several reviews at once is the
rule working rather than a discount taken. Note the direction: the push unit yields the *smaller* count
there, so it is not simply the stricter reading. A review answered across several pushes costs one round
**per push**. Derived by an implementer, quantified both ways on
[#119](https://github.com/sleepy-panda-works/portulan/pull/119), and put to the maintainer rather than
merged under his name; **he ratified it verbatim — *"yes, push is the unit — that's what I meant"***. The
ratification is recorded as such because a clause an implementer inferred and a clause the maintainer
ruled are different things, and blurring them is the defect this rule protects against.

**A records-only correction counts.** A push fixing nothing but a record still spends a round, because it
is still a push answering a finding. **That clause was ruled the same day**, against the alternative — an
exemption a session could route fixes through. Rule 2 keeps records out of the *middle* of the loop; it
does not make them free when they are the answer.

**What is therefore NOT a round.** Each was counted as one somewhere before that ruling:

- **A submission.** `review_on_push: true` means Copilot reviews every push, so submissions count pushes
  rather than fix-rounds — including the submission on the branch as opened, which precedes any fix.
- **A submission carrying no inline thread.** The suppressed channel carries most of this repository's
  real findings — **17 suppressed notes against 6 inline comments on #85, 11 against 3 on #81**, plus
  #105's `tierRank` fail-open that let an invalid gate policy compile. Counting only threads would make
  the channel that finds the most cost the least, and leave a session free to push indefinitely so long
  as the findings arrived suppressed.
- **A finding, and a reply.** Rule 1 settles both: fixes are batched, so a round is answered once and not
  per finding, and a reply costs nothing.

**Measuring it takes two queries, and the reviewer has two logins.** The findings are in
`/pulls/N/reviews` (the review *bodies*, where suppressed notes live) and `/pulls/N/comments` (the inline
threads); the fix-rounds are in neither — they are the pushes that answered, read from `git log`. **The
reviewer is `copilot-pull-request-reviewer[bot]` on `/reviews` and plain `Copilot` on `/comments`**, and a
filter on either login returns **zero** from the other endpoint — which is how #105's count was first
mis-measured as zero. Measured 2026-07-30 across ten pull requests spanning this project's whole history,
every one returned exactly those two spellings, one per endpoint, with no overlap in either direction.

**Count pushes and then look inside each one; never count the commits the API happened to name.** On #105
one answering push rode inside another and was never a reviewed head, so the branch had ten commits and
eight reviewed heads — and enumerating the reviewed heads counted four where the true figure was five.
**#105 ran three rounds past this bound**, found by a fresh-context checkpoint rather than by the session
that wrote the errata.

**This definition is forward-only from 2026-07-30.** Earlier records are deliberately left alone: at least
ten claims in nine records name a specific pull request, and *"a rule written after a record cannot bind
it without rewriting the record to suit the rule"* — `docs.sh`'s own two record floors are forward-only
cutoffs for that reason. **#105 was corrected because the maintainer directed it**, and that is the whole
licence: contradiction alone would prove too much, since two carriers disagree about #64 and neither
matches its four submissions. #64's pair stands, **named rather than quietly spared** — a cutoff applied
only where nobody is looking is not a cutoff.

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
3. **A thread blocks, and Copilot's findings become threads wherever one can be made — amended in place 2026-08-07.** An
   unresolved thread is the gate (`required_conversation_resolution`), and each one is answered **as a
   reply on that thread** — `POST /repos/{o}/{r}/pulls/{n}/comments/{comment_id}/replies` — never as a
   general pull-request comment. **The gate stays closed until the thread is resolved** — reply
   *placement* never opens it, per rule 1 — so what a misplaced answer costs is not the gate but the two
   things that lead to it: the reader hunting for a summary somewhere else on the page, and whoever
   resolves finding nothing on the thread to judge.

   **The suppressed notes are threads too — where promotion succeeds.** That qualifier is the rule, not
   a caveat on it. [`copilot-review.yml`](../../.github/workflows/copilot-review.yml) promotes each note
   to a comment at its `file:line`, deduplicated on path, line and a checksum, and **a promoted note is
   a reason to push exactly as a thread is** — the sentence this rule previously denied. **Promotion is
   best-effort** — absent App credentials, a failed dedup read, or a line the diff does not carry each
   leave a note surfaced-but-ungated — so **`required_conversation_resolution` does not always cover
   this channel**, and the step's `posted / already present / unattachable` line is what says which
   ([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)).

   _Until 2026-08-07 it read "Threads block; suppressed notes do not" — sound about the notes, wrong
   about the **channel**, which carried no state at all. **The maintainer ruled shape 1** of proposal
   [`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md) with the price measured first:
   **26 threads on one pull request** at #167's ratio, each needing his resolution._
4. **Two fix-rounds, then triage.** After the second round of fixes, whatever remains becomes an issue
   linking the comment. It does not become another push, and it does not hold the merge.
   **A round whose finding is a SIBLING of an earlier round's fix does not spend the bound — added
   2026-08-07.** *Sibling* is operational so the count stays re-derivable from the diffs after the fact,
   which is the property the 2026-07-30 definition bought and this file calls the half that closed:

   > a finding whose governing rule was already **enforced at another site of the same operation** — in
   > this change or in the tree — when the defect was written.

   **This file is that definition's one carrier**; proposal
   [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) quotes it rather than
   restating it. _(Both shipped for one round, this one broader — and broad is unusable, not merely
   loose: a rule that merely EXISTS somewhere makes nearly every finding a sibling, repealing the bound
   while claiming to buy rounds. Fable 5 on #168, in the change about one rule with two carriers.)_
   The exemption exists because this class *generates its own next round*: a sibling of round
   N's fix cannot surface before round N+1, so a bound that counts pushes retires the loop exactly where
   the class is still producing. Measured on
   [#164](https://github.com/sleepy-panda-works/portulan/pull/164) under the narrow test: **eight of its
   thirteen rounds** were siblings, six of them after the bound. The exemption **buys rounds and does not
   remove the gate** — every extension past two is still the maintainer's to grant and never the
   session's to assume, as it was granted on #160, #163 and #164 one at a time.

## Why it holds

**The loop's length was driven by pushes, not by findings.** `review_on_push: true` spawns a
**submission** per push, and the standing rule attached a survey-and-reply obligation to each one — which
is where 29% of all submissions came from, pushes Copilot had nothing to say about, each still costing a
full cycle. Measured on [#63](https://github.com/sleepy-panda-works/portulan/pull/63): its third
submission was spawned by a **handoff correction**, a documentation-only push that could not have needed
review. Rule 2 exists for that observation alone.

**Rule 2 protects something bigger than a wasted submission, measured on #105.** Its records landed
**second** and were patched three times as the loop ran, leaving three merged carriers disagreeing — two,
three and two — against a true figure of five, so **no carrier was right and the two that agreed were both
wrong**. That is not three misreadings of one fact; it is the mechanical consequence of **writing a record
while the number it states can still move**, and the errata is permanent. Rule 2 is not the soft one.

**And the loop had no fixed point.** Its stopping condition was *"Copilot is silent"*, but every fix is
new input to the next submission, so it terminated by luck rather than by convergence. **Nine submissions
on #49** is what that looks like.

**What the sibling exemption costs, and the two precedents it chooses between — added 2026-08-07.** The
bound and the exemption pull opposite ways, so the choice is stated rather than smoothed.
[#85](https://github.com/sleepy-panda-works/portulan/pull/85) read the bound strictly: one finding arrived
verbatim in **rounds three through seven** and was triaged each time rather than pushed — correct under
rule 4 as written, and the product of that triage,
[#91](https://github.com/sleepy-panda-works/portulan/issues/91), then **stayed open nine days**, with the
change that finally closed it recurring the same class inside its own fix. #164 read it the other way and
ran **eleven rounds past** on the maintainer's grant each time, every one of them finding a real defect.
So triage is not a free disposal: it is a deferral whose measured half-life here is *indefinite*, and the
exemption is the judgement that deferring a sibling of the rule **currently under repair** is the worse of
the two false economies. What it must not become is a licence to run forever, and the stop signal is **the
taper** — findings growing progressively more marginal, as #164's last three did. That reading is a
judgement no check can make, so it stays **outside the countable bound and belongs to the maintainer**,
exactly as rule 4's *invalid* judgement does. The round count says how long the loop has run; only the
taper says whether it is done.

**Rule 3 was a calibration fix, reversed 2026-08-07 — argued at the rule, not restated here.** The shape
of the mistake is what belongs at this altitude: right about the *notes* (two of #63's four were flatly
wrong) and wrong about the *channel*. *Read them, do not block* holds only where reading is guaranteed,
and on [#167](https://github.com/sleepy-panda-works/portulan/pull/167) thirteen of twenty-six never
surfaced at all.

## What is deliberately NOT withdrawn

The guarantee. A merge still waits for a Copilot **submission** on the commit it is actually merging — a
submission and never a fix-round, since what is owed is that the reviewer has *looked* at the merging
commit, which a submission finding nothing satisfies and a fix-round cannot satisfy at all
([`a-review-is-awaited-not-just-resolved.md`](a-review-is-awaited-not-just-resolved.md)) — and still
requires threads resolved. That half is cheap: 125s and 3m12s measured on #63, with no maintainer click.
What this rule bounds is the *process* built on top of it, which nobody ruled and which grew on its own.

**Nothing checks this rule.** It is prompt-level discipline and should be read as such rather than as a
rail — [`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md)
applies to it as much as to anything else here. Rules 1 and 2 are mechanisable (a workflow can count
pushes since the last round, or refuse a push touching only `handoffs/` while a round is outstanding);
rule 4 needs the *invalid* judgement no check can make. The 2026-07-30 definition does not change that —
*did this push answer a finding* is the same judgement — but it changes what a human can audit: the count
is **re-derivable after the fact** from `git log` and the two endpoints, which is how #105 was found to be
three rounds over. An unmechanisable rule whose compliance cannot be checked even in hindsight is not a
habit with a record; it is a number nobody can dispute. That was the actual gap, and it is the half that
closed.

**Retire when:** Copilot review stops being part of this repository's review path, or the
**submissions-per-pull-request** figure is measured below 2.0 — **the submission units of the table above,
not fix-rounds** (this metric was named "rounds-per-pull-request" until 2026-07-30; renamed with the
definition, threshold unchanged) — for a full milestone, at which point the bound is costing more attention
than the iteration it prevents.
