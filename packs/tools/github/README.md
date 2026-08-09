# `tools/github` — GitHub Actions hygiene, as a composed verify recipe

A tool pack. It contributes **one verify recipe** to the workspace that composes it, and nothing else —
no skills, no personas, no gate fragments. Composed through a workspace's `packs` array as
`tools/github`.

| Contributes | What |
|---|---|
| Verify | [`actions-pinned`](verify/actions-pinned.sh) — every `uses:` in a GitHub Actions workflow is pinned to a full commit SHA ([limits](verify/README.md)) |

## Why this pack exists, said plainly

It is the first pack in this project to ship a `contributes.verify` recipe, and it was built because
**milestone 7's D6 needed a subject**. Row 7 requires a demonstration that a composed recipe *runs from
the adopting workspace, is refused when it would shadow one the workspace owns, and is could-not-run
when it cannot resolve* — and the only pack that existed, [`rituals/checkpoints`](../../rituals/checkpoints/README.md),
declares no recipe **by argued policy**: it has nothing honest to put in that field, and reversing that
to serve a demonstration would have made an honest pack dishonest.

So the subject is a real pack with a real recipe rather than a fixture. That choice is deliberate and
this project has paid for the alternative: a check written to exercise your own change inherits your
change's blind spot, which is how a discovery draft found neither plugin its own feed shipped while the
suite stayed green.

**Its bound, so the row grows no unscheduled obligation:** one pack, one recipe, its documentation. No
marketplace entry, no feed publication, no second recipe, and nothing D6 does not exercise.

## What the recipe checks — and the honest reason it earns its place

`uses: owner/action@<40-hex>` is pinned. A tag or a branch is not: the code that runs in the workflow
tomorrow is whatever the tag points at then, and a tag can be moved by whoever owns it.

**GitHub can already enforce this, and this repository has it enforced.** `sha_pinning_required` is set
at the organisation and at the repository, and the platform refuses an unpinned action outright — a
measured rail, recorded in this project's own gate map and platform-floor table. Saying so is not
optional: a pack claiming to be the only thing standing between an adopter and an unpinned action would
be claiming an enforcement it does not solely provide, which is the defect this repository has a memory
record about.

Two things the recipe buys anyway, and they are the reason it ships rather than an apology for it:

1. **Tree-time versus run-time.** The platform refuses the action when the workflow *runs*. This refuses
   it at the **pull request**, before merge. The gap is not theoretical for a scheduled workflow: an
   unpinned `uses:` in a `schedule`-triggered job merges green on a Friday and fails at 06:00 on Monday,
   with nobody watching.
2. **Portability, which is the whole point of a pack.** An adopter who has not set the organisation
   policy — or cannot, on a plan that does not offer it — gets this check as the *only* carrier. A pack
   travels; a platform setting does not travel with it.

## What it does not check

Named here rather than left to be discovered — see [`verify/README.md`](verify/README.md) for the full
list with reasons. In short: it reads one `uses:` per line and would not see a folded or flow-mapping
spelling; it exempts local (`./…`) and container (`docker://…`) references, which have no commit to pin;
and it does not verify that a pinned SHA is *reachable* in the action's repository, which would need a
network call — and a network call inside a verify recipe is a standing prohibition in this project, not
a decision this pack gets to make.

## Provenance

Built for milestone 7, session 5, as D6's subject, on the maintainer's ruling of 2026-08-09 that the
demonstration take a real pack rather than a fixture or a reversal of another pack's refusal. The
composition contract it exercises — additive only, namespaced by pack, never the workspace's
`verify.default`, could-not-run rather than silently absent — is row 7's, ratified 2026-07-31, and is
carried in code by [`cli/recipe-set.mjs`](../../../cli/recipe-set.mjs).
