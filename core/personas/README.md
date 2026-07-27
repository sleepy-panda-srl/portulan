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
- **Autonomy reach** — the highest **tier** the role may act in, in tier vocabulary (Auto / Propose /
  Gated), not concrete actions — the gate map that binds actions to tiers is workspace policy (see
  [`../operating/autonomy.md`](../operating/autonomy.md)). **Prohibited is never a reach**: it is the
  one tier no role may act in, so it does not appear here — a persona declaring it would be claiming a
  permission that does not exist for anyone.

  **A reach is a tier, never a mode.** The two axes share the words *Auto* and *Gated*, so this is the
  place the confusion would land first. A reach is a *ceiling on what this role may do*; the workspace's
  autonomy **mode** is *how often the cycle stops*, and it is nobody's persona to declare. A mode can
  move a concrete action across the line a reach draws — a merge is in the Gated tier at `gated` mode and
  in the Auto tier at `auto` — and a persona that may not act in the Gated tier still may not merge under
  `auto`, because a reach bounds the role and a mode only says how often anyone is asked. Where a persona
  file must say both, it writes "the Auto tier" or "Auto mode" and never the bare word.
- **Memory scope** — memory is per-agent; a reviewer's memory is not the implementer's (see
  [`../operating/memory.md`](../operating/memory.md)).
- **Read / write posture** — most personas read in parallel; writes are isolated to one place so two
  agents never clobber the same file.

## Status

**Milestone 3 — contract, exemplars, and one host binding.** This README fixes the persona contract; the
exemplar personas [`implementer`](implementer.md), [`reviewer`](reviewer.md), and
[`librarian`](librarian.md) are authored against it. They stay host-agnostic — each `tools:` allow-list
is a set of capability classes — and milestone 3 bound those classes to concrete Claude Code tools in
[`../../agents/`](../../agents/), which is where a host's vocabulary is allowed to appear.

**The binding is lossy, and that is the useful finding.** Of the three charters, exactly one
survives translation into a tool grant: the reviewer *does not edit the code under review*, so its
agent is granted no write tool and the firewall becomes a rail. The other two do not. The
implementer's Auto/Gated line cannot be drawn with a tool list on a host where one `Bash` grant
covers both running a verify recipe and merging a pull request; the librarian's *drafts everything,
accepts nothing* is a constraint on what it may conclude, not on what it may call. Each agent file
says which of the three it is, so nobody reads a frontmatter list as the gate. What holds those two
is the workspace's gate map and the platform floor — which is the constitution's point that the
platform floor is the gate no prompt can bypass, met from the other direction.
