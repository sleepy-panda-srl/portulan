# Definition of done — this repository

> Core supplies the floor: green verify, and *never report done on what you could not explain*
> ([`../core/operating/verification.md`](../core/operating/verification.md)). A workspace may extend that
> floor and may never lower it. These are the additional conditions for work here, each with the reason
> it exists.

A change is done when **all** of the following hold.

1. **Every verify recipe ran green in this working copy.** Not "should pass" — run each recipe
   [`workspace.json`](workspace.json) declares, and read the output. _Why: the Stop-gate that will
   enforce this automatically is milestone 4. CI runs them all on the pull request, which catches it
   later and more expensively; the only thing between a red check and a claim of "done" is whoever
   chooses to run it now._
2. **You could walk a reviewer through every line.** Core's bar, restated because it is the one most
   often skipped when a diff is mostly prose — prose reviews as "fine" far more easily than code does.
3. **Every new rule carries its rationale and its provenance.** A rule with neither is taste, and the
   librarian cannot retire what it cannot trace ([`../core/operating/memory.md`](../core/operating/memory.md)).
   The provenance half is now a rail rather than a reminder: `doctor` fails a `type: rule` memory entry
   whose provenance is neither a well-formed link nor a sealed stamp. The rationale half is still
   judgement, and still yours.
4. **Nothing claims a capability that does not exist.** If a document describes enforcement, either the
   enforcement exists or the sentence names the milestone where it arrives. _Why: "write the limit, not
   the aspiration" — [`identity.md`](identity.md)._
5. **The pre-commit scan is clean** across the changed files, the commit message, and the branch name.
   The term list lives outside this repository. _Why: this history goes public when the flip clearance
   completes, and history cannot be cleaned afterwards — only rewritten, which is worse and leaves its
   own trace._
6. **The plan reflects reality.** If the work moved milestone state, the same change updates
   [`../docs/plan.md`](../docs/plan.md) — Status column and Session log — so the next session boots from
   the truth rather than from an optimistic memory of it.
7. **The supervisor checkpoint passed**, in a fresh context, and is recorded — for anything
   milestone-affecting.
8. **The session ended with a dated handoff** in [`handoffs/`](handoffs/). Five lines is enough; absent
   is not. _Why: the Session log in [`../docs/plan.md`](../docs/plan.md) records what landed, and the
   handoff records why — and the why is the part a later session cannot reconstruct from the diff. It is
   uniform rather than discretionary because "write one when it's warranted" is prose no gate can check
   ([`../core/operating/loop.md`](../core/operating/loop.md))._

## What is explicitly *not* required

Stated so the bar cannot drift upward into ceremony:

- **A check per paragraph.** Where a change is documentation with no rule behind it, the verify recipe's
  existing checks are the bar. Inventing a bespoke check for each edit is exactly the ceremony that
  cannot scale down.
- **A memory entry per change.** Memory is for facts that outlive the task. A change that taught nothing
  durable should add nothing — memory that only grows becomes noise.
- **A task file for triage-lane work.** The lane exists so small work stays small; a one-line fix that
  drags a task file behind it has defeated the point.
