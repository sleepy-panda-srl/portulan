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

Pre-release, and **private as of 3 August 2026** — by the maintainer's decision, after a public window of
27 July – 3 August 2026. Two consequences worth stating plainly: the marketplace install path
**currently requires authentication**, and "public" in the paragraph above names the open-core **layer**
this repository holds rather than who can reach it today. Reopening it is Gated and the maintainer's.
The newest release entry
is **`0.2.0`**; what it contains — and, just as usefully, what it does not — is
[`CHANGELOG.md`](CHANGELOG.md). The engine in `core/`, the Workspace Definition in `spec/`, two
workspaces, the validators that check them, the enforcement compiler and the memory lifecycle, and the
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
| `cli/` | The `npx` CLI: the eight `docs/vision.md` names. The [`portulan`](cli/portulan.mjs) entry point exists as of milestone 7 and dispatches seven of them — [`init`](cli/init.mjs), [`doctor`](cli/doctor.mjs), [`compile`](cli/compile.mjs), [`vendor`](cli/vendor.mjs), [`index`](cli/index.mjs), [`new`](cli/new.mjs), [`feedback`](cli/feedback.mjs) — while `upgrade` exits 2 until a later session. _(This cell said "five" and then listed four, which is the kind of arithmetic a reader checks and a rail cannot.)_ Beside them sit tools that are off the eight by the maintainer's call, and the compiled-hook runners, which are not subcommands at all — [`cli/README.md`](cli/) is the one carrier of that roster, and this cell named a different three from the one `portulan.mjs` named while four were on disk |
| `.claude/` | [The compiled enforcement](.claude/settings.json) — permissions and hooks generated from [`.portulan/gates.json`](.portulan/gates.json). Generated, committed so it is reviewable, and held to its source by the `compile` verify recipe, which holds the compiled platform floor in [`.portulan/compile/`](.portulan/compile/) the same way. Nothing else in this directory is tracked |
| `examples/` | [A fictional, public demo workspace](examples/) — two products, read end to end |
| `.portulan/` | [This repository's own workspace](.portulan/) — Portulan applied to building Portulan |
| `evals/` | Golden tasks, the A/B harness, the CI eval gate |
| `.github/` | CI workflows — runs every verify recipe the workspace **yields** — its own, plus those its composed packs contribute — on every pull request — and the [Dependabot config](.github/dependabot.yml) that watches the Actions pins those workflows are held to |
| `docs/` | [`vision.md`](docs/vision.md) (the constitution), [`plan.md`](docs/plan.md) (the milestone map), and [`milestones/`](docs/milestones/) — **one file per milestone**, zero-padded so they sort, holding the amendment arguments, session notes and close evidence that used to live inside the table's rows. The row is the law; the file is the legislative history |

## Read next

- [`docs/vision.md`](docs/vision.md) — the constitution: what Portulan is, the thesis, the non-goals.
- [`docs/plan.md`](docs/plan.md) — the living milestone map and build protocol.

## Contributing

Portulan is built as an open-core product and is **not** open to outside code contributions. When the
repository is reachable: reading, cloning and forking are what the licence allows; bugs, proposals and
feedback go through the [issue forms](https://github.com/sleepy-panda-works/portulan/issues/new/choose);
and code lands only through team members.

**None of those paths is open to an outsider today** — see **Status** above. The repository is private as
of 3 August 2026 and forking is disabled, and an issue form is no more reachable than the tree: filing one
needs access to the repository too. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the whole of it, including why.

## License

[Apache-2.0](LICENSE) © 2026 Sleepy Panda SRL.
