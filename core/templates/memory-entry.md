# Template — Memory entry

> A **memory** is one durable fact with its provenance, written so the right one can be recalled later
> without loading them all. One fact per entry; agents draft, humans accept into the curated layer.
> _(Provenance: Letta — per-agent memory; compounding engineering — provenance on every rule; ETH Zurich
> — curated beats generated. See `../operating/memory.md`.)_

---

**type:** rule | decision | reference | glossary
**scope:** {the persona / repo / workspace this belongs to — memory is per-agent, not global}
**provenance:** {one of the two forms below — a rule carrying neither is taste. Human review is what
rejects it today; the check that does so mechanically is `doctor`, milestone 2}

Provenance takes one of exactly two forms, and the Workspace Definition
(`../../spec/workspace.schema.json`, `$defs/provenance`) makes both machine-checkable:

**provenance:** `form=link` `href={ticket | PR | postmortem | commit}`
— the incident is public, or at least visible to everyone who can read this rule.

**provenance:** `form=sealed` `owner={who can re-validate}` `date={YYYY-MM-DD}` `shape={the de-identified failure}`
— for an incident that cannot leave its owner's layer. The chain stays in the owner's workspace; what
travels is the stamp and the mechanism, never the episode. `shape` must carry the inputs, the wrong
outcome, and why the obvious guard misses — the bar is that someone who never saw the incident can still
write the rule's test. _(Sealed is the weaker form and is meant to look it: from milestone 2 `doctor`
reports what proportion of a workspace's rules are sealed, because a workspace where everything is sealed
has opted out of retirement altogether. See `../operating/memory.md` and `../skills/codify/SKILL.md`
step 1.)_

{The fact, in one or two sentences. If it is a rule, state the rule and — on their own lines — **why**
it holds and **when to apply** it. Link related memories so recall can follow the thread.}

**Retire when:** {for a rule, the condition under which it stops being true — e.g. "the generated client
is deleted" — so the librarian can demote it instead of it living forever.}
