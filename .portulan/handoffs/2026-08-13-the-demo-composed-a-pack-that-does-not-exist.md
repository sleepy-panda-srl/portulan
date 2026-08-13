# Handoff — the demo composed a pack that does not exist

**Milestone 7, session 11. Full lane.** Task
[`0017`](../tasks/0017-the-demo-composed-a-pack-that-does-not-exist.md). The obstacle to pinning
resolution roots, cleared so the disposal can land against a tree that is already true.

## What this session was handed

Milestone 7's close returned **REQUEST-CHANGES** on one clause — `--pack-root` is not *optional where
discovery finds a root* — and the maintainer ruled the disposal is a behaviour change rather than a
row amendment. That change requires the required verify recipes to pin their resolution roots, and the
moment `doctor.sh` pins one, `examples` goes RED on a pack that does not exist. So this had to be
disposed of first, and it is deliberately **not** the disposal.

## The finding worth carrying forward

**A demo may lie about itself and may not lie about the product.** `examples/` is fiction and says so;
its repo-card claims are reported *unverifiable* precisely because the repositories it describes are
not there. But its `packs` array is resolved by `doctor` against **this repository's own `packs/`** —
so a name in it is a claim about Portulan, not about the fictional team. One array cannot carry a real
reference in one slot and a prop in the other.

The general form, which is the part that transfers: **the fiction's boundary is not the file, it is
the field.** Whether a value is fiction depends on who reads it and against what, and a field the
product's own tools resolve has left the story regardless of which document it sits in.

## The decision, and why it took three passes

Two fresh contexts were asked the same question and **split** — one ruled *author `packs/stacks/python`
for real*, one ruled *swap it for `rituals/checkpoints`*. That disagreement was worth its cost, because
each had a fact the other had not measured, and both facts turned out to be true:

- **Swapping falsifies a listed claim.** `examples/README.md` named *"packs it composes"* among the ways
  Rooftop is deliberately unlike customer zero, and after the swap the two arrays are identical. The
  swap-ruling had dismissed this as covered by the other listed differences; it was one of them.
- **The authoring trigger is circular.** `packs/stacks/README.md` licenses a stack pack "when a
  workspace declares a stack that needs it" — and the only declaration was the line under disposal.
  Rooftop has no repositories and no CI; nothing will ever run there. The authoring-ruling leaned on a
  need its own subject manufactured.

**What decided it is a fact about layers rather than about the demo:** `packs/` ships to real hosts, so
a pack customer zero would never compose ships a recipe that runs nowhere. `tools/github` looks like
precedent for authoring-to-serve-a-demonstration and is not, because customer zero **does** compose it
and its recipe is one of the eleven that run.

## The thing I got wrong, twice, and the shape it shares

I recommended the swap **without checking whether it broke a claim elsewhere** — and it did, one file
away, in a sentence listing the very axis I was collapsing. The maintainer had already caught me
weighting **cost** rather than truth when I first recommended it; this was the same recommendation
failing for a second, independent reason.

Both failures share a shape with the defect this change repairs: **a claim in one file made false by an
edit in another, with nothing that checks the pair.** `doctor` lints a workspace's claims against the
tree; nothing lints one document's prose against another document's data. That is why the disposal had
to be measured rather than reasoned about, and why every claim this change touched is enumerated in
[`0017`](../tasks/0017-the-demo-composed-a-pack-that-does-not-exist.md) rather than summarised.

## What to know before touching this next

- **The enforcement sentence survived on a technicality worth understanding.** *"It declares no
  `gates`, so nothing here is enforced by machinery"* stays true even though the newly composed pack
  contributes **two gate fragments** — because composition merges fragments *into a policy*, and this
  workspace declares none. Measured: `compile --workspace examples` exits **2**. The paragraph now says
  so, because a reader meeting a gates-contributing pack beside that sentence is owed the reason.
- **Two condition-4 defects were found in `main` while grading this**, both stale since `tools/github`
  landed at session 5: `packs/README.md` said `tools/` was still empty, and `packs/tools/README.md`
  said no tool pack existed. Neither was caused by this change and both are fixed in it.
- **The `stacks` category is still empty**, and it is the vision's first-named pack category. That is
  a real loss, stated rather than hidden, and minting a stack pack stays the maintainer's call —
  `packs/stacks/README.md`'s *"none is scheduled"* is true again rather than contradicted.
- **This does not unblock the close.** Milestone 7's REQUEST-CHANGES stands untouched; the Status cell
  is deliberately not edited. Two changes follow: the fail-open fixes, then the disposal itself.

## Fidelity

No session-open checkpoint was run for this change. It is defensible and it was not free, and the
accounting matters more than the verdict: the *substantive question* had been graded by **two** fresh
contexts and ruled by the maintainer, and a third grade of it is the ceremony `docs/vision.md` names a
non-goal — but session-open's object is the session **plan**, not the ruled question
([`../gate-map.md`](../gate-map.md)), and what went ungraded was therefore the plan's shape and its
sweep. **That is exactly where this change's two defects sat**: a bolded grep figure nobody measured,
and a third falsified carrier the sweep missed. The pre-commit pass found both. So the skip is
recorded as costing something rather than as free, and it does not license skipping session-open
whenever a decision happens to have been pre-ruled.

Eleven recipes green. `examples` is now **GREEN under a pinned root, resolving both packs for real** —
previously it was green only because nothing looked. Seam scan clean over the diff, the branch name
and the commit message, term by term.
