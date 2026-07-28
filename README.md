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

Pre-release, and **public as of 27 July 2026** — by the maintainer's decision. `v0.1.0` is tagged; what
it contains — and, just as usefully, what it does not — is [`CHANGELOG.md`](CHANGELOG.md). The engine
in `core/`, the Workspace Definition in `spec/`, two workspaces, the validators that check them, and the
plugin packaging in `plugin/` and `.claude-plugin/` are authored; the remaining directories below fill in
milestone by milestone, and the `0.` major means nothing here is stable yet. The living map is
[`docs/plan.md`](docs/plan.md).

The quickest way to see what this is: read [`examples/`](examples/), a complete fictional workspace, then
run `node cli/doctor.mjs examples` to watch it validate.

## Layout

| Path | What lives here |
|---|---|
| `core/` | The engine: operating docs, personas, universal skills, templates |
| `packs/` | Composable packs — `stacks/`, `tools/`, `rituals/` |
| `spec/` | The Workspace Definition: schema, docs, migrations |
| `plugin/` | [The Claude Code adapter](plugin/): the `/portulan` boot skill, and why the agent bindings below sit at the root rather than here |
| `agents/` | [The three personas bound to this host's tools](agents/) — `implementer`, `reviewer`, `librarian`. A platform-fixed location: the default agents directory of a plugin whose root is this repository. The doctrine they bind stays in [`core/personas/`](core/personas/) |
| `.claude-plugin/` | The [plugin](.claude-plugin/plugin.json) and [marketplace](.claude-plugin/marketplace.json) manifests that make this repository an installable plugin feed |
| `cli/` | The `npx` CLI: `init` · `doctor` · `compile` · `vendor` · `index` · `upgrade`. [`doctor`](cli/doctor.mjs), [`plugin-lint`](cli/plugin-lint.mjs), [`compile`](cli/compile.mjs) and [`index`](cli/index.mjs) exist so far |
| `.claude/` | [The compiled enforcement](.claude/settings.json) — permissions and hooks generated from [`.portulan/gates.json`](.portulan/gates.json). Generated, committed so it is reviewable, and held to its source by the `compile` verify recipe, which holds the compiled platform floor in [`.portulan/compile/`](.portulan/compile/) the same way. Nothing else in this directory is tracked |
| `examples/` | [A fictional, public demo workspace](examples/) — two products, read end to end |
| `.portulan/` | [This repository's own workspace](.portulan/) — Portulan applied to building Portulan |
| `evals/` | Golden tasks, the A/B harness, the CI eval gate |
| `.github/` | CI workflows — runs every verify recipe the workspace declares, on every pull request — and the [Dependabot config](.github/dependabot.yml) that watches the Actions pins those workflows are held to |
| `docs/` | [`vision.md`](docs/vision.md) (the constitution) and [`plan.md`](docs/plan.md) (the milestone map) |

## Read next

- [`docs/vision.md`](docs/vision.md) — the constitution: what Portulan is, the thesis, the non-goals.
- [`docs/plan.md`](docs/plan.md) — the living milestone map and build protocol.

## Contributing

Portulan is developed in the open and is **not** open to outside code contributions. Read, clone and fork
freely; send bugs, proposals and feedback through the [issue forms](https://github.com/sleepy-panda-works/portulan/issues/new/choose). Code lands
only through team members. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the whole of it, including why.

## License

[Apache-2.0](LICENSE) © 2026 Sleepy Panda SRL.
