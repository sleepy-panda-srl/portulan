---
name: consolidate
description: Bring a memory store back under its budget by merging, compressing, and retiring records — the repair a breached index budget calls for. Use when the index verify recipe reports a breach, or on the librarian's scheduled pass. The output is drafts through the human gate; raising the budget is not one of the moves.
---

# Skill — Consolidate

> Memory that only grows becomes noise. Consolidate is the off-the-hot-path pass that keeps the store
> worth loading: candidates merged, duplicates removed, contradictions surfaced rather than
> overwritten, and rules whose incident can no longer occur retired. _(Provenance: Letta — sleep-time
> consolidation; Anthropic context engineering — an attention budget per layer. See
> [`../../operating/memory.md`](../../operating/memory.md) and
> [`../../personas/librarian.md`](../../personas/librarian.md).)_

## When to use it

- The index budget is breached — a verify recipe went red on `over budget`.
- Two records say the same thing, or say opposite things.
- A record's `Retire when:` condition has fired.
- The librarian's scheduled pass runs.

Not after every session. A store that gained one record has learned something; a store nobody prunes
has stopped being an index of what matters and become a log of what happened.

## The one move this pass may not make

**Raising the budget.** A budget breached and then widened has recorded nothing except that the number
was negotiable, and the next breach arrives with the same argument and a weaker precedent. The budget
is a rail, not an aim: on breach the store changes, not the rail. _(Stated normatively in
[`../../operating/memory.md`](../../operating/memory.md); a raise in the same change that broke it is
the one repair that doctrine rules out.)_

That is doctrine rather than machinery, and worth naming as such: a checker can see the breach, and
cannot see whether the number moved to accommodate it without reading history. So this is a rule the
human gate holds, and [`../../operating/memory.md`](../../operating/memory.md) says so in the same
breath as the rule itself — a mandate presented as a rail it does not have is worse than one that
admits what holds it up.

## The pass, in order

The order matters: each step makes the next one smaller, and doing them the other way round means
merging records that were about to be deleted.

1. **Retire what the store already says is retirable.** Every record carries a `Retire when:` line
   ([`../../templates/memory-entry.md`](../../templates/memory-entry.md)). Read each against the tree
   as it is now, not as it was: a rule about a checker that has since been built, or a workspace that
   no longer exists, has had its incident designed out and is costing budget to say so. A **sealed**
   record cannot be judged this way — the incident is not visible from here — so it is not retired on
   a guess; it goes to its owner as a re-validation question.
2. **Merge records that are one fact.** Two records covering one mechanism become one, and the merged
   record carries **both parents' provenance**, not the newer one's. Dropping a link because the merge
   only needed one is how a rule loses the incident that justifies it, and a rule whose incident cannot
   be traced can never be retired — thesis 4 undone by a tidy-up. Keep both `Retire when:` conditions
   too, unless one has already fired.
3. **Surface contradictions; never overwrite them.** Where two records disagree, the pass does not pick
   a winner. It writes up the disagreement and takes it to the gate. A consolidation that silently
   resolves a contradiction has made a policy decision wearing the clothes of housekeeping.
4. **Compress what survives.** Same facts, fewer tokens: cut restatement, cut the narrative of how the
   lesson was learned down to what a reader needs to judge whether it still applies. What may not be
   cut is the failure shape — inputs, wrong outcome, why the obvious guard misses. A record compressed
   past its shape is no longer enforceable, and *generic decaying into vague* is the failure
   [`../codify/SKILL.md`](../codify/SKILL.md) step 1 already names.
5. **Regenerate the index and re-run the recipe.** The index is built, never hand-edited, so this step
   is a command rather than an edit. If it is still red, the pass is not finished — and the remaining
   distance is a number, which is the point of having the rail.
6. **File it as a change for review, not as a fact.** Retirements and merges are edits to the curated
   layer, and the curated layer is human-owned: agents draft, humans accept. _(Provenance: ETH Zurich,
   arXiv:2602.11988 — generated context hurts, curated helps; binding non-goal — no unsupervised
   self-evolution. See [`../../operating/evolution.md`](../../operating/evolution.md).)_

## What stays where it is

A team's records are theirs. Consolidation moves records *within* a layer and never *up* one: a pass
that hoisted a workspace's facts into `core` or a pack would convert the customer's institutional
knowledge into the vendor's, which is the one thing an operating framework must not do to the people
who adopt it. A lesson may still travel upward — by generalizing, as a **proposal**, through the human
gate — and that is [`../codify/SKILL.md`](../codify/SKILL.md)'s job, not this one. _(Vision thesis 6 —
tailored answers, owned specifics; [`../../operating/memory.md`](../../operating/memory.md) — storage
follows ownership.)_

## Why it earns its tokens

Because the alternative is the failure mode the budget exists to prevent: a store that grows until
nobody loads it, at which point every rule in it is unenforced whether or not anyone deleted it. This
is the on-demand form of the pass the scheduled **librarian** runs as a batch — same moves, same
output shape, same gate. _(See [`../../personas/librarian.md`](../../personas/librarian.md).)_
