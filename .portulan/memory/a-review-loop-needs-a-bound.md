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

**A round is a Copilot review the working session answers with a push; rule 4's bound counts those
pushes and nothing else** — the maintainer's ruling; the unit clause, an implementer's derivation, he
ratified verbatim on
[#119](https://github.com/sleepy-panda-works/portulan/pull/119). A records-only push still counts.

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

**The loop was driven by pushes, not findings** — the table's 29%, and #63's third submission: a
**handoff correction**, a documentation-only push that could not have needed review. Rule 2 exists for
that observation.

**The exemption's precedents and stop signal — 2026-08-07** (`0020`). #85 read the bound strictly —
one finding recurred verbatim, rounds three to seven, triaged each time; its issue #91 stayed open
nine days. #164 ran **eleven rounds past** on the maintainer's grant, every round a real defect. The
stop signal is **the taper** — findings growing more marginal, as #164's last three did — the
maintainer's judgement outside the countable bound, like rule 4's *invalid*.

**Rule 3's reversal, 2026-08-07, is argued at the rule** — the measurement that forced it: on #167
**thirteen of twenty-six notes never surfaced**.

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
