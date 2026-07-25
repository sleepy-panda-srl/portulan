# packs/

Composable layers over the engine, each shipped as a plugin:

- `stacks/` — per-language / per-framework profiles.
- `tools/` — tool and MCP integrations.
- `rituals/` — repeatable procedures (e.g. PR babysitting, bot-review reconciliation).

A pack overrides `core`, and is itself overridden by the workspace, repo card, and task.

> Placeholder. Nothing here yet: the first pack — a cross-artifact consistency-check ritual — is
> sequenced **after milestone 2**, because it needs the Workspace spec to exist first (see
> [`../core/skills/README.md`](../core/skills/README.md)). Previously marked "from milestone 1",
> which closed with these directories empty.
