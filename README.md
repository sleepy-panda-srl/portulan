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

Pre-release, and **private during the build**. What `v0.1.0` will contain when it is tagged — and, just
as usefully, what it will not — is [`CHANGELOG.md`](CHANGELOG.md). The engine
in `core/`, the Workspace Definition in `spec/`, two workspaces, the validators that check them, and the
plugin packaging in `plugin/` and `.claude-plugin/` are authored; the remaining directories below fill in
milestone by milestone, and the `0.` major means nothing here is stable yet. It goes public once a
separate clearance completes. The living map is [`docs/plan.md`](docs/plan.md).

The quickest way to see what this is: read [`examples/`](examples/), a complete fictional workspace, then
run `node cli/doctor.mjs examples` to watch it validate.

## Layout

| Path | What lives here |
|---|---|
| `core/` | The engine: operating docs, personas, universal skills, templates |
| `packs/` | Composable packs — `stacks/`, `tools/`, `rituals/` |
| `spec/` | The Workspace Definition: schema, docs, migrations |
| `plugin/` | [The Claude Code adapter](plugin/): the `/portulan` boot skill and the personas bound to this host's tools |
| `agents/` | [The three personas bound to this host's tools](agents/) — `implementer`, `reviewer`, `librarian`. A platform-fixed location: the default agents directory of a plugin whose root is this repository. The doctrine they bind stays in [`core/personas/`](core/personas/) |
| `.claude-plugin/` | The [plugin](.claude-plugin/plugin.json) and [marketplace](.claude-plugin/marketplace.json) manifests that make this repository an installable plugin feed |
| `cli/` | The `npx` CLI: `init` · `doctor` · `compile` · `vendor` · `index` · `upgrade`. Only [`doctor`](cli/doctor.mjs) exists so far, alongside [`plugin-lint`](cli/plugin-lint.mjs) |
| `examples/` | [A fictional, public demo workspace](examples/) — two products, read end to end |
| `.portulan/` | [This repository's own workspace](.portulan/) — Portulan applied to building Portulan |
| `evals/` | Golden tasks, the A/B harness, the CI eval gate |
| `.github/` | CI workflows — runs the workspace verify recipe on every pull request |
| `docs/` | [`vision.md`](docs/vision.md) (the constitution) and [`plan.md`](docs/plan.md) (the milestone map) |

## Read next

- [`docs/vision.md`](docs/vision.md) — the constitution: what Portulan is, the thesis, the non-goals.
- [`docs/plan.md`](docs/plan.md) — the living milestone map and build protocol.

## License

[Apache-2.0](LICENSE) © 2026 Sleepy Panda SRL.
