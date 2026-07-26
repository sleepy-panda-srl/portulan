# Task — lint the persona↔agent binding, so separation cannot become duplication

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

**The better ending, and why this task is deliberately small.** At milestone 4 the enforcement compiler
generates the agent files from the personas, the way it compiles `gates.json` into hooks — and this
hand-maintained binding, and this check with it, are deleted. So build the smallest thing that stops the
drift until then, and do not build a framework for it.

**Constraints.** [`../../docs/vision.md`](../../docs/vision.md) is not edited. `core/personas/` stays
host-neutral — no concrete tool names, no host vocabulary, which is the whole reason the two files are
separate. The check belongs in [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs), which already
validates the agent files.

**Lane.** full — a new check in a rail that gates every pull request.
