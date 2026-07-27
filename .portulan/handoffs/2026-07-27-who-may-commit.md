# 2026-07-27 — Who may commit, and the three doors for everyone else

**The ruling.** Marius, 2026-07-27: anyone may clone and view; only team members commit and push. And,
separately and more sharply: **external pull requests are not accepted.** Outside participation is
proposals and feedback — no coding work on the repository without being a team member.

**The posture was verified rather than assumed**, and that is most of the point of this change. *"That's
just GitHub's default for a public repo"* is approximately true and is not a measurement, and the gap
between the two is where a stray collaborator grant lives. Read back on 2026-07-27:

- **one** direct collaborator (`marius-cetanas`, admin) · **no** outside collaborators · **one** org
  member · `default_repository_permission` = **`read`** · one team with access (`maintainers`, `push`,
  one member).
- `main`: no direct pushes · `workspace-verify` **and `pr-labeled`** required · conversation resolution
  required · `strict: true` · `enforce_admins: true` · force-push and deletion blocked.

**Nothing was found that needed revoking.** Recorded precisely that way in
[`memory/who-may-commit-is-verified-not-assumed.md`](../memory/who-may-commit-is-verified-not-assumed.md),
because a check that finds nothing has still been run, and next time the answer is *"verified on this
date"* rather than *"it should be fine"*.

**One reading is newer than the memory that describes it:** `pr-labeled` is **now a required check**. The
build memory still says it is not. Whoever next touches that entry should correct it.

**Two findings that are not access grants**, surfaced by the same read and both repository-settings
changes, so both **Gated** and his:

1. **Private vulnerability reporting is off.** There is no private channel for a security report on a
   public repository. `CONTRIBUTING.md` says so plainly rather than pointing at a button that is not
   there — an early draft of that file *did* point at the button, which is exactly the claims drift this
   repository keeps finding, caught here by checking the API before shipping the sentence.
2. **Secret scanning and push protection are off.** Both are free on public repositories, and push
   protection is the one that would refuse a credential *before* it reached a permanent public history.
   The confidentiality discipline here is currently a per-commit human scan with no platform backstop —
   a mandate with nothing checking it, pointed at the seam.

**The intake channel ships in the same change, deliberately.** `CONTRIBUTING.md` without the forms is a
promise pointing at nothing; the forms without it are a channel with no stated policy. Three forms —
`bug`, `improvement`, `feedback` — with blank issues **off**, because a blank-issue escape hatch makes an
intake vocabulary decorative within a month. The accepted cost: someone whose report fits none of the
three picks the closest, and `feedback.yml` is written loose enough to be that closest for anything. If a
fourth kind keeps arriving under `feedback`, add a fourth form rather than reopening blanks.

**The intake labels are a separate array from the pull-request set, and that is load-bearing.**
`labels.json`'s `labels` is the *pull-request* policy and the workflow reads `.labels[].name` and nothing
else. Folding the three intake labels in would have let a pull request satisfy the at-least-one policy by
being labelled `feedback`, and would have asked an incoming bug report to know whether it is `doctrine`
or `mechanism` — which a reporter cannot know and should not be asked. Two vocabularies, two questions.

**Not done, and it needs his hand:** `improvement` and `feedback` do not exist on GitHub yet. Declaring a
label here does not create it, and until it exists the form cannot apply it. The `gh label create`
commands are in the pull request body, following the precedent set when the five PR labels were created.

**GitHub Discussions is disabled**, so `config.yml` links to none — an entry pointing at a disabled
feature renders as a dead end, and a dead end in the intake path is worse than a shorter menu.

**Seam scan clean** across files, commit message, and branch name.
