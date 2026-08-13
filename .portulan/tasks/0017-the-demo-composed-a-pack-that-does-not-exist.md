# Task 0017 — the demo composed a pack that does not exist

**Lane:** full · **Opened:** 2026-08-13 · **Verify recipe:** `tests` · **Status:** IN REVIEW

> `examples/workspace.json` declared `stacks/python`. Nothing in the tree answers to that name — the
> string appears in **no commit that ever added such a pack**. The manifest was the only carrier
> *claiming the pack against the tree*; `git grep` finds four more mentions, and they are a different
> thing: one comment in [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs) narrating the demo's
> composition, and three test fixtures that need a deliberately non-resolving name and keep working.
>
> _An earlier draft of this line said **"grep finds it in exactly one place"** and added "no prose
> anywhere narrates a stack pack". Both were false, and `git grep` refutes them in one command — a
> bolded figure nobody measured, inside a change whose subject is claims nobody measured. Caught by
> the pre-commit checkpoint; recorded rather than quietly corrected, because it is this repository's
> most-named defect class committed inside the fix for an instance of it._

## Why this is a claim about Portulan rather than part of the fiction

`examples/` is fiction — a fictional team, two fictional products — and licensed to be. But a `packs`
entry is not inside the fiction: `spec/pack.schema.json` says the `category/name` form is what
"resolution maps to an installed pack", and `doctor` resolves those names against **this repository's
own `packs/`**. One array cannot carry two semantics, a real reference in slot two and a prop in slot
one. So `stacks/python` was [`../dod.md`](../dod.md) condition 4 — *nothing claims a capability that
does not exist* — in the artifact a stranger reads to see what a real setup looks like. And condition
4's escape arm does not reach it: prose may name the milestone where a capability arrives; **machine-read
JSON can only be true or be deleted.**

**It became urgent now** because milestone 7's close returned REQUEST-CHANGES, and the ruled disposal
requires the verify recipes to pin their resolution roots. Today's green over `examples` is green by
not looking — `doctor.sh` passes no root, so its packs are reported *unverifiable* and never graded.
The moment a root is pinned, `examples` goes RED. This change is what lets the pin land against a tree
that is already true.

## Two fresh contexts split, and what settled it

One ruled **author `packs/stacks/python` for real** — make the tree meet the demo, on the precedent of
`tools/github`, which was authored because a demonstration needed a real subject. One ruled **swap it
for `rituals/checkpoints`**. Both are defensible and the disagreement was the point of asking twice.

Two disputed facts were measured, and each cut against one of them:

- **Swapping does cost a prose edit.** `examples/README.md` listed *"packs it composes"* among the ways
  Rooftop is deliberately unlike customer zero. After the swap the two arrays are identical, so that
  differentiator goes false. The swap-ruling had waved this away.
- **The authoring trigger is circular.** `packs/stacks/README.md` says a stack pack "becomes worth
  writing when a workspace declares a stack that needs it" — but the only declaration is the line under
  disposal, and Rooftop has no repositories, no CI, and nothing that will ever run. The authoring-ruling
  leaned on a need its own subject manufactured.

**The maintainer ruled the swap, with the prose cost paid rather than hidden.** The decisive ground is
the one the authoring ruling could not answer: **`packs/` ships to real hosts.** A pack customer zero
would never compose ships a recipe that runs nowhere — the shape `spec/pack.schema.json` warns about,
*"a recipe that looks composed and is not"* — and `tools/github` is not precedent for it, because
customer zero **does** compose that one and its recipe is one of the eleven that run.

## What changed, and every claim it touched

1. **`examples/workspace.json`** — `stacks/python` → `rituals/checkpoints`.
2. **`examples/README.md`'s unlike-list** — `packs it composes` removed, with the reason recorded: it
   was true twice over when written (this workspace named a pack that never existed; customer zero
   composed nothing at all) and both halves have since gone.
3. **`examples/README.md`'s enforcement paragraph** — *"it declares no `gates`, so nothing here is
   enforced by machinery"* stays **true**, and is now incomplete without a clause: the composed pack
   contributes **two gate fragments**, and composition merges fragments *into a policy* this workspace
   does not declare. Measured: `compile --workspace examples` exits **2**, *"cannot read the gate
   policy … ENOENT"* — a could-not-run rather than a refusal, and quoted as the tool spells it.
   Composing a gates-contributing pack is not the same as being governed by one.
6. **[`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs)** — a comment justifying why the compose
   check is scoped to the governing workspace said the demo's packs *"deliberately do not exist"* and
   that holding the demo to the rule would be *"a red by construction"*. The first was half-false since
   session 5 and wholly false after this swap; the second inverts, because the demo now composes what
   the governing workspace composes and would coincidentally **pass**. The scoping now rests on
   governance alone, which is the durable ground its own last sentence already gave.
4. **`packs/README.md`** — *"`stacks/` and `tools/` are still empty"*, false since `tools/github`
   landed at milestone 7 session 5.
5. **`packs/tools/README.md`** — *"No tool pack exists yet"*, beside the directory that refutes it.

Both of the last two are condition-4 defects that have been live in `main` for days, found by grading
this one.

## What this does NOT do

- **It does not dispose of milestone 7's blocker.** The close's REQUEST-CHANGES stands: `--pack-root`
  is still not *optional where discovery finds a root*. Nothing here touches `resolutionRoots`, the
  recipes' roots, or that clause. The Status cell is deliberately untouched.
- **It does not overturn `packs/stacks/README.md`'s "none is scheduled".** That sentence is now true
  again rather than contradicted, and minting a stack pack remains the maintainer's call.
- **It leaves the `stacks` category empty**, which is the vision's first-named pack category. Honest,
  and stated rather than hidden.
