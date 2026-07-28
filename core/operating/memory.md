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
| **Index** | A size-budgeted index is generated so the right memory is recalled without loading all of it. The index is built, never hand-maintained — every field on a line is derived from the record it points at, so there is nothing in the file an editor could put out of step with the store. |
| **Retire** | A memory whose incident can no longer occur, or whose rule was superseded, is demoted or deleted. Memory that only grows becomes noise. |

_(Provenance: Letta — per-agent memory and sleep-time consolidation; Anthropic context engineering —
an attention budget per layer, hence the generated, size-budgeted index.)_

A budget here is a rail, not an aim. When a layer breaches its budget, the remedy is consolidation —
merge, compress, retire — never squeezing past the breach, and never raising the budget in the same
change that broke it. **The breach is machinery as of milestone 5**: a workspace declares its budgets
in the manifest, the index is generated rather than written, and a verify recipe goes red when either
the index or the store is over. The procedure that answers a red is
[`../skills/consolidate/SKILL.md`](../skills/consolidate/SKILL.md).

**The other half of that sentence is not machinery, and saying so is the point.** Nothing checks that
a budget was not simply raised in the change the breach appeared in — refusing that needs a checker
that reads history, and a check that reads history produces false reds in a shallow CI checkout,
which is worse than no check at all. So the breach is a rail and the *remedy* is a rule the human
gate holds. Written down rather than implied, because a rule nothing checks that is presented as one
that does is the failure this page would otherwise be demonstrating.

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

**The edge where provenance cannot travel, and the form it now takes.** Provenance is meant to travel
with the rule, but an incident that cannot leave its owner's layer cannot be linked from a public one.
That collision has a defined answer as of milestone 2: provenance takes one of exactly two forms, and one
of them is mandatory. **Public** — a resolvable link to the incident. **Sealed** — an owner and a date
plus the de-identified failure shape, for an incident that stays in its owner's workspace. A rule
carrying neither is not a rule. The normative shape is `$defs/provenance` in
[`../../spec/workspace.schema.json`](../../spec/workspace.schema.json); the reasoning and the limits are
in [`../../spec/slots.md`](../../spec/slots.md).

What this bought is that provenance can no longer be *absent*, and that the weaker form is declared
rather than silently substituted. Three things it did not buy, stated because the gap between them is
where this doctrine would otherwise start overclaiming:

- **The machine checks a stamp's form, never its truth.** A fabricated seal validates exactly as a real
  one does. Substance is human review's job, held to the bar in `../skills/codify/SKILL.md` step 1.
- **A sealed rule still cannot be retired on evidence.** The librarian cannot see the incident, so it
  cannot judge whether the incident can still recur. It **nags the owner to re-validate** on the stamp's
  date instead — a scheduled question rather than silent rot. That logic arrives in milestone 5; until
  then the sealed form defers retirement rather than enabling it.
- **A workspace can seal everything and opt out of retirement entirely.** Which is why the *sealed
  proportion* is reported as a health signal rather than left to be noticed — by `doctor`, from
  milestone 2. Until it runs, nothing counts seals and nothing rejects a rule that carries no provenance
  at all; both are human review's job, as everything on this page was before there was a schema to check
  against.

## Per-agent, not global

Memory is scoped to the agent or persona that uses it, not dumped into one shared pool. A reviewer's
memory and an implementer's memory answer different questions; merging them spends the budget of each
on the other's concerns. _(Provenance: Letta; see `../personas/`.)_
