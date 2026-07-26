# Changelog

Every release of Portulan, and what changed in it. Kept because
[`docs/plan.md`](docs/plan.md) — Protocol → Versioning — requires a changelog per release; SemVer
from `v0.1.0`, and from milestone 8 each release carries an eval result as well.

This file is written in the change that cuts the release and merged before the tag is created, so
the tagged tree contains its own entry. **A date here is the date the release was cut** — the date
of the merge that carries this entry, not of the `git tag` command, which follows it by minutes and
could slip past midnight. Stated because the alternative wording makes the first entry false on
arrival for the sake of a distinction nobody needs.

The Session log in [`docs/plan.md`](docs/plan.md) is the fuller record — it is per *session* and it
records how things were found. This is per *release* and records what a reader gets.

## 0.1.0 — 2026-07-26

The first tagged release. Pre-release in the SemVer sense — the `0.` major says the interfaces below
may still move, and the Workspace Definition has already had one breaking revision (1.0 → 2.0) before
any tag existed.

**The engine** — [`core/`](core/). An always-loaded kernel under a 60-line budget
([`core/engine.md`](core/engine.md)); six operating documents (the loop, autonomy tiers, verification,
memory, evolution, safety); three personas as context firewalls; two universal skills, `clarify` and
`codify`; five templates.

**The Workspace Definition** — [`spec/`](spec/), at spec version **2.0**. A JSON Schema over a named
subset of 2020-12, a per-slot document where every slot cites what it was derived from, and the
1.0 → 2.0 migration. A workspace declaring `kind: repository` must declare its `tree`; that constraint
lives in `doctor` rather than in the schema, because the declared subset has no `dependentRequired`.

**Two validators, neither a superset of the other** — [`cli/`](cli/), zero dependencies, no build step.
`doctor.mjs` validates a workspace against the definition and lints its claims against the tree.
`plugin-lint.mjs` validates this repository's packaging. Both exit `0` valid / `1` not / `2` could not
run, and the third code is never spent on a verdict.

**A demo workspace** — [`examples/`](examples/). A fictional urban-beekeeping co-op with two products,
written to exercise what this repository's own workspace cannot: repeated products, affordance
inheritance, declared packs, a sealed provenance stamp.

**The Claude Code plugin, and the marketplace that ships it** — [`plugin/`](plugin/) and
[`.claude-plugin/`](.claude-plugin/). A `/portulan` boot skill that loads the kernel and reads the
*project's* workspace rather than its own bundle's; the three personas bound as host agents; the
engine's skills shipped as the same files `core/` documents, never copies.

### Known limits, stated rather than discovered

- **The CLI is `doctor` and `plugin-lint` only.** `init`, `compile`, `vendor`, `index` and `upgrade` are
  named in the plan and do not exist. Nothing drafts a workspace for a team that has none.
- **No hooks and no settings ship.** The gate map is honoured by people and by review; the compiler that
  turns it into enforcement is milestone 4. Packaging a hooks file now would ship an enforcement that
  does not exist.
- **Nothing runs the verify recipes for you.** They are executable and CI runs them on every pull
  request; the Stop-gate that blocks a "done" claim on a red recipe is milestone 4.
- **Memory has no generated index.** Recall means reading the directory.
- **The repository is private at this tag.** It goes public after a clearance tracked outside it.
