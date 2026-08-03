---
name: milestone-close
description: Verify that a milestone's exit criterion was demonstrated rather than asserted, before it is marked done. Use when a milestone is proposed for closing — re-derive each clause independently instead of replaying the sessions that built it, and return CLOSE or REQUEST-CHANGES with a signed fidelity note. Runs in a context that did not implement the milestone, and after the work has merged.
---

# Skill — Milestone-close checkpoint

> The checkpoint with the longest memory and the least sympathy. Its question is not *"was the work
> done well?"* — two earlier checkpoints already asked that — but *"is each clause of this criterion
> **demonstrated**, from the merged tree, by someone re-deriving it rather than being shown it?"*
> _(Part of the `checkpoints` ritual pack — see [`../../README.md`](../../README.md) for the verdict
> vocabulary in full and for what this pack cannot enforce.)_

## When to use it

Before a milestone, epic, or release is marked done — after its work has merged, and in a context that
implemented none of it. **A milestone is never self-certified**: the session that built it is the one
context that cannot supply this verdict.

## The pass

1. **Read the criterion clause by clause** and treat each as a separate obligation. A criterion is a
   set of promises, and the failure mode is a close that satisfies the memorable ones.
2. **Re-derive, do not replay.** Independently reproduce each clause from the merged tree — run the
   recipes, read the live state, recompute what a session reported. Where an earlier session recorded a
   figure, recompute it rather than quoting it; where it recorded a demonstration, perform it again.
3. **Force red before believing green.** A clause verified only in the passing direction has not been
   verified. Break what it guards, watch it fail, restore.
4. **Run the forward-reference sweep — FIRST, before grading anything else.** Search the doctrine and
   the workspace's own memory for this milestone's number.

   _Moved to the front of the pass, and the reason is a measurement rather than a preference. On the
   workspace that authored this pack the promised-but-unowned class has recurred **three times**, twice
   naming the same milestone — and every one was found by a human reading sideways, never by this step,
   because a close that grades the row first has already formed its verdict by the time it gets here.
   This is the one check that finds obligations **the criterion itself does not list**, so a close
   graded only against the row cannot see them. Run it before the row, not after._ A sentence elsewhere promising that a capability arrives here is a debt against
   this criterion, and it is invisible from both sides — the row reads complete and the doctrine reads
   satisfied. It is a text search, not a judgement, which is why it is worth running rather than
   trusting to memory of what was promised. **Reconciling expands the criterion and never narrows it:**
   a promise the criterion omits is added; a criterion clause no doctrine backs is a question for the
   owner, never a strike. Without that direction this step becomes an argument for deleting inconvenient
   clauses.
5. **Name what the close leaves undemonstrated**, and put it in the verdict rather than in a footnote.
   Every close has some; a close claiming none has stopped looking.
6. **Return CLOSE or REQUEST-CHANGES, with the fidelity note.**

## The verdicts this checkpoint may return

- **CLOSE** — every clause demonstrated; the milestone may be marked done.
- **REQUEST-CHANGES** — at least one clause is asserted rather than demonstrated. Name which, and what
  would demonstrate it.

**APPROVE and APPROVE-WITH-ADJUSTMENTS are deliberately not available here.** Those verdicts let work
proceed on a promise to fold something in; a close is the one decision with nothing downstream of it to
catch what was folded in wrongly.

## The fidelity note

What the record carries once the session that wrote it is gone. Four parts, in one clause:

> **who** verified · **when** · **the verdict, with what was actually re-derived** · **what the close
> leaves undemonstrated**

A bare *done* plus a link is not a fidelity note. The scoreboard everyone boots from has to say who
verified and what they found, or a close can be asserted at the one surface nobody re-reads.

## Why it earns its tokens

It is the only check positioned to catch a milestone that was built correctly against a criterion
nobody re-read. The forward-reference sweep in particular has changed criteria that three prior
checkpoints passed over, because it is mechanical and reads what everyone else remembered.
