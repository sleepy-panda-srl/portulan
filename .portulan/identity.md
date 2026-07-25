# Identity — Sleepy Panda Works, building Portulan

> The **identity slot** ([`../spec/workspace.schema.json`](../spec/workspace.schema.json)): who this team
> is and what it works with — the first thing an agent should read after the kernel. Identity is policy:
> it is what makes an agent work **our** way rather than generically. _(See [`README.md`](README.md).)_
>
> Two things that lived here until milestone 2 now have slots of their own, because the Workspace
> Definition addresses a slot as a whole file: how we decide is [`principles.md`](principles.md), and
> what we are building is [`products/portulan/product.md`](products/portulan/product.md). Identity
> answers *who and with what*; those answer *how* and *what for*. They also change on different clocks —
> a stack row turns over every year or two, a principle almost never.

## Who

**Sleepy Panda Works** (Sleepy Panda SRL), a small product studio. On this repository the team is one
human maintainer who owns every decision, plus coding agents implementing under the supervised-build
protocol in [`../docs/plan.md`](../docs/plan.md): an implementer proposes, a **fresh-context** supervisor
grades against the constitution, and the human merges.

That shape drives more of our policy than the stack does. A solo maintainer is the bottleneck the plan
names as a standing risk, so the preference throughout is **rails that hold unattended** over process
that needs someone's attention on a schedule.

## What we are building here

Portulan — see [`products/portulan/product.md`](products/portulan/product.md) for the product layer, and
[`../docs/vision.md`](../docs/vision.md) for the constitution. The one fact that belongs *here*, because
it sets the bar for every document: the product **is** the files. There is no service and no UI, so the
quality bar on prose in this repository is a product bar, not a documentation bar.

## Stack

Deliberately thin, and it stays thin:

| Layer | Today | Arrives |
|---|---|---|
| Engine, packs, and spec prose | Markdown (`SKILL.md` / `AGENTS.md` conventions) | now |
| Verify recipes | Bash + POSIX text utilities; one of the two also needs `node` | now |
| Workspace Definition | JSON Schema — a named subset — with JSON manifests | milestone 2 |
| `doctor` | Zero-dependency JavaScript on Node, run from the repository | milestone 2 |
| Plugin packaging | Claude Code plugin manifest + skills | milestone 3 |
| CLI | TypeScript on Node via `npx` — absorbs `doctor` | milestone 7 |

No framework, no build step, no service, and no package manager: nothing here is installed before it
runs.

**Where the line sits now, precisely.** [`verify/docs.sh`](verify/docs.sh) needs `git`, `bash`, and the
POSIX text utilities and nothing else. [`verify/json.sh`](verify/json.sh) — and `doctor` after it — also
needs `node`. Each recipe declares its own needs in [`workspace.json`](workspace.json), which is what
keeps *could not run* distinguishable from *ran and failed*.

That line moved at milestone 2 rather than drifting: the milestone's criterion requires validating a
manifest against a schema, and there is no honest way to ask `bash` for that — a bash approximation of a
schema validator is a worse rail than no rail, because it would pass things it does not understand. What
survives is the property that actually mattered, and it is not the letter *bash*: a framework that needed
a toolchain to check itself would not survive its own "design for deletion" thesis. `node -e` with zero
dependencies and no install step is not a toolchain.

## Principles that are ours

Moved to [`principles.md`](principles.md) at milestone 2 — they are the workspace's **constitution slot**
and a slot is addressed as a whole file. Nothing about them changed in the move.

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
| **Verify recipe** | The executable check that decides "done" ([`verify/`](verify/)). A workspace may have several and names the default. |
| **Principles** | [`principles.md`](principles.md) — how *we* decide. Required, lives in this directory. This is what the milestone-2 criterion calls the *constitution slot*. |
| **Constitution** (the slot) | The separate document our work is graded against — for us [`../docs/vision.md`](../docs/vision.md), which sits *outside* this directory and is human-owned. Optional, and the only slot allowed to point outside the workspace. **Not** a synonym for **Principles**: one is how we work, the other is what we are judged by. |
| **Workspace Definition** | The schema a workspace is validated against ([`../spec/`](../spec/)). The contract between engine and team layer. |
| **Manifest** | [`workspace.json`](workspace.json) — the index naming this workspace's slots. An index, never a container: the prose stays in Markdown. |
| **Slot** | One named part of a workspace. A **path slot** points at a whole file or directory; a **structured slot** is data in the manifest, because something consumes it. |
| **Affordances** | What a product offers an agent working on it — and what it must not assume ([`products/portulan/affordances.md`](products/portulan/affordances.md)). |
| **Sealed provenance** | A rule's provenance given as owner + date + de-identified failure shape, when the incident cannot leave its owner's layer. The alternative form is a resolvable link. |
| **`doctor`** | The validator for a workspace: schema conformance, and workspace claims linted against the tree. Milestone 2. |
| **Stop-gate** | The machine check that blocks "done" when the recipe is not green. Milestone 4. |
| **Platform floor** | The gates the platform enforces whatever the prompt says — branch protection, required checks, `CODEOWNERS`. |
| **Session** | One supervised working thread here, from session-open to close — in practice one branch and one pull request. It is the unit the handoff and the Session log are written per. |
| **Supervisor** | The fresh-context reviewer that grades a session; never the implementer's own window. |
