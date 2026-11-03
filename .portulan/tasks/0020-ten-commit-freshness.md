# Task 0020 — allow ten commits behind main

**Lane:** full · **Opened:** 2026-11-03 · **Status:** COMPLETE — activated 2026-11-03

The maintainer requested that the out-of-date merge rule apply once a branch exceeds ten commits
behind live `main`. His clarification allows 0–10 and requires a sync at 11 or more. This amends proposal 0011;
no milestone status changes.

**Acceptance criteria.**

- When a PR is 0–10 commits behind live `main`, the freshness check shall pass; when it is 11 or more,
  the check shall fail and require a sync.
- When comparison data is invalid or unavailable and check writes succeed, the head check shall
  fail and the scan shall continue to other PRs; a transport failure shall fail the updater run
  and report which PR could not be judged, with its stale-result limit documented.
- When a PR or `main` changes, the workflow shall refresh all open PRs targeting `main` from
  the live `branches/main` SHA and PR head SHA, retry movement boundedly, and execute trusted base code rather than a PR's code.
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

Before activation, live protection was read back: `strict: true`, `workspace-verify` and `pr-labeled` pinned to app
15368, administrators included, conversations required, force pushes and deletion blocked. These non-freshness protections remain
unchanged after activation. GitHub's native strict setting is boolean and cannot express a ten-commit threshold.
The installed Panda helper now supports the exact approved status-check PATCH with a scoped
Administration token; other routine calls retain their prior scopes. No maintainer-identity write
is needed. PR #557 and the approved live-main correction #560 are merged. Actions head checks were
demonstrated before the narrow protection PATCH; full readback confirms `strict: false` and all three
checks required from Actions app 15368. The [activation record](../tools/branch-freshness-activation-2026-11-03.md)
contains dated heads, counts and protection evidence. PR #555 subsequently merged without a branch sync.

Completion is demonstrated by the active replacement check and narrow settings change readback; a
prepared PR alone did not establish the live rule. Eleven-behind rejection was forced offline, not
attempted through a live merge. The asynchronous limits in the activation guide remain applicable.

The implementation pre-commit checkpoint and its final verification are recorded in the implementation commit.

The 2026-11-03 correction reproduces #555's stale stored base SHA: current `main` was three commits
newer while the earlier check reported zero. The updater now reads the live branch ref before each
comparison and again before publishing. The corrective commit records its independent checkpoint.
