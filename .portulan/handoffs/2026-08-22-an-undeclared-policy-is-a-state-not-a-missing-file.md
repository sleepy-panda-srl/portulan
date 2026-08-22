# Handoff — an undeclared policy is a state, and the compiler reported it as a missing file

**State.** One branch, `fix/compile-names-an-undeclared-policy`, open as
[#328](https://github.com/sleepy-panda-srl/portulan/pull/328). Fifteen recipes green, `compile` suite
**289/289** (ten new), full suite **1799**. Both conditions this handoff first recorded as **owed** are
now discharged, by a later session on the same day that had what the first one lacked — the term list on
its machine, and permission to open a fresh context. What that session also brought back is Copilot's
first round: **three findings, all real**, one of them a defect older than this branch.

## What was wrong

`policyPath`'s own note says a workspace with no top-level `gates` key is *"a legitimate shape, and
refusing it would make the key required, which is a spec change nobody decided."* The very next line
in `run` handed that path to `readJson`, which refused it with `cannot read the gate policy at
…/gates.json — ENOENT`. So a shape this repository documents as legitimate was reported as a corrupt
or deleted file, and the reader was sent hunting for something that was never supposed to exist.

**Two situations arrived as one sentence** — a workspace that NAMES a policy file which is missing (a
genuine error; something is declared and absent), and a workspace that names none at all (a state).
Only the first is a failure to read.

The throw also happened **before `packContributions` was ever called**, so the message could not carry
the fact that actually matters: a workspace in this shape may still compose packs contributing gate
fragments, and those rules reach nothing, because a fragment tightens a policy and there is none to
tighten.

## Decisions + why

- **`policyDeclaration` reports the arm, `policyPath` stays the narrow answer.** Every existing caller
  and all eight existing tests were written against a string; changing that signature to carry one
  boolean would have churned them for nothing. The wrapper is one line.
- **A REFUSED path is `declared: false`.** An absolute path or a `../` escape falls back. The manifest
  named something, but nothing it named is usable, so the compiler is on the conventional path and must
  say so rather than claim the workspace declared the file it is about to not find.
- **It stays a refusal — exit 2, nothing written.** Nothing was compiled, and a compiler reporting
  success having emitted nothing is the failure this repository keeps writing checks against. What
  changed is that the refusal names the state and what it costs, not whether it refuses.
- **Compiling pack fragments against an empty base was considered and NOT done.** It would make an
  installed pack silently arm hooks that run on every tool call, which is a policy decision rather than
  a bug fix — and it sits against `parse`'s own refusal to *"emit an artifact that gates nothing"*. Put
  to the maintainer as an explicit option and declined in favour of the diagnostic alone.
- **The pack refusal is swallowed inside the diagnostic and nowhere else.** `packContributions` throws
  on a shadowed pack, a malformed pack manifest, an unresolvable root. Raised from inside this message
  they would answer a different question than the one the reader has. Declare a policy and the next run
  surfaces them on their own terms; there is a test pinning exactly that.

## What it looks like now

Against `sleepy-panda@portulan-internal` 0.7.0, which is where this was found:

```
compile: this workspace declares no gate policy — `workspace.json` has no top-level `gates` key,
  and there is no `gates.json` at …/0.7.0/gates.json. Nothing was compiled and nothing was written.
  2 pack-contributed gate rule(s) from `rituals/checkpoints` are therefore NOT compiled: a fragment
  tightens a policy, and there is none here to tighten.
  Declare one with `portulan new gate-policy`, or leave it undeclared deliberately — a workspace with
  no gate policy is a legitimate shape, and this is a state rather than a fault.
```

The count is derived, not asserted: it independently reproduces the `2 gate fragment(s)` that `doctor`
reports for that workspace.

## The tests, and the control that makes them worth having

Six new, in `an undeclared gate policy is a state, not an unreadable file`. They were **seen red**, and
the control was designed to isolate rather than to be dramatic: reverting `compile.mjs` wholesale only
proved an import fails, so the branch was disabled in place (`if (false && …)`) with the export kept.
Three behavioural tests went red; three stayed green — `policyDeclaration`'s two, and the regression
guard asserting a DECLARED-and-missing policy still reports `cannot read the gate policy`. **That guard
is supposed to be green in both worlds.** It pins the half that must not change, and a control where
everything reds would have told me nothing about it.

## What the review round changed, and the one that was not ours

Copilot's round 1 returned three findings on the inline channel. All three were confirmed against the
code before anything was touched; none was argued away.

- **The containment test was another hand-rolled `startsWith("..")`.** `path.relative(base, resolved)`
  of a directory named `..policy` is `..policy/rules.json`, which that spelling calls an escape — so a
  policy that was declared, present and inside fell back, and was then told it had no `gates` key. Two
  defects in series. `./inside.mjs` exists precisely to carry this rule, `compile.mjs` **already
  imports it** at line 48 and **already carries the warning** at `recordedOrigin`. **This one is older
  than the branch**: `policyPath` shipped with it and the change merely moved the line, which is how it
  came into a diff Copilot reads. Fixed here under the sibling rule, and demonstrated both ways — under
  the old spelling the workspace refuses, under `isInside` it compiles.
  **A count was asserted here and is withdrawn.** The first draft called it *"the fifth copy"*. The
  pre-commit checkpoint could not reproduce that figure; a census then found **four other behavioural
  copies — including one in this same module, at `resolveWorkspace` — and three display-path uses**.
  They disagree on the empty relative path and on absolute paths, so a blanket substitution would change
  behaviour at two of them: that is [#331](https://github.com/sleepy-panda-srl/portulan/issues/331), not
  this commit. **An unreproducible number is worse than no number**, and it was written in the entry
  whose whole subject is a message asserting more than it knew.
- **`declared: false` was four states reported as one sentence.** No manifest · no `gates` key · a
  refused value · and the declared arm. The message asserted the second for all of them, so a manifest
  that *did* name a policy was told the key was absent, and advised to "leave it undeclared
  deliberately". **That is this change's own thesis failing one level down** — the reason it is worth
  recording rather than just fixing. `policyDeclaration` now returns a `reason` and the diagnostic
  names the arm it is in, with its own closing advice for the refused case.
- **An orphaned JSDoc.** `policyPath`'s docblock stayed above `policyDeclaration` when the function
  moved down, so one function carried two blocks and the other none. Moved.

## Both owed conditions, now discharged

- **`dod.md` condition 5 — the pre-commit seam scan. CLEAN.** Nine explicit terms from the private
  context's own list, over the six changed files, the commit message and the branch name. **Run with a
  control**: a term drawn from the list itself was planted into a copy of `compile.mjs` and the scanner
  reddened on it, so the clean result is an answer rather than a scanner that cannot see. The explicit
  list was used and nouns were **not** harvested from the context file — that instrument is on record
  here as the one that yields false reds.
  **The shape sweep, at its real scope.** 404 added lines — 279 in `cli/`, 125 in the record layer.
  Zero hosts, addresses, connection strings or personal names anywhere. **One URL, and saying "zero"
  would have been false**: this pull request's own, in the record layer, which is this repository's and
  not the seam's. An earlier draft of this line claimed zero URLs in "289 added lines" — a figure that
  reproduces from no scope of this diff, and which the pre-commit checkpoint traced to the `compile`
  suite count sitting nearby.
- **`dod.md` condition 7 — the supervisor checkpoint.** Run, in a fresh Fable 5 context, on the
  maintainer's explicit grant lifting this session's no-subagent instruction. Verdict and its findings
  are recorded in `docs/plan.md`'s Session log entry for this date.

## Undemonstrated, and named rather than left for the next reader to find

**A `gates` value the compiler refuses, in a workspace that also has a conventional `gates.json`,
compiles silently from the conventional file.** The new `refused` diagnostic surfaces only when the
conventional file is *also* absent, so an author whose declared key was ignored is never told. This is
pre-existing and unchanged here — and it is consistent with the documented division of labour, since
`doctor` is the tool that judges a manifest — but no test pins that shape and nobody has demonstrated
it. Found by the pre-commit checkpoint.

**The lesson worth keeping is the first session's, not the second's.** It was right to stop. Both gaps
were blocked on a person and it said so instead of typing an attestation the rail would have accepted —
the rail checks that the entry *contains* `seam scan … clean`, so a false one is green. What unblocked
them was not more effort; it was a different machine and a lifted instruction.
