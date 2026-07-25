# Handoff — step 1 of the required-check rename

**State.** Done, and **blocked on the maintainer for step 2.** `workspace-verify` is now the job that runs
the recipes; `docs-integrity` remains only as a transitional job that runs nothing and mirrors the other's
verdict, so the context branch protection currently pins keeps reporting. Both report on every pull
request. Nothing about what is enforced changed — only what the enforcing job is called.

**Decisions + why.**

- **The real work moved into the new job, not the old one.** `workspace-verify` carries the recipe loop and
  `docs-integrity` is the thin one. The alternative — keep the logic in `docs-integrity` and add a thin
  `workspace-verify` — reads the same today and makes step 3 a migration instead of a deletion. This way
  the final step is `git rm` of a job block and nothing moves with it.
- **`if: always()` with an explicit result check, not a bare `needs:`.** This is the one thing here worth
  remembering. A job skipped because its dependency failed reports **skipped**, and a skipped required
  check does not block a merge. The obvious spelling — `needs: workspace-verify` and nothing else — would
  therefore have converted a red recipe into a mergeable pull request. That is a fail-open introduced by
  the scaffolding of a change whose whole subject is closing fail-opens, which is the third time in two
  days that this shape has appeared here. It is now guarded and commented in place.
- **The gate map says the name is currently wrong.** Rather than describe the end state as if it had
  arrived, [`../gate-map.md`](../gate-map.md) states that the check is mid-rename, that the gate is sound
  while the name is not, and which step is the maintainer's.

**Open questions.**

1. **Step 2 is yours and nothing proceeds without it.** After this reaches `main` and `workspace-verify`
   has reported there, re-point the required status check from `docs-integrity` to `workspace-verify`. The
   context to pin is exactly `workspace-verify` — the job name, not `workspace verify / workspace-verify`;
   checked against the live repository, where the required context is literally `docs-integrity` and the
   reported check runs carry the bare job names. Step 3 — deleting the transitional job — is a small pull
   request afterwards.
2. **Do not delete the transitional job early.** If it goes before protection moves, the required context
   stops reporting and every pull request becomes unmergeable until the settings change happens. That is
   the failure this sequence exists to avoid, so the order matters more than the speed.
3. **Verified in CI, not only locally.** What this handoff cannot yet claim is a demonstrated *red*: the
   mirror job's failure path has been reasoned about and commented, and it is exercised the first time a
   recipe actually fails on a pull request. Worth watching for rather than assuming.

**Next action.** Maintainer: step 2. Then a pull request for step 3, then `doctor` — which was the point
of doing the rename first, so that `doctor` joins a check whose name already tells the truth.

**Recoverability.** One workflow file plus two documents. Reverting this commit restores a single job under
the pinned context, with no settings change needed in either direction — which is the property that makes
the sequence safe to pause at any step.
