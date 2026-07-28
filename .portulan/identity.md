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
| Verify recipes | Bash + POSIX text utilities; every recipe but `docs` also needs `node`, and `workflow-filters` needs `jq` | now |
| Workspace Definition | JSON Schema — a named subset — with JSON manifests | now |
| `doctor` · `plugin-lint` · `compile` | Zero-dependency JavaScript on Node, run from the repository | now — [`../cli/`](../cli/) |
| Tests | `node --test`, node's own runner — no framework, no install | now — every `*.test.mjs` under [`../cli/`](../cli/), four as of milestone 4 |
| Plugin packaging | Claude Code plugin + marketplace manifests, engine skills, personas as agents | now — [`../plugin/`](../plugin/) and [`../.claude-plugin/`](../.claude-plugin/) |
| CLI | TypeScript on Node via `npx` — absorbs `doctor`, `plugin-lint` and `compile` | milestone 7 |

No framework, no build step, no service, and no package manager: nothing here is installed before it
runs.

**Where the line sits now, precisely.** [`verify/docs.sh`](verify/docs.sh) needs `git`, `bash`, and the
POSIX text utilities and nothing else, and it is the only one that stops there: every other recipe —
[`verify/json.sh`](verify/json.sh), [`verify/doctor.sh`](verify/doctor.sh),
[`verify/tests.sh`](verify/tests.sh), [`verify/plugin.sh`](verify/plugin.sh),
[`verify/compile.sh`](verify/compile.sh) and
[`verify/workflow-filters.sh`](verify/workflow-filters.sh) — also needs `node`. Each recipe declares
its own needs in [`workspace.json`](workspace.json), which is the authority on this line rather than
the paragraph you are reading, and is what keeps *could not run* distinguishable from *ran and failed*.

**One recipe needs a third thing, and it is the first since milestone 2 to move this line.**
[`verify/workflow-filters.sh`](verify/workflow-filters.sh) needs **`jq`**, because what it checks is
jq's own behaviour: two merge-gate workflows branch on what a jq program prints for null input, and no
other tool can answer for that. Same test as milestone 2 applied to a different binary — the property
that matters is not the letter *bash*, it is that nothing is installed before it runs, and `jq` is
present on the maintainer's machine and on `ubuntu-latest` alike — **measured on the first CI run of
that recipe, `jq-1.7` on the runner against `jq-1.7.1` locally**, rather than assumed. The cost is
stated rather than hidden: on a machine without it that recipe exits `2`, and the six others still run.

**One tool is deliberately outside that line.** `claude plugin validate --strict` — the authority on the
Claude Code plugin contract — is run by hand at the supervised checkpoints and before a release, and is
**not** a verify recipe. Declaring it would make a recipe that exits `2` on every CI run, since CI here
installs nothing; and installing it would make this workflow a build. The cost of that choice is that the
platform's contract is checked at a checkpoint rather than on every pull request, which is stated in
[`verify/README.md`](verify/README.md) rather than left to be discovered.

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
| **`doctor`** | The validator for a workspace ([`../cli/doctor.mjs`](../cli/doctor.mjs)): schema conformance, path resolution, cross-references, workspace claims linted against the tree, and rule provenance. Checks form, never truth. |
| **`plugin-lint`** | The validator for this repository's *packaging* ([`../cli/plugin-lint.mjs`](../cli/plugin-lint.mjs)): the two manifests parse and agree, component paths resolve inside the tree, declared skills and agents are real. **Not** the platform's contract — that is `claude plugin validate`, and neither is a superset of the other. |
| **Tree** (the slot) | Where the repository a workspace makes claims *about* begins. Declared, not inferred: present means `doctor` lints those claims; absent means the workspace describes repositories not present beside it, and they are reported unverifiable. |
| **Stop-gate** | The machine check that blocks "done" when the recipe is not green. Live since milestone 4 ([`compile/stop.mjs`](compile/stop.mjs)); it also holds the session-end handoff. Capped at three **consecutive** refusals **per reason** — each reason's count clearing only when that reason's own condition clears, since the cap targets a futile-retry episode rather than a long session that fixes several reds — under an absolute ceiling of nine that does not reset, because a gate that cannot stop is a hang. |
| **`compile`** | The enforcement compiler ([`../cli/compile.mjs`](../cli/compile.mjs)): [`gates.json`](gates.json) becomes [`../.claude/settings.json`](../.claude/settings.json) for the Claude Code host, and [`compile/github-ruleset.json`](compile/github-ruleset.json) for the platform floor. Emits restriction only — never an `allow` rule — and generates the floor rather than applying it. |
| **Backend** | One target an enforcement compiler emits for. Each partitions the same policy its own way and accounts for every rule as compiled or refused-with-a-reason; `compile --matrix` prints all of them side by side. |
| **The floor backend** | The GitHub repository ruleset: what every host falls back to, and all that a host with no hook system has. |
| **Gate policy** vs **gate map** | [`gates.json`](gates.json) is the policy a machine reads and the compiler dispatches on; [`gate-map.md`](gate-map.md) is the prose that argues it. Where they disagree the policy wins, because it is the one that compiles. |
| **Platform floor** | The gates the platform enforces whatever the prompt says — branch protection, required checks. |
| **Session** | One supervised working thread here, from session-open to close — in practice one branch and one pull request. It is the unit the handoff and the Session log are written per. |
| **Supervisor** | The fresh-context reviewer that grades a session; never the implementer's own window. |
