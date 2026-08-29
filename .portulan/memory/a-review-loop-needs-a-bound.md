# A review loop needs a bound

**type:** rule
**scope:** workspace — every pull request against this repository
**provenance:** `form=link` `href=../handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md`
— the maintainer's rulings, Marius Cetanas, 2026-07-28, taken the same day: *"this feedback loop can
grow out of hand; it hinders development more than it helps"*, and *"this feedback loop process is a
must and must be upheld moving forward"*. Both stand: the obligation to answer Copilot is not
withdrawn, the unbounded iteration is.

| Measure | Over the 30 most recently merged pull requests |
|---|---|
| Copilot **submissions** | **110** across 30 pull requests — **3.7 each** |
| Submissions that found nothing at all | **32 (29%)** |
| Pull requests needing 4+ submissions | **12 of 30** |
| Worst | #49 at nine submissions; #44 and #57 at eight |

_Units: every figure counts **submissions** — a review arriving on a push, including on the branch as
opened — never the fix-rounds rule 4 bounds; headed "rounds" until 2026-07-30, **re-labelled, not
re-counted**, never re-derived in fix-rounds._

## What one round is — 2026-07-30

**A round is a Copilot review the working session answers with a push, and rule 4's bound counts those
pushes and nothing else** — the maintainer's ruling. Its *unit* clause was an implementer's derivation,
quantified both ways on [#119](https://github.com/sleepy-panda-srl/portulan/pull/119) and put to him
rather than merged under his name, and **he ratified it verbatim**. The two are recorded apart because
blurring a clause an implementer inferred with one he ruled is the defect this rule guards against. A
records-only push still counts.

**The reviewer has two logins** — `copilot-pull-request-reviewer[bot]` on `/pulls/N/reviews`,
`Copilot` on `/pulls/N/comments` — and a filter on either returns **zero** from the other. Fix-rounds
live in `git log`, in neither endpoint: **count pushes and then look inside each one; never count the
commits the API happened to name.** On #105 an answering push rode inside another — ten commits, eight
reviewed heads, four counted against a true five; the loop ran **three rounds past the bound**.
Forward-only from 2026-07-30, and #64's two disagreeing carriers are named there rather than spared; in
full: [`2026-07-30-a-round-gets-its-definition.md`](../handoffs/2026-07-30-a-round-gets-its-definition.md).

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
3. **Moved — 2026-08-10, proposal `0025`.** Where an answer lands is the **channel's** fact, not the
   loop's, so it is its own record:
   [`an-answer-lands-on-the-thread-that-raised-it.md`](an-answer-lands-on-the-thread-that-raised-it.md).
   Cited rather than restated, per [`../gate-map.md`](../gate-map.md). The slot keeps its number so
   *"rule 3"* — cited from `0021` and from `copilot-review.yml` — still names the rule it always named.
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
   [#164](https://github.com/sleepy-panda-srl/portulan/pull/164) under the narrow test: **eight of its
   thirteen rounds** were siblings, six of them after the bound. The exemption **buys rounds and does not
   remove the gate** — every extension past two is still the maintainer's to grant and never the
   session's to assume, as it was granted on #160, #163 and #164 one at a time.

## Why it holds

**The loop was driven by pushes, not findings** — the table's 29%, and #63's third submission: a
**handoff correction**, a documentation-only push that could not have needed review. Rule 2 exists for
that observation.

**Rule 2's second, stronger reason — [#366](https://github.com/sleepy-panda-srl/portulan/pull/366),
2026-08-28, which measured it by breaking rule 2 three times.** The first reason is *waste*; this is
*correctness*. **A records push between rounds writes the loop's record while the loop is still running,
so it is false the moment another round lands — and the review the push buys does not catch it.**
#366's first such push claimed the bound was *"never approached"* when it had been **exceeded**;
four later submissions passed over it in silence. **It caught one stale figure and created one
false claim, same commit** — net zero at best, in the record a later reader most trusts.

_Asked and answered: **relax rule 2 to buy more passes?** — **no**, 2026-08-28. The premise holds — a
push is the only reliable way to draw one ([#348](https://github.com/sleepy-panda-srl/portulan/issues/348))
— but the inference never priced the second effect. **Reopen on evidence:** over ≥20 pull requests,
findings-per-submission for answering versus non-answering pushes, net of the defects the latter
introduce; #355 and #124 close first._

**The exemption's precedents and stop signal — 2026-08-07**
([`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)). #85 read the bound strictly —
one finding recurred verbatim, rounds three to seven, triaged each time; its issue #91 stayed open
nine days. #164 ran **eleven rounds past** on the maintainer's grant, every round a real defect. The
stop signal is **the taper** — findings growing more marginal, as #164's last three did — the
maintainer's judgement outside the countable bound, like rule 4's *invalid*.

**Not withdrawn: the guarantee.** A merge still waits for a Copilot **submission** on the commit it
merges — never a fix-round
([`a-review-is-awaited-not-just-resolved.md`](a-review-is-awaited-not-just-resolved.md)); this bounds
only the process on top. **Nothing checks it** — discipline, not a rail
([`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md));
since 2026-07-30 the count is **re-derivable after the fact** — how #105's overrun was found; the half
that closed.

**Retire when:** Copilot review leaves the review path, or **submissions-per-pull-request** — **the
submission units of the table above, not fix-rounds** — measures below 2.0 for a full milestone: the
bound then costs more than it prevents.
