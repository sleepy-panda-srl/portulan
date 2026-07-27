# Template — Memory entry

> A **memory** is one durable fact with its provenance, written so the right one can be recalled later
> without loading them all. One fact per entry; agents draft, humans accept into the curated layer.
> _(Provenance: Letta — per-agent memory; compounding engineering — provenance on every rule; ETH Zurich
> — curated beats generated. See `../operating/memory.md`.)_

---

**type:** rule | decision | reference | glossary
**scope:** {the persona / repo / workspace this belongs to — memory is per-agent, not global}
**provenance:** {one of the two forms below — a rule carrying neither is taste, and `doctor` rejects it}

**Which types this binds.** `doctor` *requires* a two-form stamp on `type: rule` and reports it on the
others, because thesis 4 and the mandate it comes from are rule-scoped. Write one on every entry anyway:
a decision you cannot trace is no easier to retire than a rule you cannot trace, and the difference is
only in what a machine is willing to fail you for.

Provenance takes one of exactly two forms, and the Workspace Definition
(`../../spec/workspace.schema.json`, `$defs/provenance`) makes both machine-checkable:

**provenance:** `form=link` `href={ticket | PR | postmortem | commit}`
— the incident is public, or at least visible to everyone who can read this rule.

**provenance:** `form=sealed` `owner={who can re-validate}` `date={YYYY-MM-DD}` `shape={the de-identified failure}`
— for an incident that cannot leave its owner's layer. The chain stays in the owner's workspace; what
travels is the stamp and the mechanism, never the episode. `shape` must carry the inputs, the wrong
outcome, and why the obvious guard misses — the bar is that someone who never saw the incident can still
write the rule's test. _(Sealed is the weaker form and is meant to look it: `doctor` reports what
proportion of a workspace's rules are sealed, because a workspace where everything is sealed has opted
out of retirement altogether. What no machine checks is whether a stamp is **true** — a fabricated one
passes exactly as a real one does, which is why the bar in `../skills/codify/SKILL.md` step 1 and human
review are what actually guard the content. See also `../operating/memory.md`.)_

The stamp is parsed out of backticked `key=value` tokens on this line, so annotation prose may follow it
freely — and should: the fields carry what a machine needs, the sentence after them carries what a reader
does.

{The fact, in one or two sentences. If it is a rule, state the rule and — on their own lines — **why**
it holds and **when to apply** it. Link related memories so recall can follow the thread.}

**Retire when:** {for a rule, the condition under which it stops being true — e.g. "the generated client
is deleted" — so the librarian can demote it instead of it living forever.} _(`doctor` reports an entry
that states none — a record no condition can demote is how a store only grows.)_
