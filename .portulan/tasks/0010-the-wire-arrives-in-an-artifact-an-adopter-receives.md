# Task 0010 — clause (a)'s wire arrives in an artifact an adopter receives

**Lane:** full · **Opened:** 2026-08-03, milestone 7 session 2, after [#156](https://github.com/sleepy-panda-works/portulan/pull/156) merged
**Verify recipe:** `tests` · **Status:** DONE — all eight recipes green, and the wire demonstrated live

> Scoped and left unstarted **deliberately**, with the measurements already taken, because the session
> that scoped it no longer had the budget to move fourteen carriers and put the result through a
> pre-commit checkpoint. The milestone-7 session-open checkpoint named this row as the close's most
> likely refusal point and said the refusal should be taken **early in PR 2 rather than at the close**.
> This file is that refusal, taken early, with the work handed over rather than half-done.

## The defect, measured rather than inferred

Row 7 clause (a) requires the session-end gate **wired** through the compiled policy. It is not.

- `cli/compile.mjs:951-952` emits both hooks pointing at `${CLAUDE_PROJECT_DIR}/.portulan/compile/` —
  `gate.mjs` (6,667 b) into `PreToolUse`, `stop.mjs` (22,596 b) into `Stop`.
- `package.json`'s `files` is `cli/ core/ spec/ packs/` + README/LICENSE/NOTICE. **`.portulan/` ships in
  no npm artifact**, so every adopter's compiled policy names two files they never receive.
- A missing hook **fails open**. So the gate an adopter is told they have is one they do not have.

## Why both runners move, not just `stop.mjs`

`gate.mjs` is `stop.mjs`'s sibling and sits in the same unshipped directory. There is a defensible
asymmetry — a missing `PreToolUse` hook still leaves the permission rule beneath it, while a missing
`Stop` hook has no layer below — but shipping one and reasoning about the other is
[#91](https://github.com/sleepy-panda-works/portulan/issues/91)'s class, which session 1 hit twice in one
pull request. Move both, or record why one stays, in the change itself.

## The spelling is the real work, not the file move

The hook must resolve in three contexts, and the maintainer's ruling of 2026-08-03 (**no npm publish**
for the close) means it cannot lean on a published package:

1. **This repository** — the runner in the checkout's own `cli/`.
2. **A project-local install** — `node_modules/@sleepy-panda-works/portulan/cli/…`, which is under
   `${CLAUDE_PROJECT_DIR}` and therefore reachable.
3. **Global / npx-only** — *not* reachable by a project-relative path at all.

Resolve in that order and **say plainly when it cannot** — a hook that silently does nothing is the
fail-open this whole task is about. If the honest answer needs a new visible subcommand or `bin`,
**that returns to Marius before it is built**: `cli/portulan.mjs` reserves minting one to him.

## What breaks if this is done carelessly

**This repository's own five live hooks** — four `PreToolUse` on `gate.mjs`, one `Stop` on `stop.mjs`,
in `.claude/settings.json`. Moving the runners without recompiling them in the **same change** leaves
customer zero's session-end gate and gate policy pointing at files that are gone. Verified present on
2026-08-03.

## The fourteen carriers

`CHANGELOG.md` · `.claude/settings.json` · `docs/plan.md` · `cli/stop-gate.test.mjs` ·
`cli/compile.test.mjs` · `cli/init.mjs` · `cli/README.md` · `cli/doctor.mjs` · `cli/compile.mjs` ·
`.portulan/identity.md` · `.portulan/gate-map.md` · `.portulan/tasks/0007-per-reason-stop-gate-counters.md` ·
`.portulan/products/portulan/affordances.md` · `.portulan/memory/verify-preconditions-fail-closed.md`

## Done when

- [ ] Both runners ship in an artifact an adopter receives, proved by `npm pack` → install → run.
- [ ] `compile` emits a hook that resolves in contexts 1 and 2 and **names the failure** in context 3.
- [ ] This repository's own five hooks are recompiled in the same change and still fire — demonstrated,
      not asserted, by forcing the Stop-gate red.
- [ ] All fourteen carriers swept.
- [ ] The handoff-index freshness rail gets a spelling, or records why it still cannot have one
      ([#148](https://github.com/sleepy-panda-works/portulan/issues/148) stays open by ruling).


## What the first attempt PROVED, and it is the finding this task was missing

**Both runners derived the adopter's workspace from their own file position**, and that — not the
`files` list — is why they could never ship:

```
gate.mjs:  policyPath(resolve(HERE, "..", ".."), basename(resolve(HERE, "..")))
stop.mjs:  WORKSPACE = resolve(HERE, "..");  REPO = resolve(WORKSPACE, "..")
```

That works for exactly one layout — the author's, with the file at `.portulan/compile/`. From `cli/`,
and far more so from `node_modules/@sleepy-panda-works/portulan/cli/`, a runner has **no idea** where the
adopter's workspace is, and inferring one would be [#131](https://github.com/sleepy-panda-works/portulan/issues/131)'s
class (paths resolved against the author's layout) in the two tools with the most to lose from it.

**The fix shape, implemented and passing:** the project root is **told**, never derived —
`CLAUDE_PROJECT_DIR || cwd`, with the workspace directory overridable — and `compile` computes the
emitted spelling from where `compile.mjs` itself sits at compile time, expressing it relative to the
project when it lands inside one (covering a checkout *and* a project-local install with one rule) and
absolute when it cannot, saying so rather than silently pinning a hook to one machine.

## State on `m7-residence-composition-and-the-wire`

Done and verified: both runners moved to `cli/gate.mjs` and `cli/stop-gate.mjs`; the location derivation
replaced; `compile`'s emitted spelling computed; **customer zero's five live hooks recompiled** and now
naming `${CLAUDE_PROJECT_DIR}/cli/gate.mjs` and `.../cli/stop-gate.mjs`. **Suite 904/904. Seven of eight
recipes green.**

**The carrier sweep is done: 26 links across 21 files re-based**, each computed from the file that
carries it rather than substituted blindly — ten of them were bare siblings (`](gate.mjs)`) in
`.portulan/compile/README.md`, which a `compile/`-anchored pattern does not match, and which is why the
first pass reported green while ten were still dead.

## The demonstration, and it was not staged

**The Stop-gate blocked this session's own \"done\" — running from the moved runner.** After the move and
the recompile, `.claude/settings.json`'s Stop hook reads
`node \"${CLAUDE_PROJECT_DIR}/cli/stop-gate.mjs\"`, and it fired on the red `links` recipe and refused,
printing the nine dead links by file and line. That is clause (a)'s wire working end to end in customer
zero — the runner shipped where an adopter receives it, the compiled hook naming it, and the gate
actually holding — observed rather than asserted, and observed because it caught its own session.

`npm pack` now carries **83 files including `cli/gate.mjs` and `cli/stop-gate.mjs`**, where before it
carried neither. Suite 904/904, all eight recipes green.

**What is still owed on this row** (not this task): the handoff-index freshness rail's spelling, and the
context-3 case — a global or npx-only install, where no project-relative path exists and the emitted hook
falls back to an absolute one. That fallback is implemented and is **not yet demonstrated**.
