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
to the host. _(Runner built in milestone 4 — named here as the contract the loop's Verify phase
relies on.)_

## Definition of done

Beyond green, the human bar: **never report done on what you could not explain.** A diff you cannot walk
through line by line is not finished, however green — the explanation is part of the work, not a
courtesy after it. _(Provenance: agentic craft — Hashimoto. The workspace's DoD extends this list; core
supplies the floor.)_
