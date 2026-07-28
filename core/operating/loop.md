# The loop

> Core doctrine — loaded on demand from `../engine.md`. The engine's unit of motion: how an agent
> moves a task from intent to a verified, learned-from change. The *why* lives here; the *must*
> compiles into machinery (Stop-gates, hooks) in later milestones.

Every task runs the same five phases. They are a cycle, not a waterfall — a verification failure
returns to plan or implement; a newly discovered constraint returns to research.

| Phase | What happens | The phase is done when |
|---|---|---|
| **Research** | Read the code, the repo card, memory, and the task's links before proposing change. Read in parallel; never guess what you can check. | You can state the change and its blast radius in one paragraph. |
| **Plan** | Turn intent into a testable shape: acceptance criteria, the failing test, the files touched, the gates in the way. | A reviewer could predict the diff from the plan. |
| **Implement** | Make the change at the altitude of the surrounding code — small, legible, reversible steps. | The plan's steps are done and nothing outside them moved. |
| **Verify** | Exercise the behaviour, not just the compile. Climb the verification hierarchy; the Stop-gate is the floor. | The failing test passes and you could explain every line. |
| **Learn** | Write back what the task taught: a decision, a rule with its provenance, a memory. | The next agent starts ahead of where you did. |

See `verification.md` for the hierarchy and the Stop-gate, and `memory.md` / `evolution.md` for what
"learn" captures and how a lesson becomes a rule.

## Context is the budget

The loop runs inside a finite attention window, so context is managed, not hoarded:

- **Compaction.** When the window fills, compact to the durable state — decisions, open questions, the
  next action — and drop the transcript. The loop is a stateless reducer over that state, so it resumes
  from the compaction without losing the thread. _(Provenance: HumanLayer ACE-FCA — the loop and
  compaction; 12-Factor Agents — stateless-reducer resumability.)_
- **Handoffs record decisions and their why**, not just what changed, so the next agent — or the next
  window — inherits the reasoning. **Every session ends with a dated handoff** — a *session* being one
  bounded working stretch, however the host names it, from the moment work opens to the moment it closes.
  Short is fine, absent is not, and an exception is a last resort. The rule is binary on purpose: a
  discretionary one cannot be enforced, because no gate can judge whether skipping was warranted, and the
  costs are asymmetric — an unnecessary handoff costs five lines, a skipped one loses the reasoning
  permanently. Ceremony scales down *inside* the artifact, never by omitting it, so a gate on this checks
  that one exists and is dated — never its structure or its length. **Dated** means the filename leads
  with an ISO date: `YYYY-MM-DD-{slug}.md`. Naming the form matters, because a rule justified by being
  checkable has to say what the checker looks at; a date buried in prose would need parsing and would be
  read differently by every writer. It also makes the series sort chronologically for free. An unbroken
  series is what makes the record machine-readable: the session-end gate arrived in milestone 4 — it
  checks that a handoff dated today exists, never its length or its shape — and the librarian that mines
  the series is milestone 5, named in that row and not yet built. What milestone 5 did build **writes**
  to the series rather than reading it: a scheduled pass is a session, so it ends with a dated handoff
  like any other. _(Provenance: Cognition. See `../templates/handoff.md`.)_
- **Subagents are context firewalls.** Fan work out to a persona with its own window and return only
  the conclusion; the parent's budget stays clean. Read in parallel, write from one place. _(See
  `../personas/`. Provenance: HumanLayer; Cognition — read-parallel / write-isolated.)_
- **Compact the error, not the transcript, back into context.** A failed run returns a concise,
  structured signal — the failing check and the one fact needed to act on it — not a raw dump; noise
  left in the window is paid for again on every later turn. _(Provenance: 12-Factor Agents — compact
  errors into the context window.)_

## The triage lane (ceremony that scales down)

Not every task earns the full loop. A one-line fix should not carry a plan document. The engine defines
two lanes; the workspace sets the threshold between them.

- **Full lane** — for change with real blast radius: all five phases, the plan written down, the
  failing test first.
- **Triage lane** — for small, low-blast, reversible change: research → implement → verify collapse into
  one pass and the plan is a sentence. Verify and the Stop-gate still hold — they never scale down.

The triage lane is a first-class feature, not a shortcut taken by breaking the rules. A framework whose
lightest path is still heavy gets abandoned for small work first and for all work soon after. _(Provenance:
BMAD's scale-down lesson — the failed promise we treat as a requirement. Binding non-goal: no ceremony
that can't scale down.)_

## Bounded iteration

An agent that cannot finish must stop cleanly, not spin. Every loop carries an **iteration cap** and a
**runbook** for reaching it: what to record, whom to hand to, how to leave the workspace recoverable. A
blocked-but-safe stop beats an unattended mistake. _(Provenance: Ralph Wiggum loop — machine-checkable
completion and iteration caps; see `safety.md`.)_
