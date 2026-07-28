# Handoff — milestone 4 closes, and the close checkpoint ran the demo the session could not

**Date:** 2026-07-28 · **Milestone 4 (Enforcement compiler), close** · Branch
`m4-closes-on-what-was-demonstrated`

[#57](https://github.com/sleepy-panda-works/portulan/pull/57) merged as `6b6f591` — the floor backend,
the per-host matrix, `doctor`'s degradation report, and task `0007`. This change closes the row on a
fresh-context verdict, and carries the two non-gating fixes that verdict named.

## What the close checkpoint actually did

**CLOSE**, and it earned the word by re-measuring rather than replaying. It ran the suite at both ends
independently — 255 at `9e5f285`, 309 at `6b6f591`, matching the row — ran all six recipes, and then
**forced each clause red before believing any green**: a tier flipped without recompiling, both artifacts
hand-tampered (the ruleset's `strict` among them), a `floor` deleted over a surviving ruleset, an unknown
tier, a ghost floor check. Every red was red with the true sentence, and it restored the tree.

It also probed the live host rather than reading about it: the wrapped `bash -c "git push --force …"`
spelling returned `ask` carrying the policy's own sentence, a `docs/vision.md` write returned `deny`, and
`git status` got silence.

**And it ran the demonstration session 1 could not.** The Stop-gate's handoff branch cannot fire in this
tree on a day when any session has already written a dated handoff — session 1 said so in the observation
table rather than counting the branch as covered. The checkpoint built an isolated clone where that
constraint does not apply and ran it: recipe green throughout, blocked `handoff 1/3 → 3/3`, released on
the fourth naming **its own cap of three** rather than the ceiling of nine — which is precisely the
asymmetry task `0007` existed to remove. So every acceptance criterion in that task now has a live
observation behind it, and the hardest one was observed by a fresh context rather than by the session
that wanted it to pass. `compile/README.md` and the task file are updated accordingly.

**It looked for a ninth fail-open where session 1's pattern pointed** — the orphan-ruleset check, the
no-artifact backend path, `doctor`'s guarded `backends()` call, the counter's carry-forward — pushed each
one, and found none. Worth recording as a negative result: eight of these have been found in this
repository, all in scaffolding, and this is the first time the class was hunted deliberately and came back
empty.

## The two touch-ups, fixed here

- **`ca872e8` is unreachable from `main`.** The rebase-merge replayed it as `1d4e9fb`. Both the plan and
  the session-1 handoff cited the original when retracting a false claim it carries — so the retraction
  pointed a reader at a sha `main` does not have. Corrected in both.
- **`core/operating/verification.md` described a cascade the runner does not walk.** *"The recipe resolves
  down the cascade — the workspace sets the default, a repo card overrides it, a task may specialize"* is
  the contract; the milestone-4 runner reads the **workspace default only**. Every workspace-layer carrier
  stated the real scope, and core did not. Now it names milestone 7, where the CLI brings the rest — which
  is what `dod.md` condition 4 asks of any sentence describing enforcement.

## What milestone 4 leaves undemonstrated, said plainly

- **No import of the exported ruleset has been attempted.** Importing is a settings change: Gated. The
  envelope and the omitted server-only fields were read from live rulesets; the `pull_request` and
  `required_status_checks` parameter blocks come from GitHub's documented schema. Acceptance by the
  importer is inferred from those two, not shown.
- **Exported-versus-live drift is checked by nothing automatic**, by the row's own ruling. It was compared
  by hand at this checkpoint and agrees on every comparable field. It will go stale silently.
- **The session-0 push demo stands on its record.** Its artifact is byte-identical through five review
  rounds, and the plain-push rule it exercised has since moved to Auto by the maintainer's ruling — the
  two spellings that stayed Gated were probed live at this checkpoint instead.

## What is next

Milestone 5 — memory lifecycle and the librarian. It starts from a measured store rather than owing the
measuring: `doctor` reports count, size and every record naming no retirement condition, and the M5 row
was sharpened on 2026-07-27 so the index budget is a rail whose breach goes red, demonstrated red→green by
**consolidation** rather than by a budget edit.
