# core/

The **engine**: the mechanism that is the same for every team, independent of stack or product domain.
Policy and identity live in the layers above it (`core < pack < workspace < repo card < task`); core
supplies the loop, the gates, the verification hierarchy, the memory lifecycle, and supervised evolution
— the parts a team should *not* have to reinvent.

Start at **[`engine.md`](engine.md)** — the always-loaded kernel (kept ≤ ~60 lines). Everything else
loads on demand.

## Layout

| Path | What lives here |
|---|---|
| [`engine.md`](engine.md) | The kernel: cascade, loop, non-negotiable gates, and the map. Always loaded. |
| [`operating/`](operating/) | The doctrine, one concern per file: loop · autonomy · verification · memory · evolution · safety. |
| [`templates/`](templates/) | The artifacts the doctrine references: repo-card · task · handoff · proposal · memory-entry. |
| [`personas/`](personas/) | Roles an agent takes, as context firewalls — each with a `tools:` allow-list. |
| [`skills/`](skills/) | Progressive-disclosure procedures in `SKILL.md` form. |

## How core is written

- **Rails, not prose.** Every rule either enforces itself (a hook, a compiled gate, a Stop-gate),
  measures itself (an eval), or earns its context-window tokens. The *why* stays in Markdown; the *must*
  compiles into machinery (the enforcement compiler, milestone 4).
- **Rationale and provenance on every rule.** Each convention names where it came from — from public
  agentic-engineering practice — so a future reader can weigh it and the librarian can retire it.
- **Authored fresh.** This engine is a clean-room re-expression from the constitution
  ([`../docs/vision.md`](../docs/vision.md)) and public practice; no prose is inherited from any prior
  framework.

## Status

**Milestone 1 — engine authored, and exercised.** The kernel, the six operating docs, the templates, the
exemplar personas ([`personas/`](personas/): implementer · reviewer · librarian), and the exemplar skills
([`skills/`](skills/): clarify · codify) are in place, and a concept-coverage pass against
[`../docs/vision.md`](../docs/vision.md) has run — every engine-relevant clause now has a home in core or
a recorded deferral.

The engine also has its first real instance of the layer above it: [`../.portulan/`](../.portulan/), this
repository's own workspace, where every "the workspace decides this" promise in these docs is answered
concretely. A task ran end-to-end on engine + that workspace with a recorded red→green verify, giving the
repository its first three machine checks: the kernel's line budget, which was stated doctrine with
nothing behind it, plus two rules minted from the defect that run exposed. The living map is
[`../docs/plan.md`](../docs/plan.md).
