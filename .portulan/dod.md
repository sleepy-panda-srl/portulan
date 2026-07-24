# Definition of done — this repository

> Core supplies the floor: green verify, and *never report done on what you could not explain*
> ([`../core/operating/verification.md`](../core/operating/verification.md)). A workspace may extend that
> floor and may never lower it. These are the additional conditions for work here, each with the reason
> it exists.

A change is done when **all** of the following hold.

1. **The verify recipe ran green in this working copy.** Not "should pass" — run
   [`verify/docs.sh`](verify/docs.sh) and read the output. _Why: the Stop-gate that will enforce this
   automatically is milestone 4. Until it exists, the only thing between a red check and a merged claim
   is whoever chooses to run it._
2. **You could walk a reviewer through every line.** Core's bar, restated because it is the one most
   often skipped when a diff is mostly prose — prose reviews as "fine" far more easily than code does.
3. **Every new rule carries its rationale and its provenance.** A rule with neither is taste, and the
   librarian cannot retire what it cannot trace ([`../core/operating/memory.md`](../core/operating/memory.md)).
4. **Nothing claims a capability that does not exist.** If a document describes enforcement, either the
   enforcement exists or the sentence names the milestone where it arrives. _Why: "write the limit, not
   the aspiration" — [`identity.md`](identity.md)._
5. **The pre-commit scan is clean** across the changed files, the commit message, and the branch name.
   The term list lives outside this repository. _Why: this history goes public at milestone 3, and
   history cannot be cleaned afterwards — only rewritten, which is worse and leaves its own trace._
6. **The plan reflects reality.** If the work moved milestone state, the same change updates
   [`../docs/plan.md`](../docs/plan.md) — Status column and Session log — so the next session boots from
   the truth rather than from an optimistic memory of it.
7. **The supervisor checkpoint passed**, in a fresh context, and is recorded — for anything
   milestone-affecting.

## What is explicitly *not* required

Stated so the bar cannot drift upward into ceremony:

- **A check per paragraph.** Where a change is documentation with no rule behind it, the verify recipe's
  existing checks are the bar. Inventing a bespoke check for each edit is exactly the ceremony that
  cannot scale down.
- **A memory entry per change.** Memory is for facts that outlive the task. A change that taught nothing
  durable should add nothing — memory that only grows becomes noise.
- **A task file for triage-lane work.** The lane exists so small work stays small; a one-line fix that
  drags a task file behind it has defeated the point.
