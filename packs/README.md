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

## Why there is a `.claude-plugin/plugin.json` in *this* directory

Because **this directory is itself a plugin payload**, and it had been shipping as one while declaring
nothing. The private feed's `portulan-checkpoints` entry is a `git-subdir` source rooted here, so what a
host installs is the contents of `packs/` — and until 2026-08-09 that payload carried no plugin manifest
at all. The host had nothing to read, registered nothing, and said so only as a count nobody was
watching: **`claude plugin details portulan-checkpoints@portulan-internal` → `Skills (0)`**, for the
whole of milestone 6 and after.

That is [#134](https://github.com/sleepy-panda-srl/portulan/issues/134)'s `Skills (0)` bullet, and the
issue's own diagnosis of it was wrong: it attributed the zero to a declared path pointing one level too
high, which is a real trap and a different one. Measured on Claude Code 2.1.226 by installing this
directory both ways — **`Skills (0)` without the manifest, `Skills (3)` with it**, the same three
`SKILL.md` files either way.

The manifest declares `./rituals/checkpoints/skills/` — the directory that actually holds them — because
**a host expands a declared skills path exactly one level and no further**. Declaring `./rituals/`
registers nothing, silently, while a validator walking deeper counts three;
[`../cli/plugin-lint.mjs`](../cli/plugin-lint.mjs) fails that shape for exactly this reason. Two
manifests therefore sit in this tree and they answer different questions: the repository's own at
[`../.claude-plugin/plugin.json`](../.claude-plugin/plugin.json), which declares
`./packs/rituals/checkpoints/skills/` because *its* root is the repository; and this one, whose root is
`packs/`. Neither is redundant, and the paths differ by exactly the prefix their roots differ by.

**The version here mirrors the pack's own** — `portulan.version` in
[`rituals/checkpoints/pack.json`](rituals/checkpoints/pack.json), which the Pack Definition names as how
independent versioning is expressed — and it is the number a host displays for the installed plugin.
Nothing checks the two agree, which is stated rather than railed because the feed pins a **commit**
rather than a version, so the pin is what actually decides which bytes install.

**One half of the measurement above has not been run and cannot be yet.** `Skills (0) → Skills (3)` was
observed through a *local* marketplace over a copy of this directory. The quoted failing command names
`portulan-checkpoints@portulan-internal`, and its green half can only be observed after this commit
exists and the feed's pin moves to it. Until then the green is demonstrated on the payload and inferred
for the feed — a distinction this repository would rather write down than round off.

> **Two packs exist.** [`rituals/checkpoints`](rituals/checkpoints/README.md), the supervised-build
> ritual, as of milestone 6; and [`tools/github`](tools/github/README.md), one verify recipe, authored
> at milestone 7 session 5 because a demonstration needed a real subject. `stacks/` is still empty and
> says why. _(This said "One pack exists … `stacks/` and `tools/` are still empty" from milestone 6
> until 2026-08-13, and the second half went false the day `tools/github` landed beside it.)_
>
> This file read "Nothing here yet" for four milestones, and the pack it predicted — a cross-artifact
> consistency check — is not the one that arrived. Recorded rather than quietly replaced: the first
> pack was chosen by which ritual this project could show working evidence for, not by which was named
> first.
