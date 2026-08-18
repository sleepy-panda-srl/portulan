# Proposal — the byte rail moves from the store to the record

**Status. RULED, 2026-08-09** — twice, by fresh-context Fable 5 supervisors under the maintainer's
delegation, the fourth and fifth in the `0022`–`0024` series. The second ruling was asked whether the
number should move and **corrected the record rather than the cap**. Both are recorded in full on
[#199](https://github.com/sleepy-panda-srl/portulan/issues/199). Accepted on merge.

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/215

## Incident

Three unrelated changes in two weeks breached `memory.store.budget.kilobytes` — a rail on the store's
**total** size. The third, [#172](https://github.com/sleepy-panda-srl/portulan/issues/172)'s ordinary
new record, hit it with **551 bytes** of headroom, having done nothing unusual. The record actually
driving the total — `a-review-loop-needs-a-bound.md` at **15,879 bytes, 13.1% of the whole store**
(measured at `34d62e0^`, the commit before the demote) — had never breached anything, because at write
time there was nothing for it to breach.

By the third binding the rail's repair menu was empty, and that is the fatal condition rather than the
occupancy. **Retire**: no condition had fired, all 28 checked. **Merge**: candidates examined and refused
as distinct facts. **Compress**: already run twice on the same record (−25%, then −11%), and the next cut
takes the failure shape, which [`../../core/skills/consolidate/SKILL.md`](../../core/skills/consolidate/SKILL.md)
step 4 forbids. [`../../spec/slots.md`](../../spec/slots.md) had already written down what that means, in
its argument for why the handoff series carries no budget at all: *"Every remedy such a budget could ask
for is barred, which makes it a rail designed to be broken — and a rail that fires with no legal repair
is how a whole recipe gets switched off."* The test was in the tree before the case arrived; this is the
store's own aggregate failing it.

## Proposed rule

**`memory.store.budget` gains an optional `record_kilobytes`: the most bytes any one record may hold.**
Workspace Definition 2.7 → **2.8**, additive. `kilobytes` stays legal and unchanged for adopters,
nothing is defaulted, and every 2.7 manifest is a valid 2.8 manifest untouched. Record **count** stays
railed where it already is, at `memory.index.budget.lines`.

**This workspace declares `record_kilobytes: 8` in place of `kilobytes: 120`.** 8 KB ≈ 2× the mean
record, ≈ 2 KB of prose per recall.

Three arguments, and the first two are the specification's own rather than new doctrine.

1. **An aggregate cannot see inside its units.** The index is railed per-unit as well as in total —
   `lines` for count, and `columns` because it *"closes the hole a line budget has — one enormous line
   absorbing what the budget counts"* ([`../../spec/workspace.schema.json`](../../spec/workspace.schema.json)).
   The store had the aggregate and not the per-unit cap, so one enormous record absorbed what the store
   budget counted. **`record_kilobytes` is the store's `columns`**, and the sentence justifying it was
   already in the tree, one level up.
2. **A budget over individually-authored records is a commons.** The author who grows a record pays
   nothing at the moment of growth; some unrelated writer pays later, at a moment they cannot predict
   and for a cause they did not create. Three bindings in two weeks is that structure, not bad luck.
   A per-record cap makes the breach **local** — record X over its cap never blocks writer Y — and it
   fires on the author growing the record, at the moment of growth. **It would have fired during the
   2026-07-30 session that grew that record past 8 KB.**
3. **Every breach gets a legal repair again**: split (which spends the count axis, where there is
   headroom), compress, or demote narrative to the provenance layer. Never a raise in the change that
   breached it — that rule is unchanged and still the human gate's.

## Enforcement

`cli/index.mjs`'s `budgetFindings`, the same function that already rails the other three numbers, red at
pull-request time through [`../verify/index.sh`](../verify/index.sh). `cli/doctor.mjs` refuses a value
that is not a positive integer, the fourth budget of that shape. **The finding names the record, its
byte count, the cap, the overage and the repair menu**, because a rail whose menu is empty is what this
proposal exists to end — so the menu travels in the red rather than only in the documentation. **Every**
over-budget record is reported, not merely the first: unlike a `columns` breach, whose repair is the
same trivial rename every time, each of these is a separate editorial decision.

**Demonstrated red → green rather than asserted**, on the real store, with the demote half of the
migration already upstream from [#202](https://github.com/sleepy-panda-srl/portulan/pull/202):

```
✗ .portulan: the record a-review-loop-needs-a-bound.md is 8.5 KB (8654 bytes) against a per-record
  cap of 8 KB (8192 bytes) — over by 462. Repair it where it is: SPLIT it if it holds more than one
  fact (which spends `memory.index.budget.lines`, the axis with the headroom), COMPRESS it, or
  DEMOTE its narrative to the provenance layer. Raising the cap in the change that broke it is the
  one repair core/operating/memory.md rules out
```

It is the only record in 28 that fires. After the split, green. `examples/` — which keeps `kilobytes`
and stays on spec 2.4 — is green in both runs, so the older rail is demonstrated alive in the same
output.

## The migration, and why it is a split rather than a trim

The second ruling was asked whether 8 should become 12, given that the record landed 40 bytes under the
cap after the demote. **It kept 8 and convicted the record's granularity instead**, which is the rail
doing on its first day exactly what it exists to do: finding a file where two facts share one envelope.

| | bound by | proposal | measurements |
|---|---|---|---|
| Rules 1, 2, 4 + the round definition | the review loop's **length** | [`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md) | #105, #164, #85 |
| **Rule 3** — where an answer lands, what `required_conversation_resolution` gates | the **channel** | [`0021`](0021-the-suppressed-channel-needs-a-state.md) | #167 |

The record said it of itself — *"The two are different currencies"* — and
[`../../core/operating/memory.md`](../../core/operating/memory.md) says *"a memory holds one fact."* They
were filed together only because both were born in the same 2026-07-28 handoff. So rule 3 becomes
[`../memory/an-answer-lands-on-the-thread-that-raised-it.md`](../memory/an-answer-lands-on-the-thread-that-raised-it.md),
with its own provenance and its own retirement condition.

**Why 12 loses on its own terms.** The in-repo precedent for a per-unit rail is `columns: 140`, which
runs at **1.4× the mean index line with its largest at 96.4%** — and nobody calls that rail failed;
`d4d5897` is it firing and being repaired routinely. 8 KB is **2.01×** the mean record, already looser
than the accepted precedent. And 12 is *"current largest tenant plus growth room"*, which is how the
store rail was built (120 KB at ~1.35× the then-store, which grew to meet it): this proposal's own
rejection of raising the number transfers verbatim. Derived alternatives lose too — **mean + 2σ = 7,270**
fails two records on day one, and any **relative** cap makes breaches non-local again, which is the
commons this ruling abolishes, sign-flipped.

_Those four figures are **re-derived on this tree**, not carried from the ruling, and three of them moved:
it argued 1.55× / 97.9%, 2.03× and mean + 2σ = 7,136 from the mid-review branch state that #202 then grew
past. The `columns` pair also depends on the unit — the rail measures `line.length`, i.e. **characters**,
while the record rail measures bytes, and these index lines are full of multi-byte em dashes. **Every
conclusion survives**: the precedent is still looser than 8 KB, and mean + 2σ still fails two records._

**Byte-faithfulness was verified by reconstruction, not by reading.** The two halves were rebuilt into
the original file and `cmp`'d against `HEAD`: byte-identical, modulo two declared repairs of references
the move itself broke (`per rule 1` gained a link; `**Rule 3's reversal … argued at the rule**` became
`**This rule's reversal … argued above**`). Checking only the moved block would have proved the moved
block moved and said nothing about the 97 lines that stayed. Slot 3 keeps its number as a pointer that
**cites rather than restates**, so `rule 3` still dereferences from `0021`, from `copilot-review.yml`
and from rule 1 — and `0020`'s verbatim quote of rule 4 is untouched, which is why the filename does not
change.

Post-split: the bound **7,047 B (86%)**, the channel **3,095 B (38%)**, index **35 of 40 lines**.

## What this costs, stated in its own voice

- **The disk aggregate is released, but not to infinity — the count rail bounds it.** The generated index
  carries six non-record lines, so `lines: 40` admits at most **34 records**: worst case **34 × 8 KB =
  278,528 B ≈ 272 KB** against today's 113, with an expected steady state of 34 × the current mean
  (3,989 B) ≈ **132 KB**. No recall pays that aggregate — but nothing measures what a store 2–3× today's
  costs `doctor`, the index walk or the librarian pass, and that is an argument here rather than a
  measurement.
- **The count axis moved one line closer to binding** — 34 → 35 of 40. That axis is the real question
  (*which rules earn a line in what every session loads*), it binds in roughly six weeks to two months,
  and it is deliberately not pre-legislated here.
- **Two figures from the ruling no longer hold, and are corrected rather than repeated.** It projected
  *"A ≈ 6,245 B (76%)"* against the 8,152-byte branch state; #202's review rounds grew the record to
  8,654 before merge, so A lands at 7,047 (86%). Consequently *"absorbs one amendment event and fires on
  the second"* is optimistic: at 1,145 bytes of headroom A fires on the **first** amendment of the
  observed size (~1.5–2.5 KB). The store's largest record afterwards is
  `every-pull-request-carries-a-label.md` at **7,947 (97.0%)** — dormant since 2026-07-27, repairs
  unexhausted, and the same ruling saw it and ruled no action owed.
- **The rail has fired only when forced.** Its designed moment — on an author mid-session, at the moment
  of growth, with repairs live — is projected, not observed.

## What it does not solve

Not **recall quality** — an eval question, milestone 8, and the split changed what a recall loads without
anyone measuring whether either half recalls better. Not [#75](https://github.com/sleepy-panda-srl/portulan/issues/75):
nothing yet refuses a cap raise in a breaching change, and this adds one more key that rule must cover.
Not the count-axis conversation above. And `memory/README.md` remains the one `.md` name invisible to
both byte rails — pre-existing, consistent across three tools, and the old aggregate missed it
identically.

## Provenance

`form=link` `href=../../.portulan/handoffs/2026-08-10-the-rail-moves-to-the-record.md` — and the two
rulings in full on [#199](https://github.com/sleepy-panda-srl/portulan/issues/199), with the
sequencing note that recorded #202 landing the demote half early and alone.

## Decision

**Taken.** The byte rail is per-record at `record_kilobytes: 8`; the store total is released in this
workspace and stays legal in the specification, with [`../../examples/workspace.json`](../../examples/workspace.json)
as its live carrier. The record that convicted it is two records. `consolidate/SKILL.md` learns **split**
as the inverse of merge — one question about granularity, asked before compressing, because a record
holding two facts reads as an incompressible one. Marius merges.
