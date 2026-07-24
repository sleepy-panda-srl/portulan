# Portulan

**An operating framework for agentic engineering** — the tailored context, standards, gates, and
institutional memory a team needs so any coding agent works *their* way.

Portulan is an open-core product by [Sleepy Panda Works](https://sleepypanda.ro). The public engine,
spec, CLI, and a demo workspace live here, and the repository doubles as a public Claude Code plugin
marketplace. Commercial value lives in private feeds — customer workspaces and premium packs
delivered as private-marketplace plugins.

> **The name.** *Portulan* is the Romanian word for a portolan chart — a mariner's map compiled from
> the accumulated observations of real voyages: hard-won local knowledge, more valuable with every
> trip. The engine is the chartmaking method; your workspace is your portulan.

## Status

Pre-release, and **private during the build**. This repository is scaffolding toward `v0.1.0`: the
engine in `core/` and this repository's own workspace in `.portulan/` are authored, the remaining
directories below fill in milestone by milestone, and nothing here is stable yet. It goes public only
once the engine boots from a clean install and the milestone-3 criteria are met. The living map is
[`docs/plan.md`](docs/plan.md).

## Layout

| Path | What lives here |
|---|---|
| `core/` | The engine: operating docs, personas, universal skills, templates |
| `packs/` | Composable packs — `stacks/`, `tools/`, `rituals/` |
| `spec/` | The Workspace Definition: schema, docs, migrations |
| `plugin/` | Claude Code packaging (skills, agents, hooks, settings) |
| `.claude-plugin/` | The marketplace manifest that makes this repository an installable plugin feed |
| `cli/` | The `npx` CLI: `init` · `doctor` · `compile` · `vendor` · `index` · `upgrade` |
| `examples/` | A fictional, public demo workspace |
| `.portulan/` | [This repository's own workspace](.portulan/) — Portulan applied to building Portulan |
| `evals/` | Golden tasks, the A/B harness, the CI eval gate |
| `docs/` | [`vision.md`](docs/vision.md) (the constitution) and [`plan.md`](docs/plan.md) (the milestone map) |

## Read next

- [`docs/vision.md`](docs/vision.md) — the constitution: what Portulan is, the thesis, the non-goals.
- [`docs/plan.md`](docs/plan.md) — the living milestone map and build protocol.

## License

[Apache-2.0](LICENSE) © 2026 Sleepy Panda SRL.
