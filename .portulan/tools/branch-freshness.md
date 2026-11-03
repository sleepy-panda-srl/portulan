# Activating the ten-commit allowance

The accepted boundary is **0–10 behind passes; 11 or more requires a sync**. The code and compiled
policy in PR [#557](https://github.com/sleepy-panda-srl/portulan/pull/557) are merged. The correction
that reads live `main` merged in [#560](https://github.com/sleepy-panda-srl/portulan/pull/560).
The following sequence completed on 2026-11-03: live native `strict` is false and `branch-freshness`
is required from Actions app 15368. The [activation record](branch-freshness-activation-2026-11-03.md)
contains the evidence. Retain this order for any future reactivation.

1. Obtain the maintainer's approval of the live-main correction and merge it under the current floor.
2. Let the `branch freshness` workflow on `main` refresh all open PRs. It checks out trusted `main`,
   never a PR head, and its write token publishes a check on each exact head.
3. For every existing PR into `main`, read its current `head.sha`, then the check runs on that SHA.
   Confirm `branch-freshness` is completed, comes from GitHub Actions app **15368**, names the exact
   live `branches/main` SHA and PR head SHA in its output, and reports the correct count. Do not
   substitute the PR's stored `base.sha`, which can remain behind the live ref. A same-named workflow job
   on the base SHA is not this evidence. Force a synthetic count of 11 red in the offline test and
   inspect a real head result; do not claim a live merge rejection was attempted.
4. Read live required-status-check protection. Preserve every existing context and app pin, adding
   `branch-freshness` from app 15368. Generate the declared payload from policy with
   `node .portulan/tools/branch-freshness.mjs --activation-payload`, and compare it with that readback
   before using it. If another required context has appeared, retain it and reconcile policy first.
5. Through a supported Panda administration route, PATCH only
   `repos/sleepy-panda-srl/portulan/branches/main/protection/required_status_checks` to `strict: false`
   and the reconciled checks. Read back the full protection, confirming administrator enforcement,
   conversation resolution, review settings, force-push and deletion blocks are unchanged.
6. Record the workflow run, each checked head, app attribution, exact counts and protection readback.
   Only then describe the rule as active. Update the prepared/live statements in the gate map and
   task, and the dated handoff, through the normal review path.

The installed Panda helper now supports an explicit PATCH to this approved repository's
`branches/main/protection/required_status_checks` endpoint, with an ephemeral repository-scoped
Administration token; routine reads and unrelated commands gain no Administration permission.
Its classifier and full dispatch were tested with synthetic credentials. Use that supported route
for the reviewed payload, and retain a full before/after protection snapshot. Do not disable strict
freshness before the corrected head checks are demonstrated.

## Limits after activation

Checks are asynchronous. Event delays, workflow/API outages and base movement after the last read can
leave an older green temporarily applicable. Listing PRs can fail before their checks are invalidated;
a failure to create or update a check can leave its previous result in place. The workflow reports
such failures and continues to the other PRs where it can. It does not provide an atomic merge-time
freshness guarantee or rerun integration tests against the latest base. The agent's immediate exact-SHA
comparison remains the merge precondition. Human merge approval and the other required checks remain
required.
