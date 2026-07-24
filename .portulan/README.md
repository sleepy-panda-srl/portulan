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
- **It is the material the schema gets derived from.** Milestone 2 defines the Workspace Definition, and
  the plan sequences re-expression *before* schema deliberately — derive the spec from real content
  instead of guessing it. This is that content, and none of it is a schema. The repo card, the task, the
  handoff, the proposal, and the memory entries are instantiated from
  [`../core/templates/`](../core/templates/); identity, the gate map, the DoD, and the verify recipe have
  no template yet — they are exactly the freeform material milestone 2 derives its slots from.

## Layout

| Path | What lives here |
|---|---|
| [`identity.md`](identity.md) | Who this team is, the stack, the principles that are ours, the glossary |
| [`gate-map.md`](gate-map.md) | The policy half of autonomy: concrete actions bound to the engine's tiers |
| [`dod.md`](dod.md) | Definition of done here — this workspace's extension of core's floor |
| [`verify/`](verify/) | The verify recipe the Stop-gate will run, and what each check enforces |
| [`repos/`](repos/) | Repo cards — one per repository this workspace covers |
| [`memory/`](memory/) | Durable facts with provenance, one per file |
| [`tasks/`](tasks/) | Task files: the atomic unit of work and of context |
| [`handoffs/`](handoffs/) | Decisions and their why, carried across sessions and windows |
| [`proposals/`](proposals/) | Agent-drafted rule changes waiting on the human gate |

## Which workspace is which

Three workspaces appear in the plan and they are easy to confuse:

| Workspace | Where | Public? | Covers |
|---|---|---|---|
| **This one** — `.portulan/` | here | with the repo, at milestone 3 | building Portulan itself: dogfooding |
| Demo workspace | [`../examples/`](../examples/) | yes | a fictional team, so a stranger can read a complete workspace end to end |
| Sleepy Panda portfolio | private feed (milestone 6) | no | every Sleepy Panda product |

## Deliberately not here yet

Honest limits, each with the milestone that closes it:

- **No manifest and no schema.** The Workspace Definition arrives at milestone 2. Until then this is
  documents, and their shape is evidence *for* that schema rather than an instance of it.
- **No compiled gates.** [`gate-map.md`](gate-map.md) is read and honoured by people and agents; the
  compiler that turns it into hooks and permissions is milestone 4. Today the map's authority is review,
  not machinery — and the platform floor beneath it is not configured either (see the gate map).
- **No generated memory index.** [`memory/`](memory/) is a flat directory. The size-budgeted index is
  *built, never hand-maintained* ([`../core/operating/memory.md`](../core/operating/memory.md)), so
  writing one by hand now would contradict the doctrine it implements; it arrives with the scheduled
  librarian at milestone 5.
- **No packs and no rituals.** Nothing this build does yet repeats often enough to earn one.
