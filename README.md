# Portulan

**An operating framework for agentic engineering** — the tailored context, standards, gates and
institutional memory a team needs so that any coding agent works *their* way.

[![npm](https://img.shields.io/npm/v/%40sleepy_panda_srl%2Fportulan?logo=npm&label=npm)](https://www.npmjs.com/package/@sleepy_panda_srl/portulan)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js)](package.json)

Portulan is an open-core product by [Sleepy Panda SRL](https://sleepypanda.ro). The engine, the
Workspace Definition, the CLI and a complete demo workspace are public and live in this repository,
which doubles as a Claude Code plugin marketplace. Commercial value lives in private feeds — customer
workspaces and premium packs delivered as private-marketplace plugins.

> **The name.** *Portulan* is the Romanian word for a portolan chart — a mariner's map compiled from
> the accumulated observations of real voyages: hard-won local knowledge, more valuable with every
> trip. The engine is the chartmaking method; your workspace is your portulan.

---

## Status

**Current release: `0.1.1`** — recorded in [`CHANGELOG.md`](CHANGELOG.md), which is also the honest
account of what the release does *not* contain.

This is pre-release software. The leading `0.` is meant literally: nothing here is stable yet, and
the surface may change between minor versions. What is authored today is the engine in [`core/`](core/),
the Workspace Definition in [`spec/`](spec/), two complete workspaces, the CLI in [`cli/`](cli/) with
all eight subcommands, the enforcement compiler, the memory lifecycle and the plugin packaging. The remaining directories
fill in milestone by milestone; [`docs/plan.md`](docs/plan.md) is the living map of that work.

The repository is **public** — reading, cloning, forking and installing the plugin need no account of
ours. Visibility is a live repository setting, so trust a fresh look at the repository page over this
sentence.

## Install

### As a Claude Code plugin

This repository *is* a plugin marketplace, so installing it takes two commands — no clone, no token,
no GitHub account.

```bash
claude plugin marketplace add sleepy-panda-srl/portulan
```

```bash
claude plugin install portulan@portulan
```

Then run `/portulan` inside Claude Code to boot the engine. That gives you the **engine**; your
workspace is still yours to draft, which is what `portulan init` is for.

### As a command-line tool

```bash
npx @sleepy_panda_srl/portulan doctor examples
```

Requires Node.js 20 or newer. The package has zero runtime dependencies.

### From GitHub Packages

Every release from **`v0.1.1`** onward also publishes the same tree to GitHub Packages, where the
registry requires the scope to match the repository owner — so there it is named
**`@sleepy-panda-srl/portulan`**, with hyphens. Releases before that one are on npmjs only.

**This route needs a GitHub token even though the package is public**, which is GitHub Packages' rule
rather than ours — so the registry line alone is not enough, and the authentication is shown rather
than alluded to. In an `.npmrc`:

```
@sleepy-panda-srl:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_GITHUB_PACKAGES_TOKEN}
```

```bash
NPM_GITHUB_PACKAGES_TOKEN=<your token> npm install @sleepy-panda-srl/portulan
```

The token is a **personal access token of your own** — not the `GITHUB_TOKEN` that GitHub Actions
provides, which exists only inside a workflow run — and it needs only the `read:packages` scope. npm
expands the `${...}` reference from the environment, so the token itself never has to be written into
the file.

The npmjs path above needs no account of ours and remains the documented one; this is an additional
route for people already inside GitHub's authentication. The two registries serve the same tree under
two names, so the tarballs are *not* byte-identical: packed both ways they differ in exactly one line
of one file — `package.json`'s `name`. The roster is the same on both sides; `npm pack --dry-run`
derives it, which is why no count is written here.

## Quick start

Read before you install anything. [`examples/`](examples/) is a complete fictional workspace — two
products, read end to end — and validating it from a clone is one command:

```bash
node cli/doctor.mjs examples
```

To adopt Portulan in your own repository, `portulan init` interviews you, scans the codebase and
drafts a workspace; `portulan doctor` validates it; `portulan compile` turns your gate policy into
host enforcement.

## Command-line interface

Two invocations, and they run the same code. `npx @sleepy_panda_srl/portulan <command>` needs no
checkout; `node cli/<tool>.mjs` runs from a clone, and is how this repository measures itself.

**There is no build step, so the package is not a compiled artifact.** Every file it ships is
byte-identical to its tracked source at the commit it was cut from — a property you can check rather
than take on trust, and one a compiled artifact could not offer. A verify recipe holds it on every
commit, refusing any packed file that differs from its source.

`portulan --help` is the tree's own answer, and the table below is the enumeration:

| Command | What it does |
|---|---|
| [`init`](cli/init.mjs) | Interview plus codebase scan, producing a drafted workspace |
| [`doctor`](cli/doctor.mjs) | Validate a workspace against the Workspace Definition |
| [`compile`](cli/compile.mjs) | Turn gates and verify recipes into host enforcement |
| [`vendor`](cli/vendor.mjs) | Materialise a workspace where it is needed, in either direction |
| [`index`](cli/index.mjs) | Rebuild the declared indexes over memory, handoffs and personas |
| [`upgrade`](cli/upgrade.mjs) | Migrate a workspace across Workspace Definition versions |
| [`new`](cli/new.mjs) | Scaffold a skill, persona, pack, workspace, gate policy or repo card |
| [`feedback`](cli/feedback.mjs) | File a bug, improvement or feedback issue you previewed first |

Beside the eight sit tools that are deliberately not subcommands, and the compiled-hook runners, which
are not subcommands at all. [`cli/README.md`](cli/README.md) is the single carrier of that wider roster.

## Repository layout

| Path | What lives here |
|---|---|
| `core/` | [The engine](core/): operating doctrine, personas, universal skills, templates |
| `spec/` | [The Workspace Definition](spec/) — schema, documentation, migrations |
| `cli/` | [The Node CLI](cli/) described above, plus its tests and the compiled-hook runners |
| `packs/` | [Composable packs](packs/) — `stacks/`, `tools/`, `rituals/` |
| `plugin/` | [The Claude Code adapter](plugin/): the `/portulan` boot skill |
| `agents/` | [The three personas bound to this host's tools](agents/) — `implementer`, `reviewer`, `librarian`. A platform-fixed location; the doctrine they bind stays in [`core/personas/`](core/personas/) |
| `examples/` | [A fictional, public demo workspace](examples/) — two products, read end to end |
| `docs/` | [`vision.md`](docs/vision.md) (the constitution), [`plan.md`](docs/plan.md) (the milestone map) and [`milestones/`](docs/milestones/) — one file per milestone, holding amendment arguments, session notes and close evidence |
| `evals/` | [A README today](evals/), and nothing else. The golden tasks, the A/B harness and the CI eval gate arrive at milestone 8 |
| `.portulan/` | [This repository's own workspace](.portulan/) — Portulan applied to building Portulan |
| `.claude-plugin/` | The [plugin](.claude-plugin/plugin.json) and [marketplace](.claude-plugin/marketplace.json) manifests that make this repository an installable feed |
| `.claude/` | [The compiled enforcement](.claude/settings.json) — permissions and hooks generated from [`.portulan/gates.json`](.portulan/gates.json), committed so it stays reviewable and held to its source by the `compile` verify recipe |
| `.github/` | [CI workflows](.github/), which run every verify recipe the workspace yields, and the [Dependabot config](.github/dependabot.yml) that watches their Action pins |

## Documentation

- [`docs/vision.md`](docs/vision.md) — the constitution: what Portulan is, the theses, the non-goals.
- [`docs/plan.md`](docs/plan.md) — the living milestone map and the build protocol.
- [`spec/`](spec/) — the Workspace Definition your own policy layer is validated against.
- [`CHANGELOG.md`](CHANGELOG.md) — every release and what changed in it.

## Contributing

Portulan is **not open to outside code contributions**, and that is a deliberate posture rather than a
temporary state. Reading, cloning and forking are what the licence allows; bugs, proposals and feedback
go through the [issue forms](https://github.com/sleepy-panda-srl/portulan/issues/new/choose); code lands
only through team members.

Those open paths are open to anyone and need no permission from us; the closed one is closed by choice
rather than by reach. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the whole of it, including why.

## Security

Please do not report a security issue in an issue. [`SECURITY.md`](SECURITY.md) is the policy: the
channels in the order to try them, what is in scope, and what response you can actually expect.

## License

[Apache-2.0](LICENSE) © 2026 Sleepy Panda SRL. See [`NOTICE`](NOTICE).
