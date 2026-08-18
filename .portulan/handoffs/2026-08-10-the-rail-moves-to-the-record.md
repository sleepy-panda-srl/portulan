# Handoff — the rail moves to the record, and the record was two facts

**Off the milestone row. Full lane** — a doctrine change: Workspace Definition 2.8, the memory byte
rail, and a split of the record this repository's review process runs on. Pull request
[#215](https://github.com/sleepy-panda-srl/portulan/pull/215), proposal
[`0025`](../proposals/0025-the-byte-rail-moves-from-the-store-to-the-record.md), ruled twice on
[#199](https://github.com/sleepy-panda-srl/portulan/issues/199).

## What this session was handed, and what had changed under it

#199 carries two fresh-context Fable 5 rulings and a sequencing note. The note is the part that changed
the work: **the demote half landed early and alone** in
[#202](https://github.com/sleepy-panda-srl/portulan/pull/202) on 2026-08-09, so the ruled sequence
*demote → split → rail* became **split + rail in one pull request**, with the demote already upstream.

**Measured at session open rather than inherited** — `Buffer.byteLength` over `.portulan/memory/*.md`,
which is what `cli/index.mjs` budgets: 28 records, **114,191 B**, headroom 8,689, mean 4,078. Largest
`a-review-loop-needs-a-bound.md` at **8,654** — the only record in 28 that a `record_kilobytes: 8` rail
would red, by **462 bytes**. Index 34 of 40 lines. That matched #199's third comment exactly, which is
worth recording because the next two figures did not.

## Two figures from the ruling that no longer held

The second ruling projected post-split **"A ≈ 6,245 B (76%)"** and *"the rail ships with its largest
record at 76% instead of 99.5%."* Both were computed against the **8,152-byte branch state**; the record
then grew to **8,654** before #202 merged. Re-derived per commit rather than taken from the issue, which
had it as *"rounds 2, 4 and 5"* and is wrong: `860fbea` the link repair **8,152 → 8,361**, round 1
`152720b` **→ 8,428**, round 2 `da41d2d` **→ 8,654**, and rounds 4 and 5 never touched the record at all
(`git log --follow` lists neither). So:

- A lands at **7,047 B (86%)**, not 6,245 (76%).
- The store's largest record afterwards is **`every-pull-request-carries-a-label.md` at 7,947 (97.0%)**,
  not A — which the same ruling saw and explicitly ruled no action owed on.
- And the ruling's *"absorbs one amendment event and fires on the second"* is optimistic: at **1,145
  bytes** of headroom, A fires on the **first** amendment of the observed size (~1.5–2.5 KB).

None of this moves the decision — the ruling's argument for 8 over 12 is about the `columns: 140`
precedent and the *current-largest-tenant-plus-growth-room* failure mode, neither of which depends on
these numbers. It is recorded because a superseded projection repeated verbatim is how a figure becomes
a stale carrier, and because the correction *tightens* the cost rather than loosening it.

## The demonstration, run rather than asserted

The rail was landed **before** the split, and `index --check` was run against the real store:

```
✗ .portulan: the record a-review-loop-needs-a-bound.md is 8.5 KB (8654 bytes) against a per-record
  cap of 8 KB (8192 bytes) — over by 462. Repair it where it is: SPLIT it if it holds more than one
  fact (which spends `memory.index.budget.lines`, the axis with the headroom), COMPRESS it, or
  DEMOTE its narrative to the provenance layer. …
  ok examples: store index current, within budget
EXIT: 1
```

Then the split, then green. `examples/` is green in both runs on `kilobytes`, so the older rail is
demonstrated alive in the same output rather than assumed to still work.

## The split, and why the verification is a reconstruction

The record held two facts: rule 3 is the **channel** (`0021`, #167 — where an answer lands, what
`required_conversation_resolution` gates), the rest is the **bound** (`0020`, #105). Provenance targets
were re-verified against the record's own text before cutting, not taken from the brief.

**Checking only the moved block would prove the moved block moved**, and say nothing about the 97 lines
that stayed — which is where a stray edit actually hides. So the two halves were rebuilt into the
original file and `cmp`'d against `HEAD`:

```
RECONSTRUCTION cmp: byte-identical to the source, modulo the 2 declared reference repairs
  keep ok    689 B  rule 1        keep ok   1302 B  the round definition
  keep ok    141 B  rule 2        keep ok    572 B  the measurement table + units
  keep ok   1769 B  rule 4        keep ok    245 B  the retire-when
  keep ok    170 B  0020's quoted sibling definition
  cross ok   160 B  `0020` still quotes it word-for-word
```

**The two repairs are declared, applied mechanically, and asserted one-by-one so the verifier proves
they are the only differences.** `per rule 1` gained a link (rule 1 now lives in the other record) and
`**Rule 3's reversal … argued at the rule**` became `**This rule's reversal … argued above**` (the
record is no longer a numbered item). Byte-identity is the means; **a reference that no longer resolves
is broken meaning kept in intact bytes** — issue #133's class, which would have been committed inside
the change that exists to prevent it.

Two verification instruments were themselves wrong first, and both were caught by their own assertions
rather than by reading: the `0020` cross-check compared raw bytes across a **re-wrap** (the two copies
break at different columns — same words, different typesetting), and the evidence-paragraph locator
searched for pre-delta text, silently matching nothing until the delta tally caught it. **A check that
cannot fail loudly is a check that has not been checked.**

## Siblings, two of them outside #199's change list

- **`cli/librarian.mjs`.** With `kilobytes` gone from the manifest, `budgetHeadroom(…, undefined)`
  returns null and the weekly report printed **`Store: no budget declared`** over a store that is fully
  railed. A live rail going quietly unreported is the shape
  [`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
  names. It now carries a largest-record distance **naming the file it measured** — and the file it
  names is the 97% record above, which is exactly the one #199 said to ask the one-fact question of.
- **The `lines` arm of `budgetFindings`.** Still carried `merge, compress, retire` in the same function
  this change taught the four-move doctrine — and two of this change's own new sentences claimed the
  finding named its axis menu, which was false of the mechanism. Found by the pre-commit checkpoint.
- **`gate-map.md`** claimed *"the four rules … are stated there"* of a file that now states three.

## The 2.7 → 2.8 sweep, and where I overruled a supervisor

Classified per carrier rather than substituted globally. **Replace**: schema `$id`/`title`,
`.portulan/workspace.json`, `spec/README.md`'s table and current-version sentence, two test assertions.
**Add**: `KNOWN_SPECS` in `cli/index.mjs` and `cli/librarian.mjs` — both refuse an unknown spec with
exit 2, so a replacement would have dropped every 2.7 manifest and, more immediately, **turned the
forced-red drill above into an exit 2**. That catch was the session-open checkpoint's and it was the
most valuable thing either checkpoint found.

**Left**: the four constants that *write* a spec. Session-open put them under *replace*; I disagreed and
the pre-commit pass independently confirmed the disagreement. The evidence is local and pre-existing —
`GATE_POLICY_SPEC = "2.2"` sits beside `SPEC = "2.7"` in the same file, nothing those tools scaffold
declares a memory budget at all, and `cli/init.test.mjs:121` asserts 2.7 with minimum-version reasoning.
A writer declares **the version its output needs**, not the newest one.

**`examples/workspace.json` is deliberately untouched**, which deviates from #199's change list by one
file. `spec/README.md` cites its being *"on 2.4 and untouched"* as the measured MINOR-compatibility
demonstration, and leaving it keeps `kilobytes` with a live in-tree carrier instead of a key only unit
tests exercise. Stated in the proposal rather than done quietly.

## Fidelity

Both checkpoints ran **before** the commit, in fresh contexts, which is the moment the maintainer ruled
on 2026-08-09 — not the late recovery pass three of the last four sessions settled for. Session-open
returned **APPROVE-WITH-ADJUSTMENTS (7)**, pre-commit **APPROVE-WITH-ADJUSTMENTS (6)**; all thirteen
folded in. Between them they caught the `KNOWN_SPECS` trap, `spec/README.md` going unnamed, the gate-map
sentence, the librarian regression, a *"three reds"* count the mechanism contradicts (there are four),
and a positive-integer claim that was wrong **twice** — seven keys of that shape, not four, and
`minimum` alone would retire none of them since the subset cannot say `integer` either.

Nine recipes green, suite **1200 pass / 0 fail**. Seam scan clean, with links collapsed to their labels
first — the instrument lesson from 2026-08-09, where a markdown URL inside the phrase hid a carrier.

**Left for the next session:** the proposal and these records land in a second push, per
[#143](https://github.com/sleepy-panda-srl/portulan/issues/143)'s ruled sequence (a proposal must name
its pull request, so it cannot precede it), which owes a second pre-commit pass on the additions. Then
Copilot rounds to empty. **Marius merges.**

**Named rather than assumed:** #173's constraint — *not by the session that just amended that file* —
is satisfied here. This context did not amend `a-review-loop-needs-a-bound.md`; the open question #199
raised about whether #202's own review rounds counted as amending it is untouched by this change and
remains the maintainer's.
