# Memory

> Core doctrine — loaded on demand. Institutional knowledge that outlives the task, the window, and the
> agent. Memory is the durable half of the product's value: workflow is designed for deletion, memory
> is designed to compound. _(Vision thesis 2.)_

## The lifecycle

A memory moves through four states; each has an owner and a budget.

| State | What happens |
|---|---|
| **Capture** | The Learn phase writes a candidate memory — a fact, a decision, or a rule — with its provenance. |
| **Consolidate** | Off the hot path, candidates are merged, de-duplicated, and sharpened into durable form. Contradictions surface rather than silently overwrite. |
| **Index** | A size-budgeted index is generated so the right memory is recalled without loading all of it. The index is built, never hand-maintained. |
| **Retire** | A memory whose incident can no longer occur, or whose rule was superseded, is demoted or deleted. Memory that only grows becomes noise. |

_(Provenance: Letta — per-agent memory and sleep-time consolidation; Anthropic context engineering —
an attention budget per layer, hence the generated, size-budgeted index.)_

## One fact per memory, with provenance

A memory holds one fact and states where it came from. A rule links to the **incident** that created
it, so a future reader can judge whether it still applies — and so the librarian can retire it once the
incident has been designed out. Memory without provenance is folklore: you cannot safely delete what you
cannot trace. _(Provenance: compounding engineering — Every. See `evolution.md` and
`../templates/memory-entry.md`.)_

## Agents draft it; humans own it

Agents may draft memory — they are well placed to notice what a task taught — but they do not silently
promote it into the curated layer. Generated context that no human accepted degrades the window;
curated context improves it, and the difference is measurable. So capture is agent work, and
consolidation into the curated layer is a reviewed step. _(Provenance: ETH Zurich, arXiv:2602.11988 —
generated context hurts, curated helps. The scheduled librarian that runs consolidation, indexing, and
retirement arrives in milestone 5; core defines the lifecycle it executes.)_

## Storage follows ownership

Memory lives in the layer whose owner controls it. A team's specifics — their incidents, their repo
quirks, their decisions — persist in **their** workspace and nowhere else; core and packs carry only what
is universal, and never absorb a team's material by consolidating it upward. _(Vision thesis 6 — tailored
answers, owned specifics.)_

This is what keeps the cascade honest over time. Nothing in the lifecycle above moves a memory up a layer
by itself, and that is deliberate: a consolidation pass that hoisted a team's facts into core would
quietly convert the customer's institutional knowledge into the vendor's — the one thing an operating
framework must not do to the people who adopt it.

**Promotion sheds specifics.** A lesson may travel upward — that is how universal practice accumulates —
but only by generalizing, and only as a proposal through the human gate: shedding the specifics is
necessary, never sufficient. It arrives at the higher layer with the team's names, systems, and
identifiers removed, stated as the mechanism rather than the episode — and it arrives as a *proposed
rule*, never as a memory entry relocated upward. A rule that cannot be stated without the team's
specifics has not finished generalizing and does not belong above their workspace. _(See `evolution.md`
for the gate, and `../skills/codify/SKILL.md` step 2 — wrong altitude is also how specifics leak
upward.)_

**A known unresolved edge.** Provenance is meant to travel with the rule, but an incident that cannot
leave its owner's layer cannot be linked from a public one. Such a rule today carries a de-identified
statement of the failure it prevents instead of a resolvable link — weaker, because provenance that is
only prose cannot be checked, and a rule whose provenance cannot be checked is one the librarian cannot
safely retire. Giving it a verifiable form — so that a rule can never arrive with no provenance at all —
needs surface that does not exist yet: a provenance slot in the Workspace Definition (milestone 2) and
the retirement logic the librarian runs against it (milestone 5). Recorded here as open rather than
resolved in prose, because doctrine that promises machinery it does not have is the failure this engine
is written to avoid.

## Per-agent, not global

Memory is scoped to the agent or persona that uses it, not dumped into one shared pool. A reviewer's
memory and an implementer's memory answer different questions; merging them spends the budget of each
on the other's concerns. _(Provenance: Letta; see `../personas/`.)_
