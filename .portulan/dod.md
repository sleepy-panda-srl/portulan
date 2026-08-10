# Definition of done — this repository

> Core supplies the floor: green verify, and *never report done on what you could not explain*
> ([`../core/operating/verification.md`](../core/operating/verification.md)). A workspace may extend that
> floor and may never lower it. These are the additional conditions for work here, each with the reason
> it exists.

A change is done when **all** of the following hold.

1. **Every verify recipe ran green in this working copy.** Not "should pass" — run each recipe
   [`workspace.json`](workspace.json) declares, and read the output. _Why: since milestone 4 the
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
   the aspiration" — [`identity.md`](identity.md)._
5. **The pre-commit scan is clean** across the changed files, the commit message, and the branch name.
   The term list lives outside this repository. _Why: this history **was** world-readable — the
   repository was public 2026-07-27 → 2026-08-03 and is **private again since 2026-08-03**
   (re-measured 2026-08-10: `private: true`, unauthenticated `GET` **404**, 0 forks) — and a commit
   cannot be cleaned afterwards, only rewritten, which is worse and leaves its own trace. **The
   flip-back does not relax this clause, and must not be read as relaxing it.** Clones taken in that
   window cannot be recalled; visibility is a Gated setting that has already moved twice; and a scan
   that runs only while the repository happens to be public is a scan that stops exactly when it is
   cheapest to keep. It binds harder now than when it was drafted, not less._
6. **The plan reflects reality.** Every session appends its Session log entry to
   [`../docs/plan.md`](../docs/plan.md) — unconditionally, in the shape and within the budget that
   file's **Session log header** sets out. This condition **cites** that mandate and deliberately does
   not restate it, not even the budget's number: the header is the one carrier. The **Status column**
   is the conditional half, and moves only when the work moved milestone state. _Why the split is
   spelled out: this condition used to read "if the work moved milestone state, the same change updates
   … Status column and Session log", which made the log entry conditional too — a second, narrower
   carrier of a rule the plan already stated in full. Five handoff-documented sessions went unlogged
   under it before a two-day review counted them. Both halves of the log↔handoff correspondence, and
   the entry budget, are now rails in `docs.sh`'s `record` check rather than prose anyone must
   remember._
7. **The supervisor checkpoint passed**, in a fresh context, and is recorded. **Which** work requires
   one is stated in [`gate-map.md`](gate-map.md) → *Supervised-build checkpoints*, and this condition
   **cites** that rule rather than restating it. _Why the split is spelled out: this condition read "for
   anything milestone-affecting", which is narrower than the gate map's own full-lane boundary and
   narrower than the trigger now recorded beside it — a second, narrower carrier of one rule, which is
   the shape condition 6 was repaired **out of** one change earlier, and the class
   [`0020`](proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names. The Dependabot arc ran checkpointless under the old wording with
   nothing in this file to say it should not have._
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
