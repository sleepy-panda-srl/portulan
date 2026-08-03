# Verification

> Core doctrine — loaded on demand. "Done" is a demonstrated claim, never an asserted one. This doc
> defines the hierarchy the claim must climb and the gate that makes climbing non-optional.

## The hierarchy

Confidence in a change is ordered, and each rung is worth less than the one above it:

**it compiles  <  the tests pass  <  the behaviour was exercised**

Stopping at "it compiles" is the most common way an agent reports done, and it is wrong. A change is
done when the behaviour it claims has been *observed* — a test run, a command executed, an output
checked — not when it merely type-checks. _(Provenance: verification-first practice — Cherny; agentic
craft — Karpathy / Willison / Hashimoto.)_

## The ceiling on self-verification

The hierarchy orders the *evidence*; it does not say who may certify it, and the certifier has a ceiling
of its own. A context grading its own implementation is not an independent measure of it, for the reason
`loop.md` gives where it makes the fresh verdict a full-lane obligation — which is why on that lane the
verdict comes from a context that has not seen the implementation. This is a limit on the **verifier**,
not a fourth rung on the hierarchy: a fresh reviewer of an unexercised change still has nothing to
grade, and climbing the hierarchy remains the work. _(Provenance: read-isolated review — Cognition;
last-mile review focus — agentic craft. The measured argument, and its limits, are recorded as
[`../../.portulan/proposals/0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md`](../../.portulan/proposals/0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md).)_

## The failing test is the spec

Where the change is code, the task's acceptance criteria are written first as a **failing test** —
executable, specific, and red before any implementation exists. The test *is* the definition of done:
when it goes green the task is met; until then it is not. Red/green is the default, not a ceremony
reserved for libraries. _(Provenance: verification-first — Cherny; red/green TDD as default — agentic
craft. See `../templates/task.md`.)_

Acceptance criteria are written to be testable in the first place — in the EARS shape ("when {trigger},
the system shall {response}"), so each one maps to an observable check rather than a vibe. _(Provenance:
spec-driven — Spec Kit / EARS.)_

## The Stop-gate

Verification that relies on the agent remembering to run it will, eventually, not run. The **Stop-gate**
is the machine check that fires when an agent tries to end a task: it runs the task's verify recipe and
blocks "done" if the recipe is not green. The engine defines the contract — a task declares its verify
recipe; the gate runs it on Stop. The recipe resolves down the cascade — the **workspace** sets the
default, a **repo card** overrides it, a **task** may specialize — and the **compiler** wires the gate
to the host. _(The cascade is the contract; the runner shipped in milestone 4 reads the **workspace
default only**. The repo-card and task steps are **not built, and no milestone owns them yet** — said in
that form deliberately, because it is the honest one and this file is where the rule lives. Named here
because a sentence describing resolution a runner does not perform is a capability claim, and this file
is the one that legislates against those. Found at the milestone-4 close.
**Re-pointed 2026-08-03, on the maintainer's ruling.** This sentence previously said the two steps
"arrive with the CLI in milestone 7", which satisfied the rule in letter — it named a milestone — and
failed it in fact: the milestone named never took the obligation on, and no later one carries it either,
so the promise was carrier-less across the whole map. The two resolutions were to expand that row or to
re-point this sentence; the maintainer took the second, on
the ground that the runner shipped, at the time of that ruling, in no artifact an adopter received, so
building more of it bought an adopter nothing. _(It ships now — milestone 7 moved both runners into the
packaged CLI — which changes the premise and not the ruling: the two resolution steps are still unbuilt
and still unowned.)_ The precedent for the wording is `spec/pack.schema.json`'s `verify` note, which held
exactly this form until a ruling gave it an owner.)_

The runner arrived in milestone 4, and two of its properties are contract rather than detail. A recipe
that **could not run** blocks exactly as a red one does: "nothing looked" must never be read as "nothing
wrong". And the gate carries an **iteration cap** — a host's end-of-turn event is not the same event as
*the task is finished*, so a gate that blocked indefinitely would make a red working copy undriveable,
including by the session opened to repair it. The cap is a real weakening and the workspace states its
number; what the gate guarantees is that a red is unmissable, and the platform floor is what makes it
binding. _(Provenance: verification-first — Cherny; bounded iteration — the Ralph Wiggum loop.)_

## Definition of done

Beyond green, the human bar: **never report done on what you could not explain.** A diff you cannot walk
through line by line is not finished, however green — the explanation is part of the work, not a
courtesy after it. _(Provenance: agentic craft — Hashimoto. The workspace's DoD extends this list; core
supplies the floor.)_
