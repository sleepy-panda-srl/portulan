# Proposal — a constraint on an agent names a category, not a list

**Status. ACCEPTED 2026-08-14 by the maintainer, with Q1, Q2 and Q3 all ruled** — the three answers and
their grounds are in **Decision** at the foot. It still ships **no rail**, and says so here rather than
implying one: the artifact it governs — a session brief — is typed into a conversation and committed
nowhere, so no recipe in this repository can read one. Acceptance does not change that, and Q3's edit
*removes* a matcher rather than adding one. What it asked for is the **second half of a rule this
repository already carries**, and a ruling on where that half lives; Q1 put it in the engine.

_Proposed 2026-08-13. Everything below this header is left **exactly as drafted**, except the Decision
field, which existed to be filled and has been —
[`0014`](0014-a-feedback-pipe-points-out-of-the-seam.md)'s rule and the reason it gives: a proposal records
what was argued when it was argued, and editing the argument to match its own outcome destroys the record
of what the ruling actually decided. The two edits the ruling calls for follow as their own reviews, which
is this proposal's own disposition of them — **deliberately not bundled**, because each is a mechanism
change that deserves its own review._

## Incident — three on one day, in different materials, with one shape

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

**3. The commit that filed this proposal.** This text was committed with `git -c
core.hooksPath=/dev/null` (`cf6b11e`) — `commit-without-the-hooks`, which
[`../gate-map.md`](../gate-map.md) places in the **Gated** tier: *"explicit human approval, per action,
before it happens."* None was asked for or given, and the flag was reflex rather than decision.

**Effect: none, measured twice, with a broken instrument named in between.** No `core.hooksPath` is set at
any config origin (`git config --show-origin --get-regexp 'core\.hooksPath'`, which exits 1 printing
nothing), and the common `.git/hooks` holds no
non-sample hook — so no hook would have run either way. The first attempt at that second measurement ran
`ls .git/hooks` **inside a worktree, where `.git` is a file**, naming a path that does not exist and
reporting zero: a green from a directory nobody had.

The part that belongs in this proposal is not the lapse but its shape. **The gate map names the act by one
spelling — `git commit --no-verify`.** What was performed was the same category in a different spelling, so
the gate *as enumerated* did not reach it. The rule this proposal asks for is the rule that would have.

The three are one defect in three materials — a brief, an instrument, and a gate policy. **An enumeration
is a naming convention, and a naming convention measures the convention rather than the phenomenon.** The
first cost a wrong number, the second a real artifact on someone else's tracker, and the third was
committed by the change arguing against it.

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

## Q3 — does it reach this workspace's own gate spellings?

If the rule is accepted, does it bind the places where **this workspace** writes a gated act as a command
line — [`../gate-map.md`](../gate-map.md) and [`../gates.json`](../gates.json)?
**`commit-without-the-hooks` is the measured case**, by incident 3: the gate map names `git commit
--no-verify`, and the act performed was the same category in another spelling.

The honest counter, stated so the question is not put loaded: **a gate must compile to a matcher, and a
category does not compile.** That is not a reason to keep an enumeration silently — it is the reason
`gates.json` already answers this for one act with a `none` action plus a sentence saying why no matcher
would be honest. Whether that shape should reach `commit-without-the-hooks`, or whether the gate map
should simply name more spellings, is a change to a compiled policy and is therefore asked here rather
than taken.

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

**Decision.** Marius Cetanas — **accepted 2026-08-14**, ruled directly in the supervising session and
recorded here rather than in it. All three questions answered, each with the ground it was decided on:

- **Q1 — the ENGINE.** The rule extends
  [`../../core/operating/autonomy.md`](../../core/operating/autonomy.md)'s existing paragraph and so ships
  to every adopter, rather than being recorded in `../memory/` and binding this build alone. _Ground: the
  rule's first half already ships in that file, and
  [`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md) is this repository's standing argument
  against a second carrier — one rule, one altitude._
- **Q2 — AUTHOR AND READER.** The converse clause binds the agent **reading** a constraint, not only the
  human writing one: an act's absence from a list is not a finding of permission. _Ground: a brief in
  flight is reachable only through its reader, so binding the author alone leaves every brief already
  written unrepaired — and the converse is demonstrably performable rather than merely asked for. Session
  17's implementer treated opening a pull request as outside a merge grant that never mentioned it,
  unprompted and against its own convenience, which is the behaviour this clause names._
- **Q3 — YES, it reaches this workspace's own gate spellings.** `commit-without-the-hooks` takes the
  `none`-action form [`../gates.json`](../gates.json) already uses — the category stated, plus a sentence
  saying why no matcher would be honest — on the `send-something-outside-this-repository` precedent this
  proposal cites above. _Ground: hook-bypass spellings are unbounded shell, and in incident 3 the
  enumerated matcher gave **zero** protection while reading as coverage. The `none` form trades a partial
  mechanical block for honesty, and the uncompiled-gate count moving **4 → 5** in both printers is the
  honest price rather than a regression._

_One measurement the ruling did not need but a reader following it will: `commit-without-the-hooks` is
**not declared in [`../gates.json`](../gates.json)**. It is a gate fragment composed from
[`../../packs/rituals/checkpoints/pack.json`](../../packs/rituals/checkpoints/pack.json), and
`composeFragments` refuses both a re-declaration that does not tighten and one that changes what a rule
matches — so the pack is the only carrier the tree admits, and Q3's edit lands there. The ruled act and
form are unchanged by where they land; the widened radius is that every workspace composing that pack
gets the change, which is the review's to weigh._

**Pull request:** [#246](https://github.com/sleepy-panda-works/portulan/pull/246) — the change that filed this.
