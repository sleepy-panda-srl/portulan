# Handoff — an undeclared policy is a state, and the compiler reported it as a missing file

**State.** One branch, `fix/compile-names-an-undeclared-policy`. Fifteen recipes green, `compile` suite
**285/285** (six new). Not committed, not pushed, no PR. Two conditions of `dod.md` are **owed** and
named at the end — they are the reason this is not further along, rather than an oversight.

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

## Owed, and why it is owed rather than skipped

- **`dod.md` condition 7 — the supervisor checkpoint.** Not run. This is full-lane work by the gate
  map's own boundary (it changes the enforcement compiler), so it needs a verdict from a fresh context
  that has not seen the implementation. This session was instructed not to delegate to subagents, so
  there was no fresh context to be had. It is owed before commit, not waived.
- **`dod.md` condition 5 — the pre-commit seam scan.** Not run. The term list lives outside this
  repository and this session does not have it.
- **`docs/plan.md`'s Session log** carries this session's entry with both gaps stated, rather than a
  fidelity note it cannot support.

Nothing here is blocked on the code. Both are blocked on a person.
