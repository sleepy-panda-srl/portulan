# Identity — Sleepy Panda Works, building Portulan

> The workspace's answer to *who is this team and how do they work* — the first thing an agent should
> read after the kernel. Identity is policy: it is what makes an agent work **our** way rather than
> generically. _(See [`README.md`](README.md).)_

## Who

**Sleepy Panda Works** (Sleepy Panda SRL), a small product studio. On this repository the team is one
human maintainer who owns every decision, plus coding agents implementing under the supervised-build
protocol in [`../docs/plan.md`](../docs/plan.md): an implementer proposes, a **fresh-context** supervisor
grades against the constitution, and the human merges.

That shape drives more of our policy than the stack does. A solo maintainer is the bottleneck the plan
names as a standing risk, so the preference throughout is **rails that hold unattended** over process
that needs someone's attention on a schedule.

## What we are building here

Portulan — an operating framework for agentic engineering; open-core, files-first
([`../docs/vision.md`](../docs/vision.md)). The product *is* the files: there is no service and no UI, so
the quality bar on prose in this repository is a product bar, not a documentation bar.

## Stack

Deliberately thin, and it stays thin:

| Layer | Today | Arrives |
|---|---|---|
| Engine, packs, and spec prose | Markdown (`SKILL.md` / `AGENTS.md` conventions) | now |
| Verify recipes | Bash, nothing beyond `git` and coreutils | now |
| Workspace Definition | JSON Schema | milestone 2 |
| Plugin packaging | Claude Code plugin manifest + skills | milestone 3 |
| CLI | TypeScript on Node, shipped via `npx` | milestone 7 |

No framework, no build step, no service. Anyone with `git` and `bash` can run everything this repository
can currently verify — which is the point: a framework that needs a toolchain to check itself would not
survive its own "design for deletion" thesis.

## Principles that are ours

Core doctrine is not restated here. These are the ones specific to this team, each with its reason.

- **Write the limit, not the aspiration.** Every document says what exists *today* and names the
  milestone where the rest lands. _Why:_ the repository goes public at milestone 3 as a pre-release, and
  a framework that overclaims about its own enforcement burns the only asset an unknown project has.
  _Applied:_ every "arrives in milestone N" note in this workspace, and the platform-floor admission in
  [`gate-map.md`](gate-map.md).
- **Prefer the rail to the reminder.** Given a choice between a rule an agent must remember and a check
  that fails loudly, take the check — even a cruder one. _Why:_ solo-maintainer economics; an unenforced
  rule in a repository with one reviewer is a rule that quietly stops being true. _Applied:_
  [`verify/docs.sh`](verify/docs.sh) — one rule this repository had stated and never checked (the
  kernel's line budget), plus two more minted from the defect that exposed them.
- **Fresh expression, always.** Every sentence in this repository is authored here, from the
  constitution and public practice. _Why:_ this is a provenance property of the product rather than a
  style preference, and unlike most quality bars it cannot be retrofitted later.
- **No private-engagement material, ever.** No names, identifiers, paths, or artifacts of any private
  client engagement enter these files, commit messages, branch names, or the session log — the binding
  non-goal in [`../docs/vision.md`](../docs/vision.md). The pre-commit scan that enforces it is defined
  outside this repository; running it is condition 5 of [`dod.md`](dod.md).

## Glossary

These words mean exactly this here; ambiguity in them is what costs most.

| Term | Meaning |
|---|---|
| **Engine** | [`../core/`](../core/) — the universal mechanism, identical for every team. |
| **Kernel** | [`../core/engine.md`](../core/engine.md) — the always-loaded file, held under a line budget. |
| **Workspace** | The per-team policy layer. This directory is ours. |
| **Pack** | A composable layer — stack, tool, or ritual — sitting between core and workspace. |
| **Repo card** | The per-repository facts an agent cannot safely infer ([`repos/`](repos/)). |
| **Task** | The atomic unit of work *and* of context — self-contained enough to hand to a fresh window. |
| **Lane** | Which weight of the loop a task takes: `full` or `triage`. |
| **Gate map** | The binding of concrete actions to autonomy tiers. Policy, hence workspace-owned. |
| **Verify recipe** | The executable check that decides "done" ([`verify/`](verify/)). |
| **Stop-gate** | The machine check that blocks "done" when the recipe is not green. Milestone 4. |
| **Platform floor** | The gates the platform enforces whatever the prompt says — branch protection, required checks, `CODEOWNERS`. |
| **Supervisor** | The fresh-context reviewer that grades a session; never the implementer's own window. |
