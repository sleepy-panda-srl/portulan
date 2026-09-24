**type:** rule
**dated:** 2026-09-24
**scope:** workspace — every pull request here
**provenance:** `form=link` `href=8a33f9b:.portulan/handoffs/2026-07-28-awaiting-a-review-is-not-a-failure.md`
— the maintainer, 2026-07-28: the loop *"can grow out of hand; it hinders development more than it
helps"*, and *"is a must and must be upheld"*. Both stand.

A **round** is a Copilot review the working session answers with a push, records-only too
(see `git show 8a33f9b:.portulan/handoffs/2026-07-30-a-round-gets-its-definition.md`).

1. **One push per round**, fixes batched. Each thread is still answered; only the maintainer's
   resolving opens the gate ([gate map](../gate-map.md)).
2. **Records land last**: in the final push or after the merge, never between rounds.
3. **Moved** to [its record](an-answer-lands-on-the-thread-that-raised-it.md).
4. **Two fix-rounds, then triage**: the rest becomes an issue and holds no merge. A **sibling** of an
   earlier fix spends nothing. Its one definition, worded to re-derive from diffs:

   > a finding whose governing rule was already **enforced at another site of the same operation** — in
   > this change or in the tree — when the defect was written.

   Siblings surface a round late: counting them ends the loop where the class still produces.
   Rounds past two are his grant ([0020](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)).

**Why it holds:** pushes, not findings, drove the loop: 110 submissions on 30 pull requests, 29% finding
nothing. A records push between rounds buys a needless round, and a record the next falsifies (#366);
rule 2 reopens only after #355 and #124 close, on 20 pull requests where such pushes out-find answering
ones, net of what they break. **Nothing checks it — discipline, not a rail**
([why](a-mandate-nothing-checks-is-already-broken.md)).

**Retire when:** Copilot leaves the review path, or submissions (not fix-rounds) per pull request measure
below 2.0 for a full milestone: the bound then costs more than it prevents.
