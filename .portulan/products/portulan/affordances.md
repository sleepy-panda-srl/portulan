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
| A **machine-readable manifest** | [`../../workspace.json`](../../workspace.json) | Names every slot and where it lives, so an agent can find the policy layer without guessing at directory conventions. |
| **Templates for every artifact** | [`../../../core/templates/`](../../../core/templates/) | Repo card · task · handoff · proposal · memory entry. Placeholders are in `{braces}`; fill and delete what does not apply. |
| **Actions bound to tiers** | [`../../gate-map.md`](../../gate-map.md) | Every concrete action this repository permits is classified Auto / Propose / Gated, so an agent can tell unattended work from work that needs a human. |
| A **dated handoff series** | [`../../handoffs/`](../../handoffs/) | Filenames lead with an ISO date, so the series sorts chronologically and is machine-consumable without parsing prose. |
| **Memory with retirement conditions** | [`../../memory/`](../../memory/) | One fact per file, each with provenance and a "retire when" clause — so a rule can be judged, not just obeyed. |
| **Network-free, deterministic checks** | [`../../verify/README.md`](../../verify/README.md) | Nothing fetches. A check that fails for reasons unrelated to the change under test is worse than no check. |
| A **platform floor that holds against everyone** | [`../../gate-map.md`](../../gate-map.md) | `main` rejects direct pushes, requires `docs-integrity` green, and exempts nobody — including the maintainer. |

## What an agent must not assume

Written at the same level of detail, because a legibility report that lists only strengths is marketing.

- **Nothing runs the verify recipe for you.** The Stop-gate that blocks "done" on a red recipe is
  milestone 4. Until then it is condition 1 of [`../../dod.md`](../../dod.md) and a habit.
- **The gate map is not compiled.** It is honoured by people and by review, not by hooks or permissions.
  The compiler is milestone 4. The platform floor beneath it *is* real; the tiers above it are not.
- **The manifest is not yet validated.** `doctor` — which checks it against the schema and lints its
  claims against the tree — lands in the second milestone-2 session. Today
  [`../../verify/json.sh`](../../verify/json.sh) checks only that the JSON parses.
- **There is no agent-legibility score.** This slot is the input such an audit would read; the scoring
  itself is not built, and calling this file a score would be exactly the overclaim
  [`../../principles.md`](../../principles.md) forbids.
- **Memory has no generated index.** [`../../memory/`](../../memory/) is a flat directory; recall means
  reading filenames. The size-budgeted index arrives with the librarian in milestone 5.
- **`links` has two known false greens.** Wrong-case link targets pass on a case-insensitive volume, and
  paths written as code spans are never checked at all. Both are recorded in
  [`../../verify/README.md`](../../verify/README.md); the second has already cost this repository two
  dead pointers that survived several reviews.
- **There is no `CODEOWNERS`.** No path-specific human is required on any file, including the
  constitution. It is protected by prohibition, not by the platform.
- **There are no tests, because there is no code yet.** The recipes lint documents. Treat green as "the
  documents are internally consistent", never as "the product works".
