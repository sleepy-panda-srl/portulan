# Template — Task

> A **task** is the atomic unit of work and the atomic unit of context: everything an agent needs to do
> one thing, and nothing it doesn't. Self-contained, so it can be handed to a fresh window or a subagent
> without the surrounding conversation. _(Provenance: BMAD — the story file as atomic context unit;
> spec-driven — testable acceptance criteria; verification-first — the failing test as spec.)_

---

# Task — <title>

**Goal.** <the outcome in one or two sentences — what is true when this is done.>

**Acceptance criteria.** <testable, EARS-style — "when <trigger>, the system shall <response>." Each
line must map to an observable check.>
- [ ] …

**Verify.** <the failing test or command that is red now and green when the task is met — this is the
definition of done, not a description of it. See `../operating/verification.md`.>

**Constraints.** <the gates in the way, the files that must not change, the altitude to match.>

**Context.** <the few links that matter: the repo card, related memory, the incident or ticket. Not a
document dump — the point of the task file is that it stays small.>

**Lane.** full | triage   <see `../operating/loop.md`.>
