# Definition of done — Rooftop

> Core supplies the floor: green verify, and *never report done on what you could not explain*. A
> workspace may extend that floor and may never lower it. These are the additional conditions for work
> here, each with the reason it exists. _(Fictional. See [`README.md`](README.md).)_

A change is done when **all** of the following hold.

1. **The product's verify recipe ran green on this branch.** Not "CI is usually fine" — the recipe for
   the product you touched ([`verify/README.md`](verify/README.md)), run and read.
2. **You could walk a reviewer through every line.** Core's bar, restated because with three people the
   reviewer is often the only other person who will ever read it.
3. **New behaviour has a test that fails without it.** Written first where the change is code. _Why:
   this is the condition we skipped most often before we wrote it down, and every time it produced the
   same argument three weeks later about whether something had ever worked._
4. **Anything touching the schema names its rollback, and the rollback has been run.** On staging, in
   this change, by whoever wrote the migration. A rollback that has only been written is a plan, not a
   rollback. _Why: [`principles.md`](principles.md), first principle._
5. **Anything touching the reminder run states what happens if it executes twice.** The answer must be
   "nothing" — see [`memory/the-reminder-run-must-be-idempotent.md`](memory/the-reminder-run-must-be-idempotent.md).
6. **Public copy on `fieldnotes` has been read once for what a co-op would do after reading it.** Our
   compliance pages are advice to volunteers who will act on them.
7. **The task file's acceptance criteria are all ticked, or the ones that are not say why.** An
   unticked box with no sentence beside it is the most common way work here has been reported done.

## What is explicitly *not* required

Stated so the bar cannot drift upward into ceremony:

- **A task file for triage-lane work.** The lane exists so small work stays small.
- **A memory entry per change.** Memory is for facts that outlive the task; a change that taught
  nothing durable should add nothing.
- **A handoff per session.** Rooftop is three people in one room. _(Customer zero requires one because
  its sessions are agent windows that genuinely lose their context. Copy the rule if that is true of
  you, not because it is written down somewhere.)_
- **Sign-off from the person who did not write it, on a typo.** One reviewer, on the full lane only.
