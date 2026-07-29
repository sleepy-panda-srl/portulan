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
| Copilot rounds | **110** across 30 pull requests — **3.7 each** |
| Rounds that found nothing at all | **32 (29%)** |
| Pull requests needing 4+ rounds | **12 of 30** |
| Worst | #49 at nine rounds; #44 and #57 at eight |

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
   general pull-request comment. The thread is the unit the platform resolves and the unit a reader
   opens; an answer that does not sit on it leaves the gate closed and the reader hunting for a summary
   somewhere else on the page. The low-confidence notes in a review *body* carry **no thread and no
   comment id**, so there is nowhere for a reply to sit: they are answered once, in a single batch, as a
   pull-request comment. **That is the exception, not the pattern** — a note is answered in a general
   comment *because the platform gives it nowhere better*, and one batched reply for a round's threads
   would be a choice to answer in the wrong place. They are **never a reason to push again**.
4. **Two fix-rounds, then triage.** After the second round of fixes, whatever remains becomes an issue
   linking the comment. It does not become another push, and it does not hold the merge.

## Why it holds

**The loop's length was driven by pushes, not by findings.** Ruleset `copilot auto-review on pull
requests` carries `review_on_push: true`, so every push spawns a round and the standing rule attached a
survey-and-reply obligation to each one. That is where 29% of all rounds came from — pushes Copilot had
nothing to say about, each still costing a full cycle. Measured on
[#63](https://github.com/sleepy-panda-works/portulan/pull/63): round three was spawned by a **handoff
correction**, a documentation-only push that could not have needed review. Rule 2 exists for that
observation alone.

**And the loop had no fixed point.** Its stopping condition was *"Copilot is silent"*, but every fix is
new input to the next round, so it terminated by luck rather than by convergence. Nine rounds on #49 is
what that looks like. Rules 1 and 4 give it a bound that does not depend on the reviewer running out of
things to say.

**Rule 3 is a calibration fix, not a downgrade.** GitHub itself files those comments as *low
confidence*, and the repository had been treating them exactly like threads. On #63 the four
suppressed notes ran: one correct fix with a wrong diagnosis, two flatly wrong (they claimed jq's
`join` errors on null; it treats null as the empty string), and one genuinely right — a regression the
rewrite had introduced. **They are worth reading. They are not worth blocking on**, and the surfacing
step added by that pull request is what makes reading them cheap enough to keep doing.

## What is deliberately NOT withdrawn

The guarantee. A merge still waits for a Copilot round on the commit it is actually merging
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

**Retire when:** Copilot review stops being part of this repository's review path, or the rounds-per-
pull-request figure is measured below 2.0 for a full milestone, at which point the bound is costing more
attention than the iteration it prevents.
