# Task — lint the persona↔agent binding, so separation cannot become duplication

**Status: TWO OF THREE DELIVERED, 2026-08-11, milestone 7 session 7** — with the third left open on this
task's own terms rather than quietly satisfied. See *What was built* at the end.

**Goal.** A persona in [`../../core/personas/`](../../core/personas/) is doctrine; the agent file in
[`../../agents/`](../../agents/) is that persona registered on one host. The relationship
is source → binding, and it is the same shape as gate map → compiled hooks and verify recipes →
Stop-gate runner: the why stays in Markdown, the must lives in machinery.

Nothing checks it. Today the binding is a hand-maintained file that *references* its persona, and the
only thing keeping it from silently becoming a second copy of the charter is whoever last edited it.
Unchecked duplicated prose is where this repository's drift keeps happening — a mandate nothing checks
is already broken ([`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)).

**Why it is a task rather than a line in a handoff.** Ruled by the maintainer, 2026-07-26, in the same
ruling that settled the persona/agent separation: separation is load-bearing — three theses require it
(LLM-agnostic by construction, design for deletion, altitude) — *and* separation must never become
duplication. The second half is the part with no rail behind it.

**Acceptance criteria.**

- [ ] When a persona in `core/personas/` has no binding in `agents/`, the packaging validator
      shall report it. _(This is also what closes the residual hole named in `plugin-lint.mjs`: deleting
      `agents/` outright is currently a note and exit 0, because a plugin that ships no agents is
      legitimate. A persona with no binding is not.)_
- [ ] When a binding in `agents/` names no persona in `core/personas/`, the validator shall
      report it — the reverse error, where a host file outlives the doctrine it was bound to.
- [ ] When a binding restates its persona's charter rather than referencing it, the validator shall
      report it. _(The measurable form of "thin" is the open question below; a check that cannot state
      what it measures should not ship.)_
- [ ] When the check runs, it shall not require the two files to agree in wording — the binding is
      allowed to say things the persona cannot, in this host's vocabulary.

**Open question, to settle before implementing.** What "thin" is, in a form a check can hold. A line
count is arbitrary; a similarity threshold is a magic number nobody can defend at review. One candidate
worth measuring first: every binding must link its persona, and must not repeat a normative sentence
from it — comparing only sentences that carry a modal, not prose generally. Measure it against the three
bindings that exist before writing the rule, the way the Workspace Definition was derived from real
content rather than imagined.

**The better ending, and why this task is deliberately small.** The hoped-for ending was that the
milestone-4 compiler would generate the agent files from the personas, the way it compiles `gates.json`
into permissions and hooks — deleting this hand-maintained binding and this check with it. **That did not
happen and is not scheduled.** Milestone 4, session 0 compiled gate policy only; session 1 is the second
backend and the degradation report. So the ending is real but undated, and this task is still live. Build
the smallest thing that stops the drift, and do not build a framework for it.

**Constraints.** [`../../docs/vision.md`](../../docs/vision.md) is not edited. `core/personas/` stays
host-neutral — no concrete tool names, no host vocabulary, which is the whole reason the two files are
separate. The check belongs in [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs), which already
validates the agent files.

**Lane.** full — a new check in a rail that gates every pull request.

## What was built — 2026-08-11, milestone 7 session 7

Reached from the other direction: row 7 of the plan names *"the persona↔agent binding nothing checks
today"* as one of four validations `doctor` owes, and this task — opened eighteen days earlier and never
scheduled — is the same obligation with a **different home and a different population**. Both were
built, because one rule with a second, narrower carrier is obeyed at the narrower one
([`../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)),
and shipping only the row's half would have left this task's whole subject unchecked.

| Criterion | Where | State |
|---|---|---|
| A persona with no binding is reported | [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs) — this task's stated home | **Built, and it FAILS rather than reports.** This task's own first bullet argues for it: a plugin shipping no agents is legitimate, a *persona* with no binding is not. Forced red by hiding `agents/reviewer.md`, and restored. |
| A binding naming no persona is reported | same | **Built, failing.** Forced red with a stranded `agents/ghost.md`. |
| A binding that restates its charter is reported | — | **Deliberately not built.** The open question below is unsettled, and this task's own words are the reason: *"a check that cannot state what it measures should not ship."* A line count or a similarity threshold would be the magic number it refuses. |
| The two files need not agree in wording | both | Held: nothing compares prose. What is compared is **correspondence** — that each side has the other, and that a binding's `name` field and its filename agree, since the host keys on the field. |

**A fourth check landed that this task did not ask for, in another tool and over another population.**
[`../../cli/doctor.mjs`](../../cli/doctor.mjs) resolves each persona a **composed pack** contributes to
`<tree>/agents/<name>.md`. There, **absence is a report and never a failure**, and the asymmetry with
the rows above is deliberate: `plugin-lint` grades *this bundle's packaging*, where an unbound persona is
inert on the host the bundle targets; `doctor` grades *anybody's workspace*, where an adopter may run no
agent layer at all — and this repository's own `checkpoints` supervisor is unbound **on purpose**, since
that ritual's mechanism is a fresh context rather than a subagent. A graded absence would have demanded a
binding the pack's own doctrine declines.

`AGENT_DIR` — the one location a host loads agents from, measured with a positive control — is now
exported from `plugin-lint` and imported by `doctor`, rather than spelled twice.

**The better ending is unchanged and still undated:** a compiler that generates the bindings from the
personas would delete both of these checks. Nothing schedules it.
