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
| [`compile/`](compile/) | The runtime the Claude Code artifact points at — the `PreToolUse` gate and the `Stop` gate — and the compiled platform floor, [`compile/github-ruleset.json`](compile/github-ruleset.json) |
| [`tools/`](tools/) | Operator tooling — how this repository is *run*, as distinct from how a change is checked |
| [`repos/`](repos/) | Repo cards — one per repository this workspace covers |
| [`memory/`](memory/) | Durable facts with provenance, one per file |
| [`memory-index.md`](memory-index.md) | The generated index of that store — one line per record, built by [`../cli/index.mjs`](../cli/index.mjs) and never by hand. It sits *beside* the store rather than in it, because `doctor` counts every `.md` in the store as a record |
| [`tasks/`](tasks/) | Task files: the atomic unit of work and of context |
| [`handoffs/`](handoffs/) | Decisions and their why, carried across sessions and windows |
| [`proposals/`](proposals/) | Agent-drafted rule changes waiting on the human gate |

## Which workspace is which

Three workspaces appear in the plan and they are easy to confuse:

| Workspace | Where | Public? | Covers |
|---|---|---|---|
| **This one** — `.portulan/` | here | by design yes — **not reachable today**, see below | building Portulan itself: dogfooding |
| Demo workspace | [`../examples/`](../examples/) | by design yes — same reach as above | a fictional team with two products, so a stranger can read a complete workspace end to end |
| Sleepy Panda portfolio | private feed (milestone 6) | no, by design | every Sleepy Panda product |

_**Reach, as of 2026-08-10.** `Public?` above is design intent; this line is state, and the two stopped
agreeing on 2026-08-03. The first two ship in the open-core repository, which was public 2026-07-27 →
2026-08-03 and is **private again since 2026-08-03** — so no stranger can reach either one today, and
the marketplace install path requires authentication. The third is in the private feed and was never
meant to be reachable. What the public window published cannot be unpublished: clones taken in it are
not recallable._

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
- **Compiled gates, as of milestone 4 — two backends, and neither covers everything.** [`gates.json`](gates.json)
  compiles to [`../.claude/settings.json`](../.claude/settings.json), so Gated actions prompt and the
  constitution is refused outright; `auto` and `propose` compile to **nothing** there, deliberately, since
  the compiler emits restriction only. It also compiles to
  [`compile/github-ruleset.json`](compile/github-ruleset.json), the platform floor as importable data,
  where the partition inverts and `propose` is exactly what is enforced. **Three gates this workspace
  *declares* are compiled by neither backend** — renaming or transferring the repository, spending money,
  sending something outward — and `compile --matrix` and `doctor` both name them, because a policy
  stating a gate nothing enforces must never read as configured. **Composition adds a fourth, and until 2026-08-13 the two
  printers disagreed on the total** — `--matrix` counted `rituals/checkpoints`'
  `self-certify-a-checkpoint` and reported 4 where `doctor` reported 3. `doctor` now reads the policy the
  workspace *yields* and they agree; [`gate-map.md`](gate-map.md) carries the argument. The **platform floor beneath it all is configured and live** — `main` rejects
  direct pushes and requires `workspace-verify` and `pr-labeled` green, with no exemption for
  administrators — so what still rests on review is the tiers above the floor, not the floor. _(The exact
  context string matters when cross-checking branch protection: it is the job id, not the workflow's
  display name.)_
- **A generated memory index and a scheduled librarian, both as of milestone 5.**
  [`memory-index.md`](memory-index.md) is emitted from [`memory/`](memory/) by
  [`../cli/index.mjs`](../cli/index.mjs), and the `index` recipe byte-compares it and fails on a
  breach of the budgets [`workspace.json`](workspace.json) declares. It is *built, never
  hand-maintained* ([`../core/operating/memory.md`](../core/operating/memory.md)) in the checkable
  sense: every field on a line comes from the record it points at, so there is nothing in the file an
  editor could put out of step with the store. The **scheduled librarian** exists as of 2026-07-28
  ([`../cli/librarian.mjs`](../cli/librarian.mjs), scheduled weekly by
  [`../.github/workflows/librarian.yml`](../.github/workflows/librarian.yml)): it reindexes, ages every
  record from git, nags a sealed stamp's owner to re-validate, chases undecided proposals and drafts
  demotions, and files the result as a pull request. **It has not filed one yet** — that waits on the
  merge and on the two repository secrets the workflow needs, which are the maintainer's. **A pass is a session** (the maintainer's ruling,
  2026-07-28), so it ends with a dated handoff in [`handoffs/`](handoffs/) and one Session log entry,
  exactly as a human session does; the `record` check does not know the difference and does not need
  to. Two halves of the librarian's charter are **still on demand**: mining incidents and reviews into
  proposals, and running consolidation. On this store nothing currently fires — the thresholds are 90
  / 180 / 30 days and the oldest record is days old — and the pass says so rather than staying silent.
- **No packs and no rituals.** Nothing this build does yet repeats often enough to earn one.
