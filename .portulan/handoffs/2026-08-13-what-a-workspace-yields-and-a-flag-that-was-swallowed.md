# Handoff — what a workspace yields, and a flag that was swallowed

**Milestone 7, session 16. Full lane.** No row moves — M7 closed in session 15. This settles the three
items that close left open, on a fresh Fable-5 supervisor's rulings, and lands two of them.

## The finding worth carrying forward

**A report that names an artifact must describe *that* artifact.** `doctor`'s enforcement section
printed `Claude Code: 10 of 23 rule(s) compiled … → .claude/settings.json` while
`.claude/settings.json` carried **eleven** rules' compilation — the eleventh composed from
`rituals/checkpoints`. The arrow was right and the number was about something else: the policy the
workspace *declares*, not the one it *yields*.

That is not a narrower question honestly answered. **A sentence whose subject is one thing and whose
citation is another is a false claim**, and the two printers proved it by disagreeing out loud — 4
uncovered gates from `compile --matrix`, 3 from `doctor`, one question, two answers.

**The repository had already made this exact repair once, and written down why.** `dod.md` condition 1
was rewritten from *declares* to **yields** for the recipe set, on the ground that "a condition scoped
to the declared list would let one go red with this condition satisfied". The same sentence transfers
word for word to a gate policy. **When a rule has already been fixed on one noun, look for the other
nouns** — the fix travels with the argument, not with the file it first landed in.

`doctor` now composes through `compile`'s own `packContributions`/`composeFragments`, before the parse
and inside the same guard, so a pack's fragment is validated by exactly the code that validates a
hand-written rule. Not a second implementation: this file already imported four functions from there
and mints none of them.

## The second finding: a flag that was silently discarded

`doctor`'s argument loop ended `else if (!argv[i].startsWith("-")) dirs.push(argv[i]);` — **with no
`else`**. Every unrecognised `-`-prefixed argument was dropped on the floor. Measured:

```
doctor --repo-rot /nonexistent   →  exit 1, "no readable manifest at /nonexistent/workspace.json"
```

It discarded the misspelled flag and **graded `/nonexistent` as a workspace**, returning a red verdict
for a reason that had nothing to do with what was asked. A user reading that output would debug a
workspace that was never the subject.

**A typo in a flag is could-not-run, never a verdict.** Both `doctor` and `index` now refuse by name
and cite both real invocations (`portulan X --help` and `node cli/X.mjs --help`), because a user who
typed one cannot act on advice about the other.

## What the supervisor caught that the close had wrong

- **"The only two of eight" was five-sixths true.** The close's handoff named `compile` and `index` as
  the tools without help text. `doctor` is a **third** — it has no `--help` handling at all, and what a
  user saw was its no-arguments usage line on stderr at exit 2: the could-not-run fallback, not an
  answered question. Found by measuring all eight rather than reading the claim.
- **The edge case is live in-tree, and its severity is not a preference.** A workspace composing
  gate-contributing packs while declaring no policy of its own falls outside `doctor`'s
  `if (workspace.gates)` guard. `examples/` **is** that workspace, and `.portulan/verify/doctor.sh`
  grades it on every run as part of a required check — so a *failure* there would turn this
  repository's own verify red over a workspace behaving exactly as designed. It reports.
- **`spec/README.md` was not in breach of condition 4.** The close said it was. It says "Not built" and
  claims no capability; the real defect is that it is **undispositioned** where its own neighbour row
  states its disposition outright. And it was never untracked — **#138** has existed since 2026-07-30.

## What is deliberately NOT here

**The milestone-9 amendment.** The supervisor ruled that the cross-repo claims-lint gap belongs to row
9 — its criterion is the first that needs a feed-side card and its repo-side tree green together — but
**a milestone criterion is amended by the maintainer and by nobody else.** So this change carries only
what is true today: `spec/README.md` and `0017` gain a pointer to #138 and say plainly that the owning
milestone is the maintainer's to decide. The row is left *not built, tracked, undispositioned* rather
than claiming a milestone here first, because `spec/README.md` must never claim row 9's ownership
before `docs/plan.md` says it — two carriers, and the reader obeys the narrower.

**No exit code moves for gate coverage.** The enforcement section stays report-only; nothing legislates
a coverage floor and `doctor` does not enforce what nobody legislated.

## The one my own change nearly shipped

**A test that passed for the wrong reason, caught by mutating rather than by reading.** The pre-commit
pass found that a comment claimed a property `doctor.test.mjs` pinned and it did not. I wrote the pin —
and the pin did not bind either: the fixture was a hand-rolled manifest that **failed schema validation
and never reached the packs or enforcement sections at all**, so its "zero enforcement findings" was
true for a reason that had nothing to do with gate fragments. Rekeying the guard from `fragments` to
`contributions.length` left it green.

Rebuilt from the suite's own `wellFormed()` and **given a precondition** — `assert.ok(checks(findings,
"packs").length > 0)` — so the assertion cannot be satisfied by an early return. **A fixture that does
not reach the code under test is a test that cannot fail**, and the only thing that distinguished the
two was mutating the guard and watching for red. Two more properties the pass listed as merely
undemonstrated are pinned the same way: the unresolved-pack note, and the composed line naming its
members rather than a bare count.

## Still open after this

- **The row-9 amendment** — the maintainer's ratification, and its own small PR.
- **A second divergence one door down, measured and not closed:** `compile`'s `policyPath` falls back
  to `<ws>/gates.json` when a manifest declares no `gates` slot, so `compile` will compile an
  *undeclared* `gates.json` where one exists, while `doctor`'s guard keys on the manifest slot and
  skips it. Keyed manifest-slot against default-path. No workspace in this tree has that shape, which
  is why it is filed rather than fixed — but it is the same class as the divergence this change closed.
