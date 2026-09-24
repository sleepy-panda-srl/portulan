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

A workspace sets its own guidance in these tiers in `slots.context`, since Workspace Definition 2.10: one
unit per file, each declaring its tier, and `compile` emits each unit in its host's form of that tier.
_(See [`../../spec/slots.md`](../../spec/slots.md).)_

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

**The kernel, [`../engine.md`](../engine.md), is the core's source contribution to the always-loaded
layer**; `portulan vendor --host` inlines it verbatim into a vendored `AGENTS.md` beside the workspace's
own layer, for a host that cannot install the plugin. The **pack** layer is named in that file rather
than composed into it — a pack resolves from a feed at a pinned version and **vendoring resolves
nothing**, which is unchanged. Pack-cache discovery landed at milestone 7: the CLI reads the host's
record, a vendored file cannot. Nothing in this kernel is prose for its own sake: when a line stops being
load-bearing, it moves out of the kernel.

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

## Every request pays for what the session has read

Each tool call ends a request, and the next request sends the whole context again: the host's own prefix,
the always tier, and everything read and printed so far. The prompt cache makes the repeat cheaper, not
free. In Claude Code 2.1.281 the main conversation's cache lives an hour on a subscription within its
usage limits and five minutes on an API key or a cloud provider, a subagent's five minutes unless set
(its settings `promptCacheTtl` and `subagentPromptCacheTtl`, read in its program text on 2026-09-24).
So what a session adds, it pays for on every request after, and a task done in fewer requests re-sends
less. `compile` writes the lead of each rule below onto every boot card, Portulan's and each consumer's:

- **Send independent tool calls in one request.** Reads, searches and commands whose inputs do not wait
  on each other's output cost one request together and one each apart, and each request re-sends the
  context.
- **Read a file once; reuse what your context holds.** A second read of an unchanged file adds a second
  copy, paid for on every later request. After an Edit, do not read the file back to check it: the host
  refuses an edit it cannot apply, and says so.
- **Open a file only when the task needs it, and one of 300 lines or more only where it does:
  `node <plugin root>/cli/symbols.mjs <file>` outlines it, and `<file>#<heading>` prints one section.**
  The outline gives each part's lines, and a Markdown heading's anchor and size; it costs a line a part
  where a doctrine page or an instruction file runs to thousands of tokens and a task needs one section.
  A link to a heading names its section, so `<file>#<anchor>` reads what the link points at without an
  outline. A shorter file the task changes is read whole, as below. Read a section you will edit with the
  Read tool's `offset` and `limit`, which an Edit may follow. `<plugin root>` is where Portulan is
  installed, the directory whose `core/engine.md` the boot reads; in Portulan's own repository it is the
  repository, and `compile` writes the command as run from there.
- **Ask for only the output you need: a range, a count, the failures.** Output enters the context as a
  read does. A passing run needs its summary and a failing one the failing check and the fact to act on,
  as [`loop.md`](loop.md)'s compacted error does; `git diff --stat`, `grep -c` and a line range ask for
  less than a whole log, file or tree.
- **The prompt cache lasts five minutes or an hour: a longer pause, or a fresh subagent where one could
  be resumed, writes the whole context again.** A subagent's context is its own and starts with the
  host's prefix, so start one only where the reads it keeps out of this context cost more than that
  prefix, and resume one rather than start another; [`sessions.md`](sessions.md) holds both, and the
  lifetime a workspace declares. The cost table in the same program text prices a cache write above
  sending the tokens fresh and a cache read below it.

## Code is read by symbol

A session outlines a code file of 300 lines or more before it opens it, then reads the spans it needs: in
Claude Code, the Read tool with `offset` at a span's first line and `limit` its length. **A file under 300
lines that the task changes is read whole**, since most of it is context for the change and the saving is
smallest there, and so is any file whose outline cannot say where a change goes. A span read the host does
not cut is a full read of those lines, so an Edit may follow it: in Claude Code 2.1.281 a Read is marked
partial, and an Edit or a Write after it refused, only when the Read's token cap, 25,000 by default, cut it
(read in its program text on 2026-09-24). [`cli/symbols.mjs`](../../cli/symbols.mjs) prints the outline,
one line per symbol, and `--find <name>` locates a definition; it outlines Markdown by its headings, with
each section's anchor and size, the same way. It prints from the file as it is, so no map is committed to
go stale. Nothing checks that a session outlined first; what the rule saves is measured by rerunning a
task, never by a recipe, which may not read the host's usage records.

## What is machinery today, and what is not

As of Workspace Definition 2.9 a workspace can declare the budget and the ratio, and both are checked
for shape, by the schema and by `doctor`; the manifest key refuses a budget with no ratio to count it by.
**The always tier is measured and reported.** [`cli/context.mjs`](../../cli/context.mjs) measures what
Claude Code loads into every context from a workspace's `tree`; `doctor` reports that for every workspace
and fails it only over a declared budget or where a declared budget cannot be judged; the boot closes
with the same line; and this repository's `context` recipe rails Portulan's own footprint. **A boot can
read a card instead of the slots**: the `boot` unit of `slots.context` (Workspace Definition 2.10) is
compiled into every context, imports whole the files it needs, writes out the lead sentences of others,
and names the file behind each line, so the rest loads when a rule's path or the card sends a session to
it. **A team's own instruction file can be split the same way, section by section**: a line
`<!-- portulan: on-read -->` under a heading of `CLAUDE.md` is the team's word that the section may leave
every context, and `portulan upgrade` moves it, byte for byte and proved to reassemble, into an on-read
unit whose index line names the heading and its size in whole KB. `doctor`, the boot and `init` offer it
where the file is over `0036`'s 8,000-token offer floor, and `doctor` and the boot wherever a declared
budget is breached, naming there the command that splits while `upgrade` will not run; a section is never
moved for its size alone. Claude Code 2.1.281 drops a comment standing on its own lines before it loads an
instruction file or rule (read in its program text on 2026-09-24), so the mark and the marker left behind
cost nothing. This repository's own card holds its boot under the 7,500-token line of 2026-09-23,
railed at today's figure plus 2% by the same recipe. A pointer's repository is not measured, because a
pointer declares no tree. **Still to land**: the exact mode that
calibrates a ratio, the degradation report that says which tiers a host can express, the Stop-gate's
named demotion, persona frontmatter and the librarian pass, one change at a time, in `0036`'s order of work
and under row 12 of [`../../docs/plan.md`](../../docs/plan.md).
Until each lands, the rule it would enforce is held by the human gate, and saying so is the point: a rule
nothing checks, presented as one that something does, is the failure this page exists to prevent.

_(Provenance: proposal `0036`'s sealed incident, in which an adopting repository's always-loaded
instruction files measured 130k tokens per fresh context, cache writes were most of the spend, and every
subagent and checkpoint paid it again, because nothing measured, budgeted or demoted what the host
loads. Host facts from the Claude Code documentation on costs, prompt caching and memory, checked
2026-09-21.)_
