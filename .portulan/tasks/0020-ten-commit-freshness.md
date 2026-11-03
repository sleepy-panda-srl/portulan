# Task 0020 — sync a branch once it is ten commits behind

**Lane:** full · **Opened:** 2026-11-03 · **Status:** PLANNED

The maintainer requested that the out-of-date merge rule apply only once a branch is ten commits
behind its base. The boundary is 0–9 allowed, 10 or more requiring a sync. This amends proposal 0011;
no milestone status changes.

**Acceptance criteria.**

- When a PR is 0–9 commits behind its base, the freshness check shall pass; when it is ten or more,
  the check shall fail and require a sync.
- When comparison data is invalid or unavailable, the check shall remain nonpassing for that head
  and the scan shall continue to the other PRs.
- When a PR or `main` changes, the workflow shall refresh all open PRs targeting `main` from current
  exact SHAs, retry movement boundedly, and execute trusted base code rather than a PR's code.
- When an existing gate policy omits the new option, the compiler shall retain strict freshness;
  only gate-policy 2.3 shall accept a boolean `floor.strict`.
- When activating the change, the maintainer shall first approve its PR's merge and the operator
  shall demonstrate the Actions-pinned head checks before disabling native strict freshness.
- When reporting completion, the record shall distinguish prepared code from live settings and
  state the asynchronous event, outage and final-read race limits.

## Plan

1. Record the accepted policy amendment in a proposal before implementation.
2. Add a trusted workflow that refreshes every open PR's exact-head freshness check on PR events and
   pushes to `main`. Never execute a PR's code with its write token. Compare exact base/head SHAs,
   reject missing or malformed counts, retry movement boundedly, and continue after one PR fails.
3. Gate-policy 2.3 permits a boolean `floor.strict`; older policies retain strict checks. Declare
   loose native freshness and the Actions-pinned `branch-freshness` check for this workspace.
4. Update the policy's compiled artifacts and every present-tense carrier of the old rule. Describe
   the asynchronous check's event, outage and final-read race limits beside the merge precondition.
5. Exercise the threshold, failures, movement, pagination and trusted workflow wiring offline. Run
   every yielded recipe, a fresh-context pre-commit checkpoint and the private seam scan.
6. Open the implementation for review. After its specifically approved merge, demonstrate the check
   on every existing PR head before changing live branch protection. Preserve the existing check
   pins, administrator enforcement, conversation resolution and ref protections.

## Checkpoint and activation

Fresh-context session-open, Codex, 2026-11-03: **APPROVE-WITH-ADJUSTMENTS**. Its five adjustments are
the prior proposal, gate-policy 2.3, whole-scan failure handling, honest asynchronous limits, and
separate preparation/activation evidence; all are folded into this plan.

Live protection was read back: `strict: true`, `workspace-verify` and `pr-labeled` pinned to app
15368, administrators included, conversations required, force pushes and deletion blocked. It remains
unchanged. GitHub's native strict setting is boolean and cannot express a ten-commit threshold.
The installed Panda helper currently requests Administration write only for archival, so a supported
bot route for the eventual protection PATCH is still needed. Do not bypass it with maintainer writes.

Completion requires the replacement check active and the narrow settings change read back; a prepared
PR alone does not demonstrate the live rule.
