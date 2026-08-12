# Handoff — a test that passes is not a test that binds

**Milestone 7, session 9. Full lane.** Task
[`0015`](../tasks/0015-upgrade-and-the-migration-chain.md). `upgrade` — the eighth and last
subcommand — and the migration mechanics under it.
[#231](https://github.com/sleepy-panda-works/portulan/pull/231).

## What this session was handed

The maintainer confirmed the slice before planning, as the brief asked, and ruled three things: the
slice is `upgrade` **plus its mechanics** in both residences; a step may be a **version** migration
**or a repair**; and **no MAJOR is minted** to give the machinery a subject. The second ruling is the
one that made the tool useful — the workspace train's only MAJOR migration is `1.0 → 2.0` and
**nothing in this tree declares 1.0**, so a version-only chain would have shipped machinery
demonstrable on a fixture.

D1, D2 and D5 are untouched. M7 stays open.

## The finding worth carrying forward

**A test that passes has not been shown to be capable of failing, and this session measured five
distinct ways one can fail to bind.** Four were found by mutation, one by re-running the harness:

1. **It tests the arithmetic, not the tool.** The *could-not-tell* case called `planFor()` directly,
   so deleting `run()`'s exit-2 guard left it green. One rule, two sites, covered at one.
2. **It was written after a supervisor named the defect** — the moment attention is lowest. Two
   fixes shipped with no test at all and were caught only by mutating them.
3. **Its own fixture defeats it.** The pre-existing-directory case put a *file* in the directory, and
   a non-empty directory defeats `rmdir` whether or not the scope is right.
4. **A neighbour starts emitting the string it matched on.** `upgrade`'s direction gate asserted
   `/older than|upgrade the CLI/i`; a later adjustment taught **`doctor`** to say *upgrade the CLI*,
   so disabling the gate entirely still produced exit 2 with those words. **The test lost the ability
   to fail without being edited.** Found only by re-running the harness after the tree moved — which
   is the operative lesson: forcing red once, when the test is written, is not sufficient.
5. **The mutation itself changes nothing observable.** The first attempt to force the inert-rewrite
   test red restored an *inert* rewrite and stayed green — correctly. A mutation that does not alter
   behaviour proves nothing about the test.

## Four things that cost something, in the order they did

- **Running the step over `.portulan` broke it, and no fixture could have.** A handoff that
  *documents* the `portulan:bundle-fallback` marker in prose was read as a malformed marked line, and
  `upgrade` refused the one workspace this repository owns — exit 2. Every unit test passed. The
  narrow lesson is better than "run it live": **a token that marks code also appears in the prose
  documenting the token**, so any tool keying on a marker needs a scope. It is scoped to shell
  scripts now, and the identical condition in `plan()` was fixed in the same stroke.
- **A fix that could not fire, under a comment asserting it did.** The reword of `vendor`'s symlink
  refusal matched `refusing to copy through`; the message says `refuses`. The repair was not a better
  pattern — matching another module's sentence makes this file a second carrier of that module's
  wording. Nothing is rewritten now; the frame says who declined and the borrowed sentence is left
  alone.
- **`String.replace`'s dollar-sequences, twice in one session.** The pre-commit checkpoint found `$&`
  in a bundle path splicing the old path back in — a corrupted rail `doctor` grades **green**, since
  it never runs shell. Twenty minutes later I hit the identical bug in a shell one-liner while
  editing the pull-request description. **Knowing a defect is not the same as not committing it.**
- **`0020` three times, once inside the commit that talks about sweeping for siblings.** I guarded
  `applyEdits` against escaping paths, wrote about siblings, and did not check `restore`. Copilot
  found it. Sweeping properly then found a **third** site, `ws.read()`. All three share one `inside()`
  helper now, because three copies of a comparison is how the second came to be missing.

## What to know before touching this next

- **`spec/migrations/` is the contract, not `cli/upgrade.mjs`.** A step is a module of one of two
  kinds; owedness is derived from workspace **state**, never a stamp, so steps are idempotent and an
  interrupted run recovers by re-running rather than by a transaction. `owed` is three-valued and the
  third value maps to exit 2.
- **A step is somebody else's code.** Round 6 was six findings of one family: `owed()` throwing,
  `owed()` returning junk, `plan()` throwing past the rollback, `unwindDirs` stopping on `ENOENT`,
  `EEXIST` treated as fatal, and a fixed staging filename. Anything added here must assume a step
  misbehaves.
- **`examples/` at 2.4 is evidence, not neglect.** Nothing restamps a MINOR, and a live test pins
  that `upgrade --check` reports it owing nothing.
- **Two things are NOT demonstrated**, and every carrier says so: the `1.0 → 2.0` step is
  **fixture-only** — nothing anywhere declares 1.0 — and the repair has no subject in this
  repository's own workspace, whose rail was hand-written and carries no marker.
- **A test of mine poisoned another suite**, and I mis-attributed it twice as a pre-existing flake.
  `../escaped.md` resolves to `<tmpdir>/escaped.md`, the exact global path `feedback.test.mjs`
  asserts must not exist. Refused, it writes nothing — but a **mutation run disables the guard on
  purpose**, the write lands, and the file is left at a shared path. The other test's cleanup deletes
  it, so the failure self-heals and reads as flakiness. **Scratch paths that escape must be unique.**

## Fidelity

Session-open ran in a fresh **Fable 5** context and returned **APPROVE-WITH-ADJUSTMENTS (10)**; all
ten folded and recorded as numbered items in [`0015`](../tasks/0015-upgrade-and-the-migration-chain.md).
One caught a real fail-open: the pre-state branch keyed on *the fact* of `doctor`'s refusal rather
than its direction, so a workspace from the **future** would have planned to nothing and exited **0**.

Pre-commit, fresh **Fable 5**, returned **APPROVE-WITH-ADJUSTMENTS (7)**. It ran **nine mutations of
its own** rather than trusting the session's harness — which was the right instinct, since that
harness lived in a scratchpad and was not in the diff — and independently verified that a rewritten
tripwire in `portulan.test.mjs` was repointed rather than disarmed.

A third fresh **Fable 5** supervisor settled the two deferred design questions, under an explicit
instruction to grade against the **vision** and to test the implementer's framing. Both ruled to keep
what shipped, and it **corrected a citation**: `identity.md`'s byte-identity paragraph is about the
npm package, not workspace installs; the load-bearing carrier is `0020`'s *"one identifier with two
contents"*. What decided it was thesis 6, **storage follows ownership**.

**Six Copilot rounds, seventeen findings, every one real and none refused.** Eleven recipes green;
suite **1485 pass / 0 fail** against a 1415 baseline at `5a7b5ca`. Seam scan clean on every commit,
term by term, over the diff, the branch name and the message.
