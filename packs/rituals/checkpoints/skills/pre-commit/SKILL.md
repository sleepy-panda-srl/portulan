---
name: pre-commit
description: Grade a finished diff before it is committed. Use when full-lane work is complete — re-measure the diff against the criterion it claims to meet, re-run the verify recipes yourself rather than reading the implementer's report of them, and return APPROVE, APPROVE-WITH-ADJUSTMENTS, or REQUEST-CHANGES. Runs in a context that has not seen the work being done.
---

# Skill — Pre-commit checkpoint

> The checkpoint that must **re-measure rather than re-read**. The implementer's report of a green
> recipe is a claim like any other, and the one thing a fresh context can do that the implementer
> cannot is run it again without knowing what it is supposed to say. _(Part of the `checkpoints` ritual
> pack — see [`../../README.md`](../../README.md) for the verdict vocabulary in full and for what this
> pack cannot enforce.)_

## When to use it

Before committing **full-lane** work: the finished diff is graded, then committed. The adopting
workspace's autonomy tiers do not move that moment — a tier says who must **attend** an action, and a
workspace whose commits and pushes are unattended by policy has said no *person* waits on them, not that
nothing is owed before them. An unattended commit is still committed after the verdict.

If the moment was missed — work misjudged as triage, or committed before anyone called it finished — the
verdict is owed before the work is put in front of anyone; which act does that first is for the adopting
workspace's gates to say, and a pull request is the usual first one. That is the recovery for a missed
moment, never an alternative moment. The lane boundary is likewise the adopting workspace's; see the
session-open skill for why this pack does not set it.

Also whenever a change touches doctrine, the autonomy tiers, or the platform floor — work whose blast
radius is large even when no milestone or roadmap state moves. Blast radius is the measure, not
whether a status column changed.

## The pass

1. **Run the workspace's verify recipes yourself.** All of them, and read the output rather than the
   summary. *Measured, never derived* — a total quoted from an earlier run is a number about a tree
   that no longer exists.
2. **Re-measure the diff against the criterion**, not against the implementer's description of the
   diff. Read the criterion first and the diff second, so what you are looking for is not framed by
   what was built.
3. **Check every claim the change makes about itself.** This is where a fresh context earns its cost:
   a change's own description of what it did is the least-reviewed prose in any diff, and it goes stale
   between the first draft and the last push. Sentences elsewhere in the tree that the change falsifies
   belong here too. *Re-measure rather than re-read* holds for prose as it does for recipes: a claim
   about a mechanism is checked **from the mechanism**, and a claim about the world — a filesystem
   layout, a platform behaviour, an install — **from the world**. A sentence asserting behaviour is a
   figure that happens to be spelled in words. **The author's reading is not evidence**: the wrong
   sentence and the code it described were written in the same hour by the same context.
4. **Sweep the siblings of every defect the diff repairs.** The rule is
   [`../../../../../core/operating/evolution.md`](../../../../../core/operating/evolution.md)'s — *a fix
   is not done at the site it was found* — and this step is the procedure, not a second statement of it.
   Ask the diff for it: which rule does each fix restore, and where else is that rule enforced? The tool
   the shape was copied from, the other arm of the same function, the other command taking the same flag,
   the other direction of the same operation. What each site then owes is `evolution.md`'s sentence and
   not a second wording of it. **It is the checkpoint's step rather than the implementer's** because the site an
   implementer is looking at is the site they just understood, and the leftover is the one the next
   reader copies. Do not accept a comment beside the fix as coverage of a second site.
5. **Attack the coverage claims.** Where the change says a check now catches something, try to get past
   it. A hole list is a claim like any other, and the only thing that checks a claim about coverage is
   somebody trying to defeat it.
6. **Force the new rails red.** A check nobody has seen fail is a check nobody has seen work. If the
   change ships a rail, break the thing it guards and confirm it fires, then restore.
7. **Return one verdict** with numbered adjustments, and state what the change leaves
   **undemonstrated** — that sentence is what the record carries forward, and it is the half a
   satisfied implementer is least likely to write.

## The verdicts this checkpoint may return

- **APPROVE** — commit as it stands.
- **APPROVE-WITH-ADJUSTMENTS** — commit once the numbered adjustments are folded in.
- **REQUEST-CHANGES** — the diff does not meet the criterion; it needs work and a second pre-commit pass.

## Why it earns its tokens

It is the last point at which a defect is cheap. Its value is concentrated in two things an author
structurally cannot supply: a re-run nobody is hoping will pass, and a reading of the change's own
claims by someone with no memory of having written them.
