# Template — Handoff

> A **handoff** records a decision and its *why*, so the next agent — or the next context window —
> inherits the reasoning and not just the result. Write one when compacting, when hitting an iteration
> cap, or when passing work across a persona boundary. Decisions without their why get silently
> re-litigated or reversed. _(Provenance: Cognition — handoffs record decisions and rationale.)_

---

# Handoff — {task / thread}

**State.** {where things actually are right now — done, in-progress, blocked — in a few lines.}

**Decisions + why.** {each decision taken and the reason it was taken; the reasons are the payload.}
- {decision} — because {why}; alternatives considered: {…}.

**Open questions.** {what is undecided, and who decides it — flag the human-owned ones.}

**Next action.** {the single next step, concrete enough to start from cold.}

**Recoverability.** {anything left in a partial state, and how to make it safe; see
`../operating/safety.md`.}
