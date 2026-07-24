# core/personas/

A **persona** is a role an agent takes — implementer, reviewer, librarian — packaged as a **context
firewall**: its own attention window, its own memory, and a `tools:` allow-list that grants only what
the role needs. The parent loop fans work out to a persona and gets back a conclusion, not the persona's
whole transcript, so the parent's context budget stays clean. _(Provenance: HumanLayer — subagents as
context firewalls; Cognition — read-parallel / write-isolated.)_

## What a persona file carries

- **`tools:` allow-list** — default-deny; the role's least-privilege surface (see
  [`../operating/safety.md`](../operating/safety.md) and [`../operating/autonomy.md`](../operating/autonomy.md)).
- **Charter** — what the role is for, and just as importantly what it must *not* do.
- **Autonomy reach** — the highest tier the role may act in, in tier vocabulary (Auto / Propose /
  Gated), not concrete actions — the gate map that binds actions to tiers is workspace policy (see
  [`../operating/autonomy.md`](../operating/autonomy.md)).
- **Memory scope** — memory is per-agent; a reviewer's memory is not the implementer's (see
  [`../operating/memory.md`](../operating/memory.md)).
- **Read / write posture** — most personas read in parallel; writes are isolated to one place so two
  agents never clobber the same file.

## Status

**Milestone 1 — contract + exemplars.** This README fixes the persona contract; the exemplar personas
[`implementer`](implementer.md), [`reviewer`](reviewer.md), and [`librarian`](librarian.md) are now
authored against it (after the concept-coverage pass). They are host-agnostic — each `tools:` allow-list
is a set of capability classes; milestone 3 binds those to concrete host tools and formalizes each as a
plugin agent.
