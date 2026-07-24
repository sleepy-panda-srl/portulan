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

**Milestone 1, first cut.** The kernel, the six operating docs, and the templates are authored;
`personas/` and `skills/` carry their shape-defining READMEs, with exemplar personas and skills — and a
concept-coverage pass — to follow in the next M1 session. The living map is
[`../docs/plan.md`](../docs/plan.md).
