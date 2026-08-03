# Task 0010 — clause (a)'s wire arrives in an artifact an adopter receives

**Lane:** full · **Opened:** 2026-08-03, milestone 7 session 2, after [#156](https://github.com/sleepy-panda-works/portulan/pull/156) merged
**Verify recipe:** `tests` · **Status:** scoped, not started

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
