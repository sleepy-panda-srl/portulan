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

Pre-release, and **public** — reading, cloning, forking and the marketplace install path all need no
account of ours. _(Visibility is Gated and has moved three times: public 27 July – 3 August 2026, private
3 August – 17 August 2026, public since 17 August 2026. It is a live setting, so trust a fresh check
over this line.)_
The newest release entry
is **`0.2.0`**; what it contains — and, just as usefully, what it does not — is
[`CHANGELOG.md`](CHANGELOG.md). The engine in `core/`, the Workspace Definition in `spec/`, two
workspaces, the validators that check them, the enforcement compiler and the memory lifecycle, and the
plugin packaging in `plugin/` and `.claude-plugin/` are authored; the remaining directories below fill in
milestone by milestone, and the `0.` major means nothing here is stable yet. The living map is
[`docs/plan.md`](docs/plan.md).

## Try it

This repository **is** a Claude Code plugin marketplace, so installing it needs nothing but the two
lines below — no GitHub account, no token, no clone. (You need Claude Code itself, of course.)

```bash
claude plugin marketplace add sleepy-panda-works/portulan
```

```bash
claude plugin install portulan@portulan
```

Then, inside Claude Code, run the `/portulan` slash command to boot the engine. _(Measured on 2026-08-18 into an isolated `CLAUDE_CONFIG_DIR`: the
marketplace resolved, the plugin installed, and the payload landed in the cache with `core/engine.md`
present. What that gives you is the **engine** — a workspace is still yours to draft, which is what
[`cli/init.mjs`](cli/init.mjs) is for.)_

Or read before you install anything: [`examples/`](examples/) is a complete fictional workspace, and
`node cli/doctor.mjs examples` from a clone watches it validate.

## Layout

| Path | What lives here |
|---|---|
| `core/` | The engine: operating docs, personas, universal skills, templates |
| `packs/` | Composable packs — `stacks/`, `tools/`, `rituals/` |
| `spec/` | The Workspace Definition: schema, docs, migrations |
| `plugin/` | [The Claude Code adapter](plugin/): the `/portulan` boot skill, and why the agent bindings below sit at the root rather than here |
| `agents/` | [The three personas bound to this host's tools](agents/) — `implementer`, `reviewer`, `librarian`. A platform-fixed location: the default agents directory of a plugin whose root is this repository. The doctrine they bind stays in [`core/personas/`](core/personas/) |
| `.claude-plugin/` | The [plugin](.claude-plugin/plugin.json) and [marketplace](.claude-plugin/marketplace.json) manifests that make this repository an installable plugin feed |
| `cli/` | The `npx` CLI: the eight `docs/vision.md` names. **`npx` is the shape, not a live path — publishing is Gated and has not happened, so the package is not on the registry, and the invocation this repository measures everything through is `node cli/<tool>.mjs` from a clone; [`.portulan/identity.md`](.portulan/identity.md) carries that fact and [#242](https://github.com/sleepy-panda-works/portulan/issues/242) the open routing question.** The [`portulan`](cli/portulan.mjs) entry point exists as of milestone 7 and dispatches **all eight** since session 9 — [`init`](cli/init.mjs), [`doctor`](cli/doctor.mjs), [`compile`](cli/compile.mjs), [`vendor`](cli/vendor.mjs), [`index`](cli/index.mjs), [`upgrade`](cli/upgrade.mjs), [`new`](cli/new.mjs), [`feedback`](cli/feedback.mjs). _(This cell said "five" and then listed four, and later "seven" while `upgrade` was unbuilt — the kind of arithmetic a reader checks and a rail cannot.)_ Beside them sit tools that are off the eight by the maintainer's call, and the compiled-hook runners, which are not subcommands at all — [`cli/README.md`](cli/) is the one carrier of that roster, and this cell named a different three from the one `portulan.mjs` named while four were on disk |
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

Portulan is built as an open-core product and is **not** open to outside code contributions. Reading,
cloning and forking are what the licence allows; bugs, proposals and feedback go through the
[issue forms](https://github.com/sleepy-panda-works/portulan/issues/new/choose); and code lands only
through team members.

**Those paths are open to anyone, and the closed one is closed by choice rather than by reach** — the
tree and the issue forms need no account of ours and no permission from us, and code still lands only
through team members. That distinction is the whole posture, and it reads the same whichever way
visibility points. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the whole of it, including why.

## License

[Apache-2.0](LICENSE) © 2026 Sleepy Panda SRL.
