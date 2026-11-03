# Task 0020 — allow ten commits behind main

**Lane:** full · **Opened:** 2026-11-03 · **Status:** PREPARED — activation pending

The maintainer requested that the out-of-date merge rule apply once a branch exceeds ten commits
behind its base. His clarification allows 0–10 and requires a sync at 11 or more. This amends proposal 0011;
no milestone status changes.

**Acceptance criteria.**

- When a PR is 0–10 commits behind its base, the freshness check shall pass; when it is 11 or more,
  the check shall fail and require a sync.
- When comparison data is invalid or unavailable and check writes succeed, the head check shall
  fail and the scan shall continue to other PRs; a transport failure shall fail the updater run
  and report which PR could not be judged, with its stale-result limit documented.
- When a PR or `main` changes, the workflow shall refresh all open PRs targeting `main` from current
  exact SHAs, retry movement boundedly, and execute trusted base code rather than a PR's code.
- When an existing gate policy omits the new option, the compiler shall retain strict freshness;
  only gate-policy 2.3 shall accept a boolean `floor.strict`.
- When activating the change, the maintainer shall first approve its PR's merge and the operator
  shall demonstrate the Actions-pinned head checks before disabling native strict freshness.
- When reporting completion, the record shall distinguish prepared code from live settings and
  state the asynchronous event, outage and final-read race limits.

The maintainer clarified the boundary on 2026-11-03: “Up to 10 commits behind main. It should fails if it's behind 11 commits, not 10.” This replaces the initial 0–9 interpretation.

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

The implementation pre-commit checkpoint and its final verification are recorded in the implementation commit.
