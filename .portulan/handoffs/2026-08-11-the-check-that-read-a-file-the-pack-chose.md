# Handoff — the check that read a file the pack chose, and the dimension that could not vary

**Milestone 7, session 7. Full lane.** Pull request
[#227](https://github.com/sleepy-panda-works/portulan/pull/227), task
[`0013`](../tasks/0013-the-interview-the-rail-and-two-checks.md), with
[`0005`](../tasks/0005-lint-the-persona-agent-binding.md) two-thirds discharged along the way.

## What this session was handed, and the ruling that shaped it

The maintainer opened with *"this is supposed to be the final session for M7"*. It was not, and saying
so was the first piece of work: row 7 had **six build items and three demonstrations** outstanding,
each full-lane under a protocol where a close is graded in a fresh context after the work merges. He
was offered four shapes, including **narrowing row 7 so it could close today**, and chose four items
with M7 left open. So *M7 stays in-progress by his decision rather than by this session's omission* —
which is the sentence the Status cell and the Session log both now carry, because a milestone left open
without a recorded reason reads as one nobody finished.

**Left after this: `upgrade`, clause (b) parity's adopter half ([#184](https://github.com/sleepy-panda-works/portulan/issues/184)), and D1, D2, D5.**

## The finding worth carrying forward

**A checker that opens a path assembled from somebody else's text owns that path.** `doctor` now
resolves each persona a composed pack contributes to `<tree>/agents/<name>.md`. A persona's `name` is
**free text** — the five-part contract does not include it, and `pack.schema.json` does not reach
persona markdown at all — so a pack declaring `name: ../../poison` had this validator read a file
outside the workspace, grade it, and print *names and tool grant agree*, with that file's own `name:`
echoed into the report.

Three things about how it was found and fixed, in the order they cost something:

- **The suite was green over the hole, because every fixture used a slug name.** Fifth measured
  instance here of *a harness you write to check your own change inherits your change's blind spot*.
  The pre-commit checkpoint found it by **executing** the traversal, not by reading the diff.
- **The first fix refused ordinary bindings.** It compared a realpathed file against an unresolved
  root, and every macOS temporary directory sits under `/var` → `/private/var`. Resolve both sides, the
  rule `validateContributions` already applies to a pack directory.
- **The lexical test is not redundant with the resolved one.** With no file at the traversal target,
  `realpathSync` throws `ENOENT` and the check fell through to its *unbound* sentence — which named the
  escaping path as "the one location a host loads agents from". **A refusal that depends on whether the
  attacker's file exists is not a refusal.**

## Two checks, opposite treatments of one absence, and why that is not drift

`plugin-lint` **fails** a persona in `core/personas/` with no binding; `doctor` **reports** an absent
binding for a composed pack's persona. Stated wherever a reader meets either, because it looks like two
checkers disagreeing:

- `plugin-lint` grades **this bundle's packaging**, where a shipped persona the host never registers is
  inert — `a-manifest-field-can-validate-and-load-nothing` — and closing that was the residual hole its
  own note had named since milestone 3.
- `doctor` grades **anybody's workspace**, where an adopter may run no agent layer at all. This
  repository is the exhibit: the `checkpoints` supervisor is unbound **deliberately**, because that
  ritual's mechanism is a fresh context and a subagent binding is what its `self-certify-a-checkpoint`
  gate refuses.

`0005`'s third criterion — a binding that restates its charter — is **left open on its own terms**. It
says a check that cannot state what it measures should not ship, and nothing has settled what *thin* is.
Two of three delivered is recorded in that task rather than the whole marked done.

## The dimension that could not vary

The legibility score shipped with **eight** dimensions and now has seven. *Executable verification* was
the eighth until the pre-commit pass measured it against the schema: form 0 of the manifest's `oneOf`
requires `verify` of every workspace that is not a pointer, a pointer returns before the score, and a
manifest failing the schema returns earlier still. **A constant +1 dressed as a measurement** — in a
list whose three new carriers each claimed every entry could genuinely be absent. Dropped, and the
replacement is a test rather than a sentence: *no dimension may be a key the schema requires*, asserted
against the schema itself, plus the count derived there rather than written down.

Two candidates from the session's own plan went the same way before it, and for the same reason: a
declared `tree` and a repo card per named repository are **already hard failures**, so scoring them
would have been a guaranteed point and a second carrier of a verdict the tool already renders. The rule
is one sentence and it is in the code: *a dimension that cannot vary measures nothing, and a dimension
that restates a hard failure is a second carrier of one verdict.*

## What to know before touching this next

- **The Status cell was cut, not extended.** It was at 493 bytes against a 500-byte rail, so the s0–s6
  narrative collapsed to a citation — of the **Session log and `m07.md` both**, because the milestone
  file carries the amendments and the delivery record while the per-session narrative for s0–s4 lives
  only in the log, and a citation wrong about its address sends a reader to the wrong page. The next
  session inherits **106 bytes** of headroom and the same rule: the cell carries state, the records
  carry history.
- **The drafted rail writes an absolute path into somebody else's repository** — the bundle `init` ran
  from, as the third of three locations, named as machine-local in the script and in the drafted README.
  **The maintainer asked whether that was visible enough for `vendor` or `upgrade`, and it was not:**
  `cli/vendor.mjs` copies a workspace's files **byte for byte** at its staging loop, so a `--switch`
  carries the path to a residence it was never true on, and neither that loop nor the `upgrade` entry
  said a word about it. Both lines now carry the token **`# portulan:bundle-fallback`** — a rewriter can
  *find* them, where a comment only asks the next implementer to notice — and both tools cite the token
  at the site that will have to re-derive it. `init.test.mjs` asserts the marker at both ends: that the
  drafted file carries it on exactly the two lines holding the path, that no other drafted file carries
  the path unmarked, and that `vendor.mjs` and `portulan.mjs` still name it. **Why this is a gap and not
  a defect:** a stale bundle path exits **2 — could not run**, never 0, so it fails closed — which is
  also why it would be easy to never notice.
- **The dimension count had a fourth carrier nobody swept**, found by the records checkpoint after the
  drop: `spec/slots.md` still said *eight* and *the other six read the manifest* while four other
  carriers said seven. Fixed in the records push. **The count is derived by a test and written down in
  five places** — if it moves again, grep the digit and the spelled word both.
- **`AGENT_DIR` is exported from `plugin-lint` and imported by `doctor`.** It is a measurement of where
  one host looks, with a positive control recorded at its declaration — never re-spell it.
- The interview's reader is injected (`options.io`), so the loop is tested with no TTY anywhere. Every
  question's validator is the one the flags path already used; adding a question means adding it in one
  place, not two.

## Fidelity

Both checkpoints ran in fresh contexts **before** the commit. Session-open **APPROVE-WITH-ADJUSTMENTS
(8)**, pre-commit **APPROVE-WITH-ADJUSTMENTS (5)** — all thirteen folded, **twelve of them as numbered
items** in the task file and two applied in place, which is why that file's numbering runs to 34 rather
than 35. Recorded there rather than edited into the plan they were grading. Between them they caught the false
green, the constant dimension, a stale `CHANGELOG` sentence in the section that accumulates, a test that
had stopped checking, two exit codes that would have read as verdicts, and a superlative — *"the four
smallest"* — where a ruling with real provenance was available.

Suite **1352 pass / 0 fail**, eleven recipes green. Seam scan clean over the diff, the branch name and
the commit message, run term by term rather than as one pattern.

**Left for the next session:** Copilot rounds on #227 to empty, then **Marius merges**. The records in
this push owe a second pre-commit pass on the additions, per the sequence #143 ruled.
