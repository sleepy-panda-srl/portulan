# Definition of done — this repository

> Core supplies the floor: green verify, and *never report done on what you could not explain*
> ([`../core/operating/verification.md`](../core/operating/verification.md)). A workspace may extend that
> floor and may never lower it. These are the additional conditions for work here, each with the reason
> it exists.

A change is done when **all** of the following hold.

1. **Every verify recipe ran green in this working copy.** Not "should pass" — run each recipe the
   manifest **yields**, which since milestone 7's composition amendment is what
   [`workspace.json`](workspace.json) declares **plus** what this workspace's composed packs
   contribute; [`../cli/recipe-set.mjs`](../cli/recipe-set.mjs) is the one carrier of that set, and
   `node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs` prints it. Read
   the output. _The root is pinned so this command answers about the tree rather than about the
   machine, which is the same reason CI pins it._
   _Why this says yields rather than declares: a composed recipe runs in CI, so a condition scoped to
   the declared list would let one go red with this condition satisfied._ _Why: since milestone 4 the
   Stop-gate runs the **default** recipe automatically and blocks "done" on a red or an exit 2 — but it
   runs one recipe, not all of them, and it releases the session after three consecutive refusals **for any one
   reason** (each reason's count clearing only when that reason clears) or nine in total. So it makes a red
   unmissable rather than impossible, and this condition is still yours. CI runs all of them on the pull
   request, which catches it later and more expensively._
2. **You could walk a reviewer through every line.** Core's bar, restated because it is the one most
   often skipped when a diff is mostly prose — prose reviews as "fine" far more easily than code does.
3. **Every new rule carries its rationale and its provenance.** A rule with neither is taste, and the
   librarian cannot retire what it cannot trace ([`../core/operating/memory.md`](../core/operating/memory.md)).
   The provenance half is now a rail rather than a reminder: `doctor` fails a `type: rule` memory entry
   whose provenance is neither a well-formed link nor a sealed stamp. The rationale half is still
   judgement, and still yours.
4. **Nothing claims a capability that does not exist.** If a document describes enforcement, either the
   enforcement exists or the sentence names the milestone where it arrives. _Why: "write the limit, not
   the aspiration" — [`principles.md`](principles.md)._
5. **The pre-commit scan is clean** across the changed files, the commit message, and the branch name.
   The term list lives outside this repository. _Why it binds whatever the repository's
   visibility: [`dod/reasons.md`](dod/reasons.md#5-the-pre-commit-scan-is-clean)._
6. **The plan reflects reality.** Every session appends its Session log entry to
   [`../docs/plan.md`](../docs/plan.md) — unconditionally, in the shape and within the budget that
   file's **Session log header** sets out. This condition **cites** that mandate and deliberately does
   not restate it, not even the budget's number: the header is the one carrier. The **Status column**
   is the conditional half, and moves only when the work moved milestone state.
   _Why the split is spelled out: [`dod/reasons.md`](dod/reasons.md#6-the-plan-reflects-reality)._
7. **The supervisor checkpoint passed**, in a fresh context, and is recorded. **Which** work requires
   one is stated in [`gate-map.md`](gate-map.md) → *Supervised-build checkpoints*, and this condition
   **cites** that rule rather than restating it.
   _Why the split is spelled out: [`dod/reasons.md`](dod/reasons.md#7-the-supervisor-checkpoint-passed)._
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
