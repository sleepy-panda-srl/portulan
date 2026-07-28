# Agent affordances — Portulan

> The **agent-affordances slot** ([`../../../spec/workspace.schema.json`](../../../spec/workspace.schema.json)):
> what this product offers an agent working on it, and — just as load-bearing — what it does not. An
> affordance is something an agent can *rely* on: a contract, a command, a budget, a map that is checked
> against the ground. _(Provenance: the agent-native / AX school, via the influence map in
> [`../../../docs/vision.md`](../../../docs/vision.md) — repo affordances as an auditable property.
> Authored in milestone 2, when the slot was defined.)_
>
> Affordances are per-product rather than per-workspace because a portfolio workspace covers products
> with wildly different ones — a Markdown framework and a deployed API do not offer an agent the same
> handholds. This workspace covers one product today; the slot is shaped for the ones that will not.

## What an agent can rely on here

| Affordance | Where | The contract |
|---|---|---|
| An always-loaded kernel with a **budget** | [`../../../core/engine.md`](../../../core/engine.md) | ≤ 60 lines, enforced by the `kernel` check. Read it first; everything else loads on demand. |
| A **map checked against the ground — in one direction** | root [`../../../README.md`](../../../README.md) | Every top-level entry must appear in the layout table, enforced by the `map` check. The converse is **not** checked: a row describing a directory that no longer exists passes, so the map cannot omit, but it can go stale. |
| **Executable verify recipes** with declared needs | [`../../verify/`](../../verify/) | Exit `0` green · `1` red · `2` could not run. The distinction is deliberate: a recipe that cannot run must never look like one that ran and passed. |
| A **machine-readable manifest**, validated | [`../../workspace.json`](../../workspace.json) | Names every slot and where it lives, so an agent can find the policy layer without guessing at directory conventions — and [`doctor`](../../../cli/doctor.mjs) fails CI if a slot points at something absent, so a path read from here can be trusted to exist. |
| A **claims lint against this tree** | [`../../repos/portulan.md`](../../repos/portulan.md), [`../../gate-map.md`](../../gate-map.md) | The repo card's build/test/run and layout paths, and the gate map's required-check name, are checked against the actual tree. Two limits: only path-shaped tokens are checked, and live branch-protection settings are not fetched. |
| **Templates for every artifact** | [`../../../core/templates/`](../../../core/templates/) | Repo card · task · handoff · proposal · memory entry. Placeholders are in `{braces}`; fill and delete what does not apply. |
| **Actions bound to tiers** | [`../../gate-map.md`](../../gate-map.md) | Every concrete action this repository permits is classified Auto / Propose / Gated / Prohibited, so an agent can tell unattended work from work that needs a human — and from work no yes makes acceptable. |
| A **dated handoff series** | [`../../handoffs/`](../../handoffs/) | Filenames lead with an ISO date, so the series sorts chronologically and is machine-consumable without parsing prose. |
| **Memory with retirement conditions** | [`../../memory/`](../../memory/) | One fact per file, each with provenance and a "retire when" clause — so a rule can be judged, not just obeyed. |
| **Network-free, deterministic checks** | [`../../verify/README.md`](../../verify/README.md) | Nothing fetches. A check that fails for reasons unrelated to the change under test is worse than no check. |
| A **platform floor that holds against everyone** | [`../../gate-map.md`](../../gate-map.md) | `main` rejects direct pushes, requires `workspace-verify` green, and exempts nobody — including the maintainer. |

## What an agent must not assume

Written at the same level of detail, because a legibility report that lists only strengths is marketing.

- **The Stop-gate runs one recipe, not all of them.** Since milestone 4 it runs the workspace **default** and
  blocks "done" on a red, an exit 2, or a recipe it could not execute — and releases after three
  consecutive refusals of any one reason, or nine in all. The others are
  still condition 1 of [`../../dod.md`](../../dod.md) and a habit.
- **Which tiers compile depends on the backend, and there are two.** For the Claude Code backend gated
  actions prompt and the constitution is refused, while `auto` and `propose` emit nothing — the compiler
  adds restriction only. For the **floor** backend the partition inverts: `propose` is exactly what a
  GitHub repository ruleset enforces. Both read [`../../gates.json`](../../gates.json); `compile --matrix`
  prints every rule against both. The refusals are printed, never silent.
- **A compiled gate matches a spelling, not an intent.** A command reaching a gated action by another
  route escapes it; one wrapper level is peeled and no more. The platform floor beneath is what is
  indifferent to spelling.
- **`doctor` validates form, not truth.** It checks that the manifest conforms, that every path
  resolves, that the cross-references hold, that repo-card and gate-map claims match the tree, and that
  every rule's provenance is well-formed. It cannot tell whether a document at the end of a resolving
  path still says something accurate, and it never runs a verify recipe.
- **There is no agent-legibility score.** This slot is the input such an audit would read; the scoring
  itself is not built, and calling this file a score would be exactly the overclaim
  [`../../principles.md`](../../principles.md) forbids. `doctor` resolves this file's path and reads
  nothing in it.
- **The memory index is generated and budgeted — and it is still only an index.**
  [`../../memory-index.md`](../../memory-index.md) is emitted from [`../../memory/`](../../memory/) by
  [`../../../cli/index.mjs`](../../../cli/index.mjs) and byte-compared by the `index` recipe, so it
  cannot go stale unnoticed and cannot be hand-edited into disagreement with the store. Three things
  an agent must not read into it. Every line is **derived** — title from the filename, type from the
  record — so it carries no summary anyone wrote, and finding the right record still means opening
  it. The store is walked **flat**: records under a subdirectory of it are in no index and count
  against no budget. And the budget's *remedy* is not enforced — a breach is red, but nothing refuses
  a change that answers the breach by raising the number.
- **`links` has two known false greens.** Wrong-case link targets pass on a case-insensitive volume, and
  paths written as code spans are never checked at all. Both are recorded in
  [`../../verify/README.md`](../../verify/README.md); the second has already cost this repository two
  dead pointers that survived several reviews.
- **`CODEOWNERS` exists but enforces nothing.** [`../../../CODEOWNERS`](../../../CODEOWNERS) routes
  review requests and records ownership; *Require review from Code Owners* is off in branch protection,
  because a solo maintainer cannot approve his own pull request and `enforce_admins` has no exemption for
  him. So no path-specific human is *required* on any file, including the constitution: it is still
  protected by prohibition, not by the platform. See [`../../gate-map.md`](../../gate-map.md).
- **A green packaging check is not the platform's approval.**
  [`../../verify/plugin.sh`](../../verify/plugin.sh) checks this repository's own invariants — the
  manifests parse and agree, paths resolve, declared skills and agents are real. `claude plugin validate
  --strict` owns the Claude Code contract and is run by hand at checkpoints, not in CI. Neither is a
  superset: measured on the day both were adopted, the lint passed a manifest the platform refused, and
  the platform passed three broken skills the lint failed
  ([`../../memory/a-checkers-coverage-is-measured-not-named.md`](../../memory/a-checkers-coverage-is-measured-not-named.md)).
- **The test suites are discovered, not enumerated — and they cover the tooling, not the product.**
  [`../../verify/tests.sh`](../../verify/tests.sh) runs every `*.test.mjs` under
  [`../../../cli/`](../../../cli/), counting them before it runs them, so a suite added there is covered
  without this bullet changing — over `doctor`, `plugin-lint`, the enforcement compiler
  [`../../../cli/compile.mjs`](../../../cli/compile.mjs), the memory index generator
  [`../../../cli/index.mjs`](../../../cli/index.mjs), and the Stop-gate runner's arithmetic in
  [`../../compile/stop.mjs`](../../compile/stop.mjs). _(This sentence used to carry a count as well as
  that claim, and the count had drifted twice by milestone 5 while the claim beside it said a suite
  could be added without the bullet changing. The number is gone rather than corrected: the recipe
  prints the live figure, which is the carrier that cannot be wrong.)_ Nothing tests the verify recipes themselves
  ([`../../tasks/0004-a-harness-for-the-verify-recipes.md`](../../tasks/0004-a-harness-for-the-verify-recipes.md)),
  and there is no other product code yet. Treat green as "the modules those suites reach behave, and the
  documents are internally consistent" — never as "the product works".
