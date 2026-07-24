# Supervised evolution

> Core doctrine — loaded on demand. How the curated layer changes over time without drifting. Memory
> (`memory.md`) is the store; evolution is the governance of changes to it. This is the moat: a framework
> that cannot safely improve itself rots, and one that improves itself without a gate drifts.

## Every mistake compiles into a rule

When something goes wrong, the fix is not only the patch — it is a **rule that makes the class of
mistake impossible or caught**, carrying a link to the incident that motivated it. Over time the rule
set becomes a compacted history of everything the team learned the hard way. _(Provenance: compounding
engineering — Every; the mistake→rule-with-provenance loop — agentic craft, Hashimoto.)_

A rule earns its place only if it **enforces itself** (a hook, a compiled gate, a Stop-gate),
**measures itself** (an eval), or is worth the context-window tokens it costs as prose. A rule that does
none of these is demoted to reference, not kept standing. _(Vision thesis 3 — rails, not prose.)_

## Agent-drafted, human-owned

Agents draft rule changes; humans own them. The curated layer is never edited by an agent on its own
authority: a change is a **proposal**, and a proposal becomes a rule only through a reviewed,
eval-gated PR. It is the same gate as for code (see `autonomy.md`), applied to the framework's own
rules. _(Provenance: ETH Zurich — curated beats generated; spec-driven — the human-owned constitution;
binding non-goal — no unsupervised self-evolution. See `../templates/proposal.md`.)_

## Speed up the gate; never remove it

The human gate is the guarantee, so the work is to make it cheap — not to bypass it:

- **Proposals as PRs** — a rule change is reviewable, diff-able, and revertable like any other change.
- **The librarian nags** — a scheduled pass mines incidents and PR reviews into draft proposals and
  chases stale ones, so the backlog is drafted *for* the human rather than *by* them. _(The codify
  ritual; provenance: compounding engineering. Built in milestone 5.)_
- **Evals decide where they can** — once golden tasks exist, a rule change carries evidence and is
  merged or rejected on the eval result rather than on taste. _(Milestone 8.)_

## Portulan is customer zero

The framework is built the way it tells teams to build. The two-tier supervised build — an implementer
plus a fresh-context supervisor grading against the constitution — is this doctrine turned on Portulan's
own construction. If the doctrine will not hold for its own repository, it is not ready to ship.
