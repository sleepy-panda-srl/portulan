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

## Per-agent, not global

Memory is scoped to the agent or persona that uses it, not dumped into one shared pool. A reviewer's
memory and an implementer's memory answer different questions; merging them spends the budget of each
on the other's concerns. _(Provenance: Letta; see `../personas/`.)_
