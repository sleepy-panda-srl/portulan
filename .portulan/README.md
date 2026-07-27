# `.portulan/` — Portulan's own workspace

> The **policy layer** of this repository, in the shape the engine expects of any team.
> [`../core/`](../core/) is mechanism and is identical for everyone who adopts Portulan; this directory
> is the half that is *ours* — who we are, which concrete action sits behind which gate, what "done"
> means here, and what the build has already learned. _(Mechanism/policy separation:
> [`../docs/vision.md`](../docs/vision.md), thesis 1.)_

## Why a workspace lives in the product's own repo

Portulan is **customer zero** — the framework is built the way it tells teams to build (see
[`../core/operating/evolution.md`](../core/operating/evolution.md)). Two consequences follow, and both
are the point:

- **It makes the doctrine falsifiable.** Every place `core/` says *the workspace decides this* — the
  gate map, the triage threshold, the default verify recipe, the DoD extension — was a promise with no
  instance behind it. Writing the instance is how those promises get tested, and the gaps it exposed are
  recorded in [`proposals/`](proposals/) rather than smoothed over.
- **It was the material the schema got derived from.** The plan sequences re-expression *before* schema
  deliberately — derive the spec from real content instead of guessing it. In milestone 2 that happened:
  the freeform documents here became the slots in [`../spec/`](../spec/), and this workspace became the
  first instance of the definition it produced, via [`workspace.json`](workspace.json). Two slots were
  forced into existence by the exercise — [`principles.md`](principles.md) and
  [`products/`](products/) — because a slot is addressed as a whole file and both had been sections of
  [`identity.md`](identity.md). One slot was resisted on purpose: `products` is an array even though this
  workspace has exactly one product, since a schema derived faithfully from a single sample would have
  modelled it singular and been wrong by milestone 6. _(See [`../spec/slots.md`](../spec/slots.md) for
  each slot's derivation.)_

## Layout

| Path | What lives here |
|---|---|
| [`workspace.json`](workspace.json) | The **manifest**: which slots this workspace fills and where each one lives |
| [`identity.md`](identity.md) | Who this team is, the stack, the glossary |
| [`principles.md`](principles.md) | The constitution slot: the principles this team's work is graded against |
| [`products/`](products/) | The product layer, one directory per product — mission/what/why, and agent affordances |
| [`gate-map.md`](gate-map.md) | The policy half of autonomy: concrete actions bound to the engine's tiers |
| [`dod.md`](dod.md) | Definition of done here — this workspace's extension of core's floor |
| [`verify/`](verify/) | The verify recipes — one of which the Stop-gate now runs — and what each check enforces |
| [`gates.json`](gates.json) | The gate policy the enforcement compiler reads: actions bound to tiers, in this workspace's vocabulary rather than a host's |
| [`labels.json`](labels.json) | The pull-request label set, read by [`../.github/workflows/pr-labels.yml`](../.github/workflows/pr-labels.yml) — policy here, checker there |
| [`compile/`](compile/) | The runtime the compiled artifact points at — the `PreToolUse` gate and the `Stop` gate |
| [`tools/`](tools/) | Operator tooling — how this repository is *run*, as distinct from how a change is checked |
| [`repos/`](repos/) | Repo cards — one per repository this workspace covers |
| [`memory/`](memory/) | Durable facts with provenance, one per file |
| [`tasks/`](tasks/) | Task files: the atomic unit of work and of context |
| [`handoffs/`](handoffs/) | Decisions and their why, carried across sessions and windows |
| [`proposals/`](proposals/) | Agent-drafted rule changes waiting on the human gate |

## Which workspace is which

Three workspaces appear in the plan and they are easy to confuse:

| Workspace | Where | Public? | Covers |
|---|---|---|---|
| **This one** — `.portulan/` | here | yes — public since 2026-07-27 | building Portulan itself: dogfooding |
| Demo workspace | [`../examples/`](../examples/) | yes | a fictional team with two products, so a stranger can read a complete workspace end to end |
| Sleepy Panda portfolio | private feed (milestone 6) | no | every Sleepy Panda product |

## Deliberately not here yet

Honest limits, each with the milestone that closes it:

- **A validated manifest, and it does not validate the interesting part.**
  [`workspace.json`](workspace.json) declares this workspace against
  [`../spec/workspace.schema.json`](../spec/workspace.schema.json), and since the second milestone-2
  session [`../cli/doctor.mjs`](../cli/doctor.mjs) checks the declaration: schema conformance, every path
  resolving, the cross-references, this directory's claims against the tree, and every rule's provenance.
  It runs in CI on every pull request. What it cannot check is whether any of these documents is still
  *true* — whether the gate map's tiers are honoured, whether a mission statement has drifted, whether a
  sealed stamp describes a real incident. The machine catches absence; the human judges substance.
- **Compiled gates, as of milestone 4 — for two tiers of four.** [`gates.json`](gates.json) compiles to
  [`../.claude/settings.json`](../.claude/settings.json), so Gated actions prompt and the constitution is
  refused outright. `auto` and `propose` compile to **nothing**, deliberately: the compiler emits
  restriction only, and `propose` is the platform floor's job. Those refusals are printed on every run
  rather than passed over. **Which tier some of those rules hold is a setting** as of 2026-07-27: this
  workspace declares autonomy mode **`auto`**, so no agent-side prompt is raised anywhere in the cycle,
  including at the merge. The engine *ships* `gated` (one approval at the ship step) as its
  recommendation; customer zero runs the most autonomous mode deliberately. `strict` asks at every push. A session may tighten its own mode and never loosen it (`node cli/mode.mjs`).
  A mode never moves the platform floor, at any value. See
  [The three modes](gate-map.md#the-three-modes). The **platform
  floor beneath it is configured** — `main` rejects direct pushes
  and requires the status check `workspace-verify` green, with no exemption for administrators — so what
  still rests on review is the tiers above the floor, not the floor. _(The exact context string matters
  when cross-checking branch protection: it is the job id, not the workflow's display name.)_
- **No generated memory index.** [`memory/`](memory/) is a flat directory. The size-budgeted index is
  *built, never hand-maintained* ([`../core/operating/memory.md`](../core/operating/memory.md)), so
  writing one by hand now would contradict the doctrine it implements; it arrives with the scheduled
  librarian at milestone 5.
- **No packs and no rituals.** Nothing this build does yet repeats often enough to earn one.
