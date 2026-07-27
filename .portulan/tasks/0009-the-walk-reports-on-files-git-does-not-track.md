# Task — the walk reports on files git does not track

**Goal.** `plugin-lint`'s *undeclared skill* note means something. Today it is drowned by notes about
files that are not part of the repository at all.

**The defect, measured.** The tree walk in `cli/plugin-lint.mjs` skips exactly three directories —
`.git`, `node_modules`, `.claude-plugin` (`SKIP_DIRS`, line 81) — and **nothing consults `.gitignore`**.
`.gitignore` line 35 ignores `/.claude/*`, under which every local worktree lives, each a full copy of
the repository. So each worktree contributes a complete set of false *is not covered by any declared
skills path* notes.

Measured in the maintainer's checkout on 2026-07-27: **72 notes, all 72** from `.claude/worktrees/`.
The number is not the finding — it moves with the worktree count and a fresh clone shows none. The
finding is that **the one real note a user needs is unfindable among them**, and this is the checker
that a person authoring their first skill will meet.

**Acceptance criteria.**

- [ ] When a path is ignored by git, the walk shall not report on it.
- [ ] When a genuinely undeclared `SKILL.md` exists in tracked (or untracked-but-not-ignored) state, the
      validator shall still note it — the fix must not silence the check it exists to make usable.
- [ ] When git is unavailable or the repository is not a git checkout, the validator shall still run and
      shall say which basis it used. _(`plugin-lint` takes a plugin root that need not be a git
      repository; falling over there would be a worse defect than the one being fixed.)_

**Verify.** A fixture with an ignored directory containing a `SKILL.md` and a tracked one containing
another: **red now** (both noted), green when only the tracked one is. Run by
`.portulan/verify/tests.sh`.

**Constraints.** Do not shell out per file. `.portulan/verify/docs.sh` already establishes the pattern —
`git ls-files --cached --others --exclude-standard`, once, with its **failure treated as exit 2 rather
than an empty list**, because a check that enumerates nothing reports green having checked nothing.

**Context.** Found while planning milestones 6, 7 and 11 on 2026-07-27, alongside
[`0008-a-declared-skills-path-sees-one-level-down.md`](0008-a-declared-skills-path-sees-one-level-down.md).
Both are prerequisites for the authoring surface being pleasant to use.

**Lane.** triage
