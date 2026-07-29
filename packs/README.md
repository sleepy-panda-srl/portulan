# packs/

Composable layers over the engine, each shipped as a plugin:

- `stacks/` — per-language / per-framework profiles.
- `tools/` — tool and MCP integrations.
- `rituals/` — repeatable procedures (e.g. PR babysitting, bot-review reconciliation).

A pack overrides `core`, and is itself overridden by the workspace, repo card, and task.

A pack declares what it contributes in a `pack.json` at its root, validated against
[`../spec/pack.schema.json`](../spec/pack.schema.json) — the Pack Definition, which is on its own
version train and not the Workspace Definition's. A workspace composes one by naming it in its `packs`
array, in the canonical `category/name` form.

> **One pack exists**, as of milestone 6: [`rituals/checkpoints`](rituals/checkpoints/README.md), the
> supervised-build ritual. `stacks/` and `tools/` are still empty and each says why.
>
> This file read "Nothing here yet" for four milestones, and the pack it predicted — a cross-artifact
> consistency check — is not the one that arrived. Recorded rather than quietly replaced: the first
> pack was chosen by which ritual this project could show working evidence for, not by which was named
> first.
