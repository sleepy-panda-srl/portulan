# Handoff — the consolidation nobody finished

**Off the milestone row. Full lane** — a doctrine record, and the one this repository's review process
runs on. Pull request [#202](https://github.com/sleepy-panda-works/portulan/pull/202), taken over from an
abandoned branch on the maintainer's instruction to complete or discard it.

## What was found

`migrate-the-review-loop-record` was one commit ahead of `main`, pushed, with a clean worktree, **no pull
request**, and nineteen commits of drift. Its session stopped after committing. It is the **third layer**
of a consolidation whose second pass (`789a2b0`) is already merged.

**Discarding was the wrong call, and the number is why.** The store stood at **121,416 of 122,880 bytes
— 1,464 of headroom**, with `.portulan/memory/a-review-loop-needs-a-bound.md` the largest record in it.
The branch takes that record from **15,879 → 8,654** and the store to **114,191**, so headroom goes
**1,464 → 8,689**. The alternative to finishing it was doing it again.

_Units and method, because this file's own subject record exists partly because a figure went unstated:
bytes are `Buffer.byteLength` summed over `.portulan/memory/*.md`, which is what `cli/index.mjs` budgets,
and the budget is `memory.store.budget.kilobytes: 120` at `KB = 1024`. Re-derivable per commit:
`15,879 · 121,416` on `main`, `8,361 · 113,898` at the link repair, `8,428 · 113,965` after round 1,
`8,654 · 114,191` after round 2._

## What the takeover actually had to check

The commit subject claims *"the four rules do not move"*. **That was verified rather than believed** —
rules 1–4 are byte-identical to `main`, including rule 3's 2026-08-07 reversal and rule 4's sibling
exemption with the operational *sibling* test that
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) quotes rather than restates.

**The rebase conflict was `b059eb8`, and it resolves to the branch's side — after checking.** That commit
had just named #64's two disagreeing carriers inline, in the paragraph this cut deletes, so the
improvement looks lost. It is not: `2026-07-30-a-round-gets-its-definition.md` already names both, quotes
each, and carries the four-submission figure neither matches. The condensed sentence now says so, rather
than leaving the next reader to re-derive it. **A condensation's defect is what it removed**, which a
diff shows only as absence — so the whole review is *where did this go*, not *is this sentence right*.

## Five findings, and the two that touched meaning

1. **The cut downgraded two checked links to bare code spans** — `a-review-is-awaited-not-just-resolved.md`
   and `a-mandate-nothing-checks-is-already-broken.md`. `docs.sh`'s `links` check validates Markdown links
   and cannot see a code span, so both left the rail while still looking like references. **This is the
   method undermining itself**: the consolidation is worth its bytes only while the pointers it leans on
   are checked.
2. **Copilot round 1 found the third site of that same rule** — `0020` as a code span at the exemption's
   precedents paragraph, where this file links the proposal twice elsewhere. A **sibling** under rule 4's
   own exemption, so it did not spend the bound; swept file-wide rather than patched where it was named,
   since patching the site a reviewer points at is what rule 4 is about. Two code spans remain and both
   must: the `provenance` field's `form=link href=…`, which `doctor` parses, and `docs/plan.md` as a
   filename in prose.
3. **Round 2 was a promoted suppressed note, and it was right about more than grammar.** The condensed
   round definition read *"the maintainer's ruling; the unit clause, an implementer's derivation, he
   ratified verbatim on #119"* — an appositive stack with a dangling subject, at the one place in this
   record where provenance is load-bearing. The file's own reason for recording the ratification
   separately is that **blurring a clause an implementer inferred with one the maintainer ruled is the
   defect this rule protects against**. The compression put that sentence at risk of committing it.
   Rewritten at a cost of **+226 bytes, spent deliberately** — a condensation that buys bytes by making a
   provenance ambiguous has sold the wrong thing.
4. **Round 4 found this change's own figures disagreeing, in the sharpest possible way.** The pull
   request body said `15,879 → 8,152`, store `113,898`, headroom `8,982`; the first draft of these
   records said `8,654`, `114,191`, `8,689`. Two carriers, two sets, and the reviewer asked which.
   Neither was merely stale: **the body paired a record size from `1637d7b` — the abandoned commit,
   before the link repair — with a store size measured two commits later**, so it was never a coherent
   pair at any moment. The same mixing produced **`+502`** for round 2's cost, carried into its commit
   message, its thread reply and this file's first draft; the true figure is **`+226`**
   (`8,428 → 8,654`), and `+502` is `8,152 → 8,654` across three commits. Corrected in every carrier
   still editable, and named where it is not. This is the record's own #105 lesson — *writing a record
   while the number it states can still move* — committed inside the change that condenses the record
   teaching it, and caught by the suppressed channel rather than by its author.
5. **And the heading above this list said "Three".** Adding finding 4 left a stated count disagreeing
   with what it counts, three lines from a finding about a stated count disagreeing with what it counts.
   A **sibling** under rule 4 — the rule was being enforced at another site of the same operation, in
   this change, at the moment the defect was written — so it does not spend the bound, and it is the
   exemption's own case: the class generating its own next round. Found by the suppressed channel again.
   _(Counted as a finding rather than folded silently into the heading, because a list that renumbers
   itself to stay right is the drift this whole change is about.)_

## The part worth keeping

**The notes that proved the amendment came through the amended channel.** Findings 3, 4 and 5 all arrived
as notes Copilot suppressed as low confidence, promoted to gating threads by the shape-1 machinery. Under
rule 3 as it read until 2026-08-07 each would have been a non-blocking line in a review body — and
[#201](https://github.com/sleepy-panda-works/portulan/pull/201), merged an hour earlier the same day, is
the change that stopped [`../gate-map.md`](../gate-map.md) denying that promotion. **The channel the gate
map had been calling non-blocking produced every finding in this pull request that touched meaning**, and
the inline channel produced one citation-style fix. That is one pull request and not a rate; it is
recorded because it is the first measured instance of the amended rule paying for itself.

## The cost this pays, stated rather than absorbed

Inline links to #63, #85, #91, #105 and #167 become bare `#NN` references — roughly 55 bytes each, cited
repeatedly. A legibility cost, not a correctness one: every number still resolves by search and no
surrounding claim changed. Named here because a consolidation that reports only what it saved is
reporting half.

## For the next session

- **No fresh-context pre-commit checkpoint ran on this diff.** Stated per the gate map's own fallback
  rather than skipped quietly. It is a `dod.md` condition 7 breach, and it is the diff that most wants
  one, for the reason above: absence is what a condensation gets wrong and a diff renders absence badly.
- **The store has room now — 8,689 bytes — and that is a window, not a settlement.** The record memory
  flags is still there: nothing is retirable on the rules' terms, and the next average rule breaches
  again. This buys the decision time; it does not make it.
- **`agent-a793004a9eb228514` is detached and idle**, left at its old commit. It was clean when taken
  over, and nothing was lost — but it is a stale worktree and can be removed.
