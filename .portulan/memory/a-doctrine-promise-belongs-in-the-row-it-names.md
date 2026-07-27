**type:** rule
**scope:** workspace — anyone writing a milestone row, or grading a build against one
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-enforcement-compiler.md`
— milestone 4, session 0. `core/operating/loop.md` had promised a session-end gate *to milestone 4*
since the cadence rule landed, and milestone 4's row named two of the three things the doctrine owed
there. The build followed the doctrine; the criterion did not know about it.

When a doctrine file says a capability **arrives at milestone N**, that promise belongs in milestone
N's row. Otherwise the plan and the doctrine grade the same work differently, and the gap is invisible
from both sides: the row reads complete, the doctrine reads satisfied, and nobody is asked to
reconcile them.

Reconciling them **expands the criterion and never narrows it.** A doctrine promise the row omits is
added. A row clause no doctrine backs is **a question for the maintainer** — never a strike.

**Why the direction is the whole rule.** Without it this entry is a ready-made argument for deleting
inconvenient clauses: *no doctrine file promises this, so the row over-reaches*. That move is
available today — `+ Copilot ruleset export` sits in the milestone-4 row with no doctrine sentence
behind it, and a later session wanting a smaller milestone would have both the motive and, absent this
paragraph, the citation. This is the second time a rule written to prevent one bad change turned out
to be loadable to authorise the next: `a-public-criterion-must-be-demonstrable-from-this-repo.md` was
caught in the same shape, at a milestone-close audit, drafted as an argument for striking the
milestone-3 public-flip clearance. Both were caught by a fresh-context supervisor rather than by their
authors, which is the argument for the checkpoint restated as evidence.

**How to find them:** grep the doctrine and this workspace's memory for the milestone number before
the row is written, and again at milestone close. It is a text search, not a judgement — which is why
it is worth doing rather than trusting to memory of what was promised months earlier.

**Counting honestly matters more than the count.** The session-open pass here reported "three promises
where the row named two", scoped to the loop and verification doctrine. Counting *every* sentence
pointing at milestone 4 gives four — `core/operating/autonomy.md` also promises that the enforcement
compiler generates the platform-floor configuration. That fourth was routed to the maintainer rather
than folded in, because the honest options include rewording the doctrine instead of growing the row,
and that choice is not an implementer's. State the scope of a count or state the larger number; an
unscoped figure that is true only under an unstated restriction is the same defect as a suite total
quoted from the wrong hour.

**When to apply:** writing a milestone row, amending one, or closing a milestone. Also whenever
doctrine gains a forward reference — the sentence *"X arrives at milestone N"* is a debt against a
specific row, and writing it without opening the row is how it goes missing.

**Retire when:** forward references in doctrine carry a checkable link to the row they name, so a lint
can hold the two together. This is largely not railable today for the reason
`a-public-criterion-must-be-demonstrable-from-this-repo.md` gives — prose about a milestone is prose —
but the grep-able half is the milestone number itself, and a check that every `milestone N` mention in
`core/` corresponds to a clause in row N is buildable. Nobody has built it; until then this is a
practice, and a practice with no rail is the thing this workspace has a rule about.
