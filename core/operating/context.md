# Context

> Core doctrine — loaded on demand, which on this page's own terms is the on-read tier. What a host
> loads into every context is paid for again by every fresh context: each session, subagent, checkpoint
> and persona. So guidance sits in load tiers, the always tier is budgeted like memory, and a demotion
> is measured before and after. `loop.md` manages the window while a task runs; this page governs what
> the host loads into it, and when. _(Proposal
> [`0036`](../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md).)_

## Four load tiers

**Every piece of guidance sits in a load tier, and belongs in the latest tier that still reaches the
agent in time.** There are four:

- **Always**: loaded into every context, which covers project instruction files and their imports,
  unscoped rules, and skill and agent descriptions.
- **On-path**: loaded when the agent first touches a matching path, which covers nested instruction files
  and path-scoped rules.
- **On-invoke**: loaded when a skill, persona or ritual runs.
- **On-read**: loaded when the agent opens the file.

The always tier is paid for by every context, whether or not its task needs what the tier holds; a later
tier is paid for only by the contexts that reach it. *In time* is the limit: guidance that arrives after
the moment it applies has not reached the agent.

## One level of index

**One level of index only**: an always-tier line may point at content, and a pointer may not point at
another pointer. A **pointer** is a line the agent reads to decide whether to open something; a file a
procedure always reads is content loaded in that procedure's tier, not a pointer. So the kernel's map,
whose lines point at directories of content, is one level, and so is the boot's path to a memory record:
the boot always reads the memory index, and each index line is the one pointer to its record.

_(Motivated, not established, by arXiv 2607.17598, *Is Progressive Disclosure All You Need for
Long-Context Agents?* (He, Zhao, Wang and Chen, 2026), whose abstract finds that a second, deeper routing
level never helps and sometimes breaks accuracy. It measured long-document question answering, not
instruction files.)_

## The always tier is budgeted in tokens

**The budget is declared in the manifest and never defaulted**, as `context.always.budget.tokens`. A
breach is repaired by **demotion** to a later tier, by **merge** or by **retirement**, and never by
raising the budget in the change that breached it. The shape is memory's on purpose, its limit included:
a budget is a rail, not an aim, and the no-raise half is a rule no checker establishes, for the reason
[`memory.md`](memory.md) gives.

**Bytes per token are declared too**, as `context.ratio`: measured exactly on demand, by asking the host
for the true count, and recorded with the host whose exact count calibrated it. The exact measurement
never runs inside a recipe, because no verify recipe may make a network call, and a ratio that moved
between runs would make one tree red on one run and green on the next. The keys are argued in
[`../../spec/slots.md`](../../spec/slots.md).

**A report by default, a rail by declaration.** A workspace is failed only against a budget it declared.

## Portulan budgets its own contribution

**Portulan budgets its own contribution by default, because it owns it.** That is the kernel, the boot
skill and the engine half of the boot read-set, skill and persona prompts, hook-injected text, and the
vendored `AGENTS.md` skeleton. The default is a rail in this repository, not a budget in any adopter's
manifest, so *never defaulted* holds. This is what lets every install benefit on upgrade without
configuring anything.

## A fresh context is priced where it is created

Whatever spawns one (a checkpoint, a persona, a ritual) states what it loads, and the compiled agent
carries that. **Reviewers keep the conventions they grade against**: the remedy for an expensive always
tier is a smaller always tier, never a blind reviewer.

## No optimisation may lower context or code quality

Prefer moving content to a later tier over deleting it, keep one source per fact, and measure before and
after. **A demotion states both figures.**

**What this does not ask for**: a defaulted workspace rail, lossy compression, a codebase vector index,
switching model or effort mid-session, output-shortening tricks, or any change to a host. Portulan
compiles to what hosts load and does not change how they load it.

## What is machinery today, and what is not

As of Workspace Definition 2.9 a workspace can declare the budget and the ratio, and both are checked
for shape, by the schema and by `doctor`; the manifest key refuses a budget with no ratio to count it by.
**Nothing measures the always tier yet.** The measurement module and its recipe, `doctor`'s report and
the boot's closing figure, the Claude Code compile targets and the degradation report that says which
tiers a host can express, the rail on Portulan's own footprint, persona frontmatter and the librarian
pass land one change at a time, in `0036`'s order of work and under row 12 of
[`../../docs/plan.md`](../../docs/plan.md). Until each lands, the rule it would enforce is held by the
human gate, and saying so is the point: a rule nothing checks, presented as one that something does, is
the failure this page exists to prevent.

_(Provenance: proposal `0036`'s sealed incident, in which an adopting repository's always-loaded
instruction files measured 130k tokens per fresh context, cache writes were most of the spend, and every
subagent and checkpoint paid it again, because nothing measured, budgeted or demoted what the host
loads. Host facts from the Claude Code documentation on costs, prompt caching and memory, checked
2026-09-21.)_
