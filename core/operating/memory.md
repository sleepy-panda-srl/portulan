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
merge, compress, **split**, retire — never squeezing past the breach, and never raising the budget in
the same change that broke it. **The breach is machinery as of milestone 5**: a workspace declares its
budgets in the manifest, the index is generated rather than written, and a verify recipe goes red when
either the index or the store is over. The procedure that answers a red is
[`../skills/consolidate/SKILL.md`](../skills/consolidate/SKILL.md).

**Which remedy is legal depends on the axis that broke**, and the four are not interchangeable.
Splitting a record buys byte room by spending a line of the count budget; merging two does the
reverse. So a rail on record count and a rail on record size are not two views of one number — they
are the two sides of the trade, and a store needs both declared before either repair is safe to reach
for. **A rail whose every remedy is barred is not a strict rail but a dead one**, and the store's
aggregate byte budget reached that state: retire found no fired condition in 28 records, merge found
no two records that were one fact, and compress had already run twice on the record in question.
Workspace Definition 2.8 answers that with a **per-record** cap — `memory.store.budget.record_kilobytes`,
which an aggregate cannot see behind — and the per-record repair menu is live: split, compress, or
demote the narrative to the provenance layer. It also puts the rail on the right party. An aggregate
over individually-authored records is a **commons**: the record that grew never feels the total at
write time, and some unrelated writer hits it later. A per-record cap fires on the author growing the
record, at the moment of growth, and never blocks anyone else. _(Proposal `0025`.)_

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
generated context hurts, curated helps. The scheduled librarian arrived in milestone 5: a pass that
regenerates each generated index, ages every record from git, nags a sealed stamp's owner, chases
undecided proposals, drafts demotions, and **runs consolidation** — filed as a pull request nobody has
to remember to open. What consolidation means on a schedule is bounded rather than claimed: the pass
reports how close each budget is to its rail, and surfaces records citing one incident as a
**question**, because `../skills/consolidate/SKILL.md` merges records that are one *mechanism* and one
incident routinely teaches several. Its steps 3 and 4 — surfacing contradictions and compressing what
survives — are not automated and the pass says so in its own report rather than omitting them. Core
defines the lifecycle either way.)_

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
  date instead — a scheduled question rather than silent rot. **That logic runs as of milestone 5**: the
  interval is `librarian.staleness.sealed_days` in the workspace manifest, and the nag is dated from the
  stamp's own `date=` rather than from the file's last commit, so editing a sealed record's prose does
  not buy it another interval. Undeclared means unnagged — nothing here is defaulted.
- **A workspace can seal everything and opt out of retirement entirely.** Which is why the *sealed
  proportion* is reported as a health signal rather than left to be noticed — by `doctor`, from
  milestone 2. Until it runs, nothing counts seals and nothing rejects a rule that carries no provenance
  at all; both are human review's job, as everything on this page was before there was a schema to check
  against.

## Per-agent, not global

Memory is scoped to the agent or persona that uses it, not dumped into one shared pool. A reviewer's
memory and an implementer's memory answer different questions; merging them spends the budget of each
on the other's concerns. _(Provenance: Letta; see `../personas/`.)_

**The first instance is declared at milestone 6 and validated at milestone 7**, and it takes two rows
because the scoping has two halves. **The declaring half:** the resolving pack's persona declares its
memory scope, and the resolution demonstration shows that scope landing in the **adopting workspace's
own layer** — declared by the pack, owned and populated only by the adopter, empty until earned. The
deliverable there is the scoping *demonstrated*, never a populated store. **The validating half:** `doctor` checks a persona against its five-part contract, and the memory
scope is one of those parts — where a declaration stops being prose a checker can read but not honour.

**The declaration exists**, and what it is *not* is the load-bearing half.
The `rituals/checkpoints` pack's supervisor persona declares its scope; a composed workspace lands one
directory per declared scope in its own layer, generated into an index that is byte-compared, and the
location is **empty**. Nothing reads it, nothing recalls from it, nothing consolidates it, and no budget
rails it. It is a declared scope with an owner, not a working memory — said here because a page describing
a capability that exists only as an empty location is the defect [`../../.portulan/dod.md`](../../.portulan/dod.md)
condition 4 exists to catch. This is the **doctrine's** carrier of that limit; the specification states it
for the slot and the generated index prints it on its own face, deliberately, because a limit stated only
where a reader already knows to look is stated at the narrowest carrier.

**Settled by the maintainer** — verbatim, *"row 6 declares, row 7 validates"* — after the same question
was put to him twice and answered two different ways. The record of both, and of the third option that
reconciles them, is
[#98](https://github.com/sleepy-panda-srl/portulan/issues/98) and
[`docs/milestones/m06.md`](../../docs/milestones/m06.md). Neither row needed a criterion edit to carry
this: both already demanded their half. Said plainly because the
alternative is a page describing an enforcement that does not exist — the failure a workspace's
definition of done exists to catch (`.portulan/dod.md` condition 4, in this repository): a document may
describe machinery only if the machinery exists *or* the sentence names the milestone where it does.
Every store shipped so far is a **workspace's**, shared by whatever agent reads it, and the one agent
here that runs unattended and repeatedly — the scheduled librarian of milestone 5 — deliberately keeps
**no state at all** between runs: every figure it reports is recomputed from git and the tree, which is
what makes two passes over an unchanged store byte-identical. Statelessness there is a property worth
keeping, not a gap to paper over, so it is not the first instance and was not made into one. **Milestone
6 is where the question lands**, because a **pack** is the first thing this framework distributes that
carries per-persona material its adopter does not own — which is the first point at which *whose* memory
this is has an answer that matters, and therefore the first place a declaration has anything to declare. _(Recorded as [`.portulan/proposals/0016-per-agent-memory-has-no-first-instance-yet.md`](../../.portulan/proposals/0016-per-agent-memory-has-no-first-instance-yet.md).)_
