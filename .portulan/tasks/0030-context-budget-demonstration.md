# Task 0030 — demonstrate a budget repaired by demotion

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Record [#509](https://github.com/sleepy-panda-srl/portulan/issues/509)
as an offline, reproducible run of the existing compiler, context report and
`doctor`: over budget is red, and demoting guidance returns green without a raise.

**Acceptance criteria.**

- When the invented project's always unit exceeds its declared budget, both real
  context and static-doctor CLI processes shall exit one, with context as the
  doctor's only failing check.
- When the unit moves to `on-read` with its required description, the compiler
  shall remove the old always target and retain the source behind an index line;
  both CLI checks shall exit zero under the same byte-identical manifest.
- When the run repeats, its deterministic observations shall equal the committed
  record. Guidance body bytes shall survive unchanged; invalid repairs shall fail.

**Plan.** Add a synthetic fixture, a workshop-only generator and regression
coverage in the existing context suite. Record the observed statuses and owned
always-tier figures, retain body/manifest digests, and link the evidence from
`docs/milestones/m12.md`. Run every yielded recipe and independent pre-commit
review before finishing one labeled PR. No production behavior changes.

**Session-open.** Independent `/root/checkpoint_509_open` returned
APPROVE-WITH-ADJUSTMENTS on 2026-11-09: add the description required on `on-read`
instead of treating the transition as a tier-only edit; include the required
`calibrated_by` field under an unmistakably synthetic identifier and claim no
calibration; update the spec's stale statement about no budgeted workspace in
this tree. All are included.

**Verify.** `node --test cli/context.test.mjs`, the standalone generator, then all
recipes from `node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs`.
This establishes no exact count, real-host loading, calibration, upgrade result
or milestone completion.

**Evidence.** Actual context/static-doctor processes returned red before demotion
and green afterwards; observations are committed in the fixture rather than
duplicated here. The context suite and invalid-repair controls passed. Changing
the recorded byte figure made the reproduction test fail; it was restored. Body
comparison retains original line endings instead of using normalized parser text.

**Pre-commit.** Independent `/root/checkpoint_509_precommit` returned
APPROVE-WITH-ADJUSTMENTS on 2026-11-09. It reproduced the actual CLI verdicts,
preservation, target transition, record-drift refusal and host/network isolation.
All 31 recipes ran: 30 passed, with 3,433 tests passing, and the comment-byte rail
alone failed. Its required adjustment was to remove the redundant generator
header while retaining the raw-body rationale. That adjustment is applied and
`./.portulan/verify/comments.sh` now exits zero without a rail raise. Final seam
scan and the full finishing command follow this approval.
