# Handoff — the gate allows in silence when it reads the wrong tree

**Post-M7 hardening, session 24. Full lane, in progress.** No milestone row moves. Continues
[#220](https://github.com/sleepy-panda-srl/portulan/issues/220), whose first arm merged as
[#295](https://github.com/sleepy-panda-srl/portulan/pull/295). Baseline `a2c0f91`, suite **1725 → 1733**, **fourteen** recipes green (thirteen declared plus the pack-composed `tools/github:actions-pinned`).
Implementer Opus 5, identity line checked at boot before any file was written.

## What landed today before this arm started

**#295 merged** (`7aed889`) after three more Copilot findings, all real: a stale `maxBuffer`
rationale that described a limit the same change had removed; a bare `*` pathspec that silently
matched nothing under `GIT_NOGLOB_PATHSPECS` — reinstating the very gap that arm closes; and **four**
independent `today()` calls on one path, where a stop spanning local midnight could search history
for a date nobody checked the tree for.

**#220 was closed by that merge, against a standing ruling, and is reopened.** I had removed
`Closes #220` from the pull request body and verified `closingIssuesReferences` returned `[]` — and
treated that as sufficient. It is not: that field reflects the **body only**, and this repository
rebase-merges, so every commit message lands on `main` and is parsed too. The branch's first commit
still carried `Closes #220.` in its body and closed the issue at merge. **Two carriers, one checked.**
The commit message on `main` is now permanently wrong about the issue; the correction lives on the
issue instead, which is where a reader arriving from the commit lands.

## The premise this arm rests on, measured rather than assumed

The record carried **no** measurement of a Stop payload's shape, and the whole arm depends on one
field. Probed with a temporary instrument, wrapped so it could not affect the verdict, reverted after:

```
keys: session_id, transcript_path, cwd, prompt_id, permission_mode, effort,
      hook_event_name, stop_hook_active, last_assistant_message, background_tasks, session_crons
```

**`cwd` is present.** Had it not been, this arm would degrade to precisely what #295 already ships,
and building it would have been ceremony — which is why it was measured before the plan, not after.

## The defect, demonstrated with the real binary

Two repositories: a **told** tree (clean, carrying today's handoff) and a **session** tree (a live
divergent repo with unrecorded work and no handoff). The payload names the session tree in `cwd`;
`CLAUDE_PROJECT_DIR` names the told one.

- The gate **allows, with empty stdout** — it says nothing at all.
- Control, same payload with the hook pointed at the session tree: it **blocks**. So the obligation is
  real and the gate simply never saw it.

This is the direction the merged arm cannot reach: both its naming arms live inside
`if (!handoffPresent && didWork())` and fire only when the gate blocks. A false green, which this
runner's own doctrine ranks worse than the false red the first arm removed.

## The repair

**The tree a stop is about is resolved once, in `main()`, from `payload.cwd`, and threaded down.** Five
consumers move with it — `didWork`, `handoffToday`, `handoffInHistory`, `treeIdentity`, and the
refusal's interpolated workspace path. **Three deliberately do not**, and the reasons are not
symmetry: the refusal COUNTER (a resolution flipping mid-session — the incident's own shape — would
rename its file and reset spent counts, a cap weakening nobody chose), and both halves of the recipe,
`defaultRecipe()` and the `cwd` its command runs in. That last is a security boundary rather than a
preference: the gate runs the manifest's `run` through `bash -c`, so a recipe read from a workspace
found under a payload-supplied path is arbitrary command execution seeded by stdin.

**The same-repository guard is the difference between a fix and a bypass.** `cwd` is the one input the
gated agent can steer. Preferring any tree it names would let a session point the gate at a clean
unrelated clone and be allowed in silence — the same defect, one remove away — and a foreign tree's
obligations are unsatisfiable false reds besides. So the session tree answers only when
`--git-common-dir` matches, compared through `realpathSync` because macOS symlinks `/tmp` to
`/private/tmp` and raw strings disagree about identical directories. Worktrees share their common dir
with the origin repository, which is exactly the class this arm exists for.

**Degradation splits, and the split is the honest part.** A `cwd` that was offered and could not be
used prints one sentence whatever the verdict — it explains an allow as much as a refusal. A payload
with **no** `cwd` is silent and byte-identical to before, because a host that never offered the datum
has degraded nothing; that also makes every pre-existing case a control for this change for free.
**The residue, stated rather than buried: on the degraded path the silent-allow gap remains by
construction.** Forcing a block there would manufacture an obligation from no evidence and leave the
removed-worktree case permanently blocking — the false red the first arm existed to remove.

**A refusal names both trees; an allow says nothing.** Told ≠ session is the routine worktree case
here, so a divergence line on every green stop would be a metronome, and this gate's sentences are
worth reading precisely because they are rare.

## Demonstrated

Old runner and new, on one repository with two working trees — the incident's actual shape:

| runner | result |
|---|---|
| `main`'s | **allows, stdout and stderr both empty** |
| this one | **blocks**, naming `…/wt (on \`session-branch\`)` and the told tree it differs from |

Six cases added. Against `main`'s runner **three go red** — the criterion and the two degradation
sentences — while three pass on both sides as controls: a clean recorded session tree, a `cwd` that is
a **subdirectory** of the told root (sessions `cd` constantly; that is not divergence), and a payload
with no `cwd` at all.

**The first fixture was wrong and the guard caught it.** It used two unrelated repositories, which the
same-repository rule correctly refuses to prefer — so it demonstrated the guard, not the defect. The
real shape is one repository, two worktrees.

## Sibling sweep

Instrument, as it ran: `grep -rn -- "CLAUDE_PROJECT_DIR\|process.cwd()\|PORTULAN_WORKSPACE" cli/
.portulan/verify/ .github/`. `cli/stop-gate.mjs` is the only reader of TREE STATE; `cli/gate.mjs`
shares the derivation for a different question — policy lookup — and does not change. Every other hit
is a CLI resolving its own arguments.

## Honest limits

- The degraded path keeps #220's silent-allow gap, by construction and by choice, as above.
- Nothing checks that the session's tree is the one the session *wrote* to; `cwd` is where it ended.
- The same-repository guard trusts `--git-common-dir`. A session inside a submodule or a nested
  repository of this one resolves to its own common dir and is treated as foreign.
- **It stops a FOREIGN tree answering; it does not stop steering within this repository.** Measured at
  the pre-commit checkpoint: a told root that is dirty and unrecorded, with `cwd` naming a clean,
  recorded sibling worktree, is allowed where `main` blocked. Narrower than the hole this arm closes,
  and not closable from here — the gate is told where the session ENDED, never where it worked.
- **A false sentence the first draft could emit, caught at pre-commit:** the divergence clause compared
  a realpathed session root against a merely `path.resolve`d told root, so a symlinked told root was
  named as two trees. The same trap the same-repository guard defends, left unapplied one comparison
  away. Fixed and pinned by a fixture that makes its own symlink, so CI exercises it too.
