---
name: codify
description: Turn a just-surfaced mistake or a repeating review comment into a draft rule-change proposal with provenance. Use right after an incident, a postmortem, or a PR review that exposes a recurring failure — the output is a proposal routed to the human/eval gate, never a rule merged on the agent's own authority.
---

# Skill — Codify

> Every mistake compiles into a rule. Codify is that compile step: it takes the thing that just went
> wrong and produces a *reviewable proposal* for the rule that would make the class of mistake
> impossible or caught — carrying the incident that motivated it. _(Provenance: compounding engineering
> — Every; the mistake→rule-with-provenance loop — agentic craft, Hashimoto. See
> [`../../operating/evolution.md`](../../operating/evolution.md).)_

## When to use it

- An incident or near-miss just happened that could recur.
- A review comment keeps reappearing across PRs — a pattern, not a one-off.
- A postmortem or handoff names a lesson worth making permanent.

Not for one-offs (those belong in the task) and not for standing rules that already exist (those belong
in [`../../operating/`](../../operating/) as doctrine). A lesson that will not recur is not a rule.

## The pass

1. **Name the incident and link it.** A proposal without a triggering incident is usually taste, not a
   rule. **When the incident cannot leave its owner's layer** — it belongs to a team, a customer, or a
   confidentiality boundary — the rule still carries its shape: strip the names, tickets, paths, and
   domains, and keep the concrete failure that motivated it, which is the inputs, the wrong outcome, and
   why the obvious guard misses it. The bar is that an implementer who never saw the incident can still
   write the rule's test. **Generic must never decay into vague**: a rule that lost its failure shape
   lost the thing that made it enforceable, and de-identifying is not the same as abstracting away. Such
   a rule's provenance is **sealed**: it carries that de-identified failure shape in place of the link.
   See [`../../operating/memory.md`](../../operating/memory.md), which records this edge and what is
   still unresolved about giving it a form a checker can verify.
2. **Draft the rule at the right altitude** — the most specific layer that still generalizes:
   `core` (universal), a `pack` (stack/tool/ritual), or the `workspace` (team policy). Wrong altitude
   is how rules bloat the always-loaded window — and how a team's specifics leak upward into layers that
   must not hold them. Anything above the workspace carries the mechanism, never the episode.
   _(See [`../../operating/memory.md`](../../operating/memory.md) — storage follows ownership.)_
3. **Attach how it earns its place** — a hook, a compiled gate, a Stop-gate, or an eval; or, if none
   fits, the argument for why it is worth context-window tokens as prose. Rules that enforce or measure
   themselves beat rules you must remember. _(Vision — rails, not prose.)_
4. **File it as a proposal, do not merge it.** Fill [`../../templates/proposal.md`](../../templates/proposal.md)
   and open it as a PR into the human/eval gate. The curated layer is agent-drafted, human-owned.

## Why it earns its tokens

It **enforces** the discipline that turns incidents into a compacting history instead of repeated
pain, and it keeps provenance attached so the rule can later be **retired** when its incident is
designed out. This is the on-demand form of what the scheduled **librarian** runs as a batch pass in
**milestone 5** — same ritual, same output shape. _(See [`../../personas/librarian.md`](../../personas/librarian.md).)_
