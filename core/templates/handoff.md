# Template — Handoff

> A **handoff** carries the work still open, so the next agent — or the next context window — starts
> from where things stand rather than from the transcript. Write one when a session ends with work not
> committed and pushed, when compacting, when hitting an iteration cap, or when passing work across a
> persona boundary. Work that is committed carries its own why, in its commit message, so a handoff
> says nothing the diff or a commit already says. **Drop any section with nothing to say**; five lines
> is a valid handoff. The date leads the **filename**, in ISO form — `YYYY-MM-DD-{slug}.md` — because
> that is what a gate checks and what sorts the series. _(Provenance: Cognition — handoffs record
> decisions and their rationale. When one is owed, and why the commit carries the rest:
> `../operating/loop.md`.)_
>
> **The commit a change lands in:** a subject that says what changed, in the present tense and under 72
> characters; a blank line; a body of a few lines that says why, and what was rejected when that matters.

---

# Handoff — {task / thread}

**State.** {where things stand: what is done and committed, what is in progress and uncommitted.}

**Open questions.** {what is undecided, and who decides it — flag the human-owned ones.}

**Next action.** {the single next step, concrete enough to start from cold.}

**Recoverability.** {anything left in a partial state, and how to make it safe; see
`../operating/safety.md`.}

---

_A filled one, for a session that stopped mid-change:_

# Handoff — retry the flaky upload test

**State.** The retry wrapper is written and its unit test passes; it is stashed, not committed, because
the integration suite still fails once in about ten runs.

**Open questions.** Whether three attempts is the right cap — the owner of the upload service decides.

**Next action.** `git stash pop`, run the integration suite twenty times, and read the one failure's log.

**Recoverability.** Nothing was pushed; dropping the stash loses only the wrapper.
