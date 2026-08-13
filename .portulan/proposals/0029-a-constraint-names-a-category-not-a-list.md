# Proposal — a constraint on an agent names a category, not a list

**Status. PROPOSED, 2026-08-13.** It ships **no rail**, and says so here rather than implying one: the
artefact it governs — a session brief — is typed into a conversation and committed nowhere, so no recipe
in this repository can read one. What it asks for is the **second half of a rule this repository already
carries**, and a ruling on where that half lives.

## Incident — two on one day, in different materials, with one shape

**1. A gated action nobody approved.** Milestone 7's close brief forbade a *list* of outward actions —
modify tracked files, commit, push, merge, open a pull request. Exercising row 7's `feedback` clause, the
verifying context **filed a real GitHub issue**,
[#239](https://github.com/sleepy-panda-works/portulan/issues/239), under the maintainer's login. Filing an
issue was not on the list and was squarely inside the task set.

The tool was right and the brief was wrong. `feedback`'s preview digest covers the *rendered payload*, and
the line appended after previewing fell outside every rendered section, so the approval still described the
bytes that were sent. The issue was closed with that explanation on the maintainer's decision, and the
milestone's own close section records the diagnosis rather than smoothing it over: **the defect was in the
brief, which forbade an enumeration where it needed a category.**

**2. An instrument that could see 59% of its own subject.** One session earlier, the brief for the
scratch-directory sweep arrived carrying its own instrument: count `portulan-*` in `os.tmpdir()` before and
after. The leak was **78 directories per run across six prefixes**, of which `portulan-*` names 46.
**Thirty-two of seventy-eight were invisible to the check written to find them**, so a delta of zero would
have read as a fix — *truthfully about what it measured*. The repair needed no prefixes at all: diff the
whole tmpdir name set, which knows no conventions and therefore cannot miss one.

The two are the same defect in different materials. **An enumeration is a naming convention, and a naming
convention measures the convention rather than the phenomenon.** One instance cost a wrong number; the
other cost a real artifact on someone else's tracker.

## This is half a rule the engine already states

[`core/operating/autonomy.md`](../../core/operating/autonomy.md) has said since milestone 4 — the
paragraph entered at `8546254`, 2026-07-27, by `git log -S` over that file, and row 4 closed 2026-07-28 —
of the tier table's examples:

> **The examples in that table are illustrative, not binding.** … The *Action class* column is the
> doctrine; the actions after the dash are there to make it legible.

and it records what the misreading cost: *"An example read as binding once cost a whole session of `git
push` commands handed back to a maintainer to type by hand."*

**That paragraph covers one direction of the misreading and #239 is the other.** Read the list as
*binding* and you get over-restriction, whose price is friction. Read the list as *exhaustive* and you get
under-restriction, whose price is a gated action taken unapproved. **Both come from treating the
enumeration as the rule**, and only the first is written down.

The convention is already practised elsewhere, unprompted, which is the argument for promoting it rather
than inventing it. [`../gates.json`](../gates.json) declines to compile a matcher for
`send-something-outside-this-repository` and says why in the rule itself:

> a Bash matcher here would cover one of at least three spellings — bare, through npx, and through node on
> the module — and would read as coverage this rule does not have.

That is this proposal's rule, stated in a data file, about the very act #239 went on to perform.

## Proposed rule

> A constraint on what an agent may do names the **category** of act it gates or forbids. Any enumeration
> of instances beside it is illustration, and is never the boundary.

With the converse, which is the half that makes it operable at the reading end rather than only at the
drafting end:

> An act's absence from the list is not a finding of permission. An agent meeting an act the list does not
> name asks whether the **category** reaches it, and treats the answer as the rule.

## Where it belongs, and why not somewhere new

**In [`core/operating/autonomy.md`](../../core/operating/autonomy.md), extending the existing paragraph**
— not as a new record beside it. A second carrier of one rule is the defect
[`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md) is about, and this repository has paid for it
often enough to stop re-buying it: one rule with three carriers is obeyed at the narrowest.

## How this differs from the three rules nearest it

- [`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md) governs the scope of a **repair** once a
  defect is known — *where else does this defect live*. This governs the extent of a **rule** — *what did
  the sentence that permitted it actually cover*.
- [`a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
  governs a **checker** that runs green having never looked at the thing being claimed. Incident 2 is an
  instance of both; **#239 is an instance of this one alone**, because no checker ran at all — the
  constraint's only reader was the agent, and the agent obeyed it exactly as written.
- [`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
  governs a rule with **no** enforcement behind it. Here the enforcement was a reading, and the reading was
  faithful.

The distinguishing test in one line: those three are about a rule's **enforcement**; this is about a rule's
**extent**.

## Enforcement — the honest answer is prose, and here is the argument for it

A brief is not a tracked file, so nothing here can read one, and claiming otherwise is what
[`a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md) forbids.
Two surfaces are nonetheless reachable, and both are **deliberately not bundled**, because each is a
mechanism change that deserves its own review:

1. **The checkpoint skills** state what a session may do. They *are* tracked, and a form check over their
   constraint sections is the shape `0020` §6 refused on a precondition — a fixed verdict format — rather
   than on principle.
2. **`gates.json`** already carries the category vocabulary. Nothing follows for it here; it is named so a
   reader does not conclude this proposal implies a schema change.

## Q1 — the ruling this proposal exists to ask for

**Does this bind the engine or this workspace?** Extending `autonomy.md` ships the rule to every adopter and
changes what every brief anywhere must look like. Recording it in `.portulan/memory/` binds this build
alone. The incident is ours; the shape is not, and the paragraph it extends is already core doctrine.

## Q2 — does it bind the reader as well as the author?

The converse clause above binds the **agent receiving** a constraint, not only the human writing one. It is
the operative half — a brief already written cannot be repaired by a rule addressed to its author — and it
is also the more demanding one, since it asks an agent to widen a constraint against its own interest. The
alternative is to bind the author only and accept that a brief in flight is unreachable.

## Honest limits

- **No rail, today or under this proposal.** Stated in the Status, not left to be discovered.
- **A category can be drawn too wide.** *Never act* is a category and covers everything; it is not a
  constraint but a refusal to work. The rule asks for the **narrowest category containing the listed
  instances**, which is a judgement and will sometimes be made badly.
- **It removes one failure mode and not its neighbour.** An enumeration that silently under-covers becomes
  visible; a category chosen wrongly stays invisible, and nothing here helps with that.
- **The converse clause is unfalsifiable from outside.** An agent that reasons about the category and gets
  it wrong is indistinguishable, in the record, from one that never asked. Only the outcome differs, and
  only sometimes.

**Retire when:** briefs are generated from a tracked template that carries categories rather than lists —
at which point a recipe can read the template, and this becomes a rail instead of a rule.

## Provenance

`form=link`
`href=`[`https://github.com/sleepy-panda-works/portulan/issues/239`](https://github.com/sleepy-panda-works/portulan/issues/239)
— the gated outward action taken under a brief that enumerated where it needed a category, closed with that
explanation on the maintainer's decision. In-repo and resolvable by anyone who can read this rule; no client
material, so no seal is needed.

**Decision.** PROPOSED — awaiting the maintainer. **Q1 decides the altitude and Q2 decides the extent**;
the incident record stands whichever way both go.

**Pull request:** [#246](https://github.com/sleepy-panda-works/portulan/pull/246) — the change that filed this.
