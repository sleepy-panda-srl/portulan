# examples/ — the Rooftop workspace

A **fictional, public demo workspace**: the reference a stranger reads to see a real Portulan setup end
to end. Rooftop is three people making software for urban beekeeping cooperatives. They do not exist.
Their two products, their gate map, and the incidents behind their rules are invented — and invented
*specifically*, because a demo written in placeholders teaches nothing about the one thing that is hard,
which is deciding what belongs in your own layer.

It also does a job the reader does not see. This is the Workspace Definition's **second** instance, and
a schema derived from one sample is not tested until it meets a differently-shaped one. Rooftop is
deliberately unlike [customer zero](../.portulan/): two products instead of one, a deployed service
alongside a static site, packs it composes, affordances that resolve down the cascade, and a rule whose
incident it is not allowed to publish.

## Read it in this order

| File | What it answers |
|---|---|
| [`identity.md`](identity.md) | Who Rooftop is, the stack, the glossary |
| [`principles.md`](principles.md) | How they decide — the constitution slot |
| [`products/combcount/product.md`](products/combcount/product.md) · [`products/fieldnotes/product.md`](products/fieldnotes/product.md) | What each product is and why it exists |
| [`affordances.md`](affordances.md) | What any Rooftop repo offers an agent — the workspace default |
| [`products/combcount/affordances.md`](products/combcount/affordances.md) | Where one product overrides that default |
| [`gate-map.md`](gate-map.md) | Which concrete action sits behind which gate |
| [`dod.md`](dod.md) | What "done" means here |
| [`verify/README.md`](verify/README.md) | The executable half of done |
| [`repos/`](repos/) · [`memory/`](memory/) · [`tasks/`](tasks/) | The per-repository facts, the durable rules, one task |
| [`memory-index.md`](memory-index.md) | The generated index of that store, and the budgets it is held to — written by `node cli/index.mjs examples`, never by hand |
| [`workspace.json`](workspace.json) | The manifest tying it together |

## Four things this workspace is showing you on purpose

**1. Two products, and affordances that resolve down the cascade.** [`affordances.md`](affordances.md)
at the workspace root is the default — true of any Rooftop repository. `combcount` overrides it, because
a deployed service with a staging environment and database migrations offers an agent handholds a static
site does not. `fieldnotes` declares none and inherits. That is thesis 1's more-specific-wins rule
applied one level below the workspace, and it is why the slot is per-product rather than per-workspace.

**2. A rule whose incident cannot be published.**
[`memory/staging-seeds-must-be-shaped-like-production.md`](memory/staging-seeds-must-be-shaped-like-production.md)
carries a **sealed** provenance stamp — owner, date, and the de-identified failure shape — because the
incident happened inside a cooperative's own data and is not Rooftop's to publish. The rule travels; the
episode does not. `doctor` reports what proportion of a workspace's rules are sealed, because a
workspace where *everything* is sealed has quietly opted out of ever retiring a rule.

**3. Slots left empty, deliberately.** There is no `handoffs/` and no `proposals/` slot here, and no
`constitution` slot either. A team adopting Portulan on a Tuesday afternoon has none of those yet, and a
definition that rejected them would make the first experience a failure. The Workspace Definition
*having* a slot and an instance *filling* it are different claims — only the first is required.

**4. Nothing here is checked against a tree.** Rooftop's repositories are fictional, so this workspace
declares no `tree` slot and `doctor` reports its repo-card claims as **unverifiable** rather than
checking them or silently skipping them. That is the honest disposition for a workspace describing
repositories that are not present beside it — the same disposition a portfolio workspace spanning many
repositories will need.

## What a stranger can actually run

```
node cli/doctor.mjs examples
```

from the repository root. It validates the manifest against
[`../spec/workspace.schema.json`](../spec/workspace.schema.json), resolves every path slot, checks the
cross-references, and reports the sealed proportion. It exits `0`.

What it does **not** do here is run Rooftop's verify recipes: `make check` needs a repository that does
not exist. The recipes are declarations, and `doctor` never executes a recipe in any workspace. Executing
one is the Stop-gate runner (milestone 4), which Rooftop has not compiled — it declares no `gates`, so
nothing here is enforced by machinery. That is the ordinary state of a workspace, and worth seeing in the
demo rather than only in the one repository that did compile.
