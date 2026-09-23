# Identity — Sleepy Panda SRL, building Portulan

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

**Sleepy Panda SRL** (Sleepy Panda SRL), a small product studio. On this repository the team is one
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
| Verify recipes | Bash + POSIX text utilities; of the recipes **this workspace declares**, every one **except** `docs` also needs `node`, and `workflow-filters` needs `jq`. A composed pack's recipe declares its own needs and may sit below this line | now |
| Workspace Definition | JSON Schema — a named subset — with JSON manifests | now |
| `doctor` · `plugin-lint` · `compile` · `index` · `librarian` | Zero-dependency JavaScript on Node, run from the repository | now — [`../cli/`](../cli/) |
| Tests | `node --test`, node's own runner — no framework, no install | now — every `*.test.mjs` under [`../cli/`](../cli/). **No count is written here**, on this file's own convention about hand-maintained figures: `node --test` derives it and a count nobody writes cannot go stale. |
| Plugin packaging | Claude Code plugin + marketplace manifests, engine skills, personas as agents | now — [`../plugin/`](../plugin/) and [`../.claude-plugin/`](../.claude-plugin/) |
| CLI | **Zero-dependency ESM on Node** via `npx`, ruled 2026-07-31 against this row's earlier *TypeScript on Node* — a build step would end the property the paragraph below protects. One entry over the **eight** `docs/vision.md` names — it named six until 2026-08-03, when `new` and `feedback` were folded in from row 7 — dispatching to all eight — `init`, `doctor`, `compile`, `vendor`, `index`, `upgrade`, `new` and `feedback`; the tools on no milestone-7 list are rostered once, in [`../cli/README.md`](../cli/README.md), and a ninth subcommand is the maintainer's call | **now** — [`../cli/portulan.mjs`](../cli/portulan.mjs); this cell read *partly now* while `upgrade` exited 2, until milestone 7 session 9 built it |

No framework, no build step, no service, and nothing installed before it runs **from a checkout** —
which is the property, stated with the boundary the CLI put on it. `package.json` exists as of
milestone 7 and declares **no dependencies**: it names the `bin` that `npx @sleepy_panda_srl/portulan`
exposes — **published 2026-08-18 at `0.1.0`**, on the maintainer's word, the publish itself Gated as it
always was — and nothing else. `npm install` fetches nothing, and every tool here still
runs as `node cli/<tool>.mjs` straight from a clone.

**The `npx` path IS an install, and having no build step makes that a checkable claim rather than a
preference: it installs the SAME BYTES.**

_The rest of this section is in [`identity/stack.md`](identity/stack.md): why the Tests row carries no
count, the same-bytes measurement at each cut, where each recipe's line sits and why, and the one tool
deliberately outside it. Read it before a release, a checkpoint, or a change to what a recipe needs._

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
| **`doctor`** | The validator for a workspace ([`../cli/doctor.mjs`](../cli/doctor.mjs)): schema conformance, path resolution, cross-references, workspace claims linted against the tree, and rule provenance. Checks form, never truth — with one measured exception since milestone 7: a **pointer's** `governed_by` is dereferenced against the host's installed-plugin record ([`../cli/discover.mjs`](../cli/discover.mjs)), which is a fact about a host rather than a form. It is **reported and never graded**, so no install state moves a verdict. |
| **`plugin-lint`** | The validator for this repository's *packaging* ([`../cli/plugin-lint.mjs`](../cli/plugin-lint.mjs)): the two manifests parse and agree, component paths resolve inside the tree, declared skills and agents are real. **Not** the platform's contract — that is `claude plugin validate`, and neither is a superset of the other. |
| **Tree** (the slot) | Where the repository a workspace makes claims *about* begins. Declared, not inferred: present means `doctor` lints those claims; absent means the workspace describes repositories not present beside it, and they are reported unverifiable. |
| **Stop-gate** | The machine check that blocks "done" when the recipe is not green. Live since milestone 4 ([`cli/stop-gate.mjs`](../cli/stop-gate.mjs)); it also holds the session-end handoff. Capped at three **consecutive** refusals **per reason** — each reason's count clearing only when that reason's own condition clears, since the cap targets a futile-retry episode rather than a long session that fixes several reds — under an absolute ceiling of nine that does not reset, because a gate that cannot stop is a hang. |
| **`compile`** | The enforcement compiler ([`../cli/compile.mjs`](../cli/compile.mjs)): [`gates.json`](gates.json) becomes [`../.claude/settings.json`](../.claude/settings.json) for the Claude Code host, and [`compile/github-ruleset.json`](compile/github-ruleset.json) for the platform floor. Emits restriction only — never an `allow` rule — and generates the floor rather than applying it. |
| **Backend** | One target an enforcement compiler emits for. Each partitions the same policy its own way and accounts for every rule as compiled or refused-with-a-reason; `compile --matrix` prints all of them side by side. |
| **The floor backend** | The GitHub repository ruleset: what every host falls back to, and all that a host with no hook system has. |
| **Gate policy** vs **gate map** | [`gates.json`](gates.json) is the policy a machine reads and the compiler dispatches on; [`gate-map.md`](gate-map.md) is the prose that argues it. Where they disagree the policy wins, because it is the one that compiles. |
| **Platform floor** | The gates the platform enforces whatever the prompt says — branch protection, required checks. |
| **Session** | One supervised working thread here, from session-open to close — in practice one branch and one pull request. It is the unit the handoff and the Session log are written per. |
| **Supervisor** | The fresh-context reviewer that grades a session; never the implementer's own window. |
