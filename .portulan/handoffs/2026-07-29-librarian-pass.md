# Handoff — the librarian's scheduled pass

**Date:** 2026-07-29 · **Scheduled librarian pass** · Filed by `cli/librarian.mjs` on a cron.

**State.** Every figure below is **as of 2026-07-29**, read from git history rather than from the
filesystem, and nothing here is a decision. This pass drafts; the maintainer disposes.

## portulan

**Store.** 24 records, 22 rules, 91.8 KB. Index: current.

**Handoff series.** 36 handoffs, 348.3 KB, oldest `2026-07-25-agent-bot-identity.md` at 4 days. Index: current. No threshold reaches this series and no demotion is drafted against it: it is append-only, so the only repair a staleness draft could recommend is deleting the record the series exists to keep.

**Staleness.** Nothing is stale: no record has gone untouched for 90 days. The oldest is `a-checker-must-refuse-what-it-cannot-check.md` at 4 days.

**Sealed stamps.** None in this store — every rule links its incident, so retirement here can rest on evidence rather than on asking. Reported at zero rather than omitted: *nothing to nag* and *did not look* must not print the same way.

**Proposals.** 15 filed, 5 still waiting on the human gate, none past 30 days.

**Demotion drafts.** None. A draft is written for a record old enough to be worth re-reading, and no record here is.

**Mining — incidents.** 36 incidents in the series; 10 have something in the curated layer pointing back at them, 26 do not. Candidates below are those of the newest date in the series, there being no earlier pass to measure from. The claim is the narrow one: nothing here says an incident taught no rule, only that no rule or proposal points back to it — and a rule whose incident cannot be traced can never be retired on evidence.

  - `2026-07-29-the-librarian-mines-and-consolidates.md` — 2026-07-29. Read it. If it taught a rule, run the `codify` skill; if it already did, add the link — a rule whose incident cannot be traced can never be retired on evidence.

**Mining — pull-request reviews.** 388 inline comments: 195 open a thread and are findings, 193 are replies and are not. 23 paths still in the tree have drawn findings on two or more distinct pull requests. 1 other did and no longer exists, so they are dropped rather than nagged about forever. Two is what *recurring* means rather than a number anyone chose. **Inline comments only** — the low-confidence notes collapsed into a review body carry no path and cannot be seen from here, and that is the larger channel.

  - `docs/plan.md` — findings on 14 pull requests
  - `cli/compile.mjs` — findings on 6 pull requests
  - `.portulan/gate-map.md` — findings on 5 pull requests
  - `.github/workflows/verify.yml` — findings on 4 pull requests
  - `cli/doctor.mjs` — findings on 4 pull requests
  - `.portulan/verify/docs.sh` — findings on 3 pull requests
  - `.portulan/verify/README.md` — findings on 3 pull requests
  - `.github/workflows/copilot-review.yml` — findings on 2 pull requests
  - `.github/workflows/librarian.yml` — findings on 2 pull requests
  - `.portulan/handoffs/2026-07-25-ci-runs-declared-recipes.md` — findings on 2 pull requests
  - `.portulan/memory/a-stated-enforcer-must-be-the-real-one.md` — findings on 2 pull requests
  - `.portulan/repos/portulan.md` — findings on 2 pull requests
  - `.portulan/verify/doctor.sh` — findings on 2 pull requests
  - `.portulan/verify/tests.sh` — findings on 2 pull requests
  - `cli/compile.test.mjs` — findings on 2 pull requests
  - `cli/index.mjs` — findings on 2 pull requests
  - `cli/librarian.mjs` — findings on 2 pull requests
  - `cli/plugin-lint.mjs` — findings on 2 pull requests
  - `cli/README.md` — findings on 2 pull requests
  - `core/engine.md` — findings on 2 pull requests
  - `core/templates/handoff.md` — findings on 2 pull requests
  - `docs/vision.md` — findings on 2 pull requests
  - `spec/workspace.schema.json` — findings on 2 pull requests

**Consolidation.** Store: 91.8 of 120 KB (76%). Index: 30 of 40 lines (75%). Reported as a distance rather than a verdict: the `index` recipe already answers over or under at pull-request time, and what it cannot say is how close.

  - 3 groups of records citing one incident — a question, not a verdict:

    - `../handoffs/2026-07-27-dependabot-security-and-the-watchers.md` ← `a-mechanical-revert-is-not-a-narrative-revert.md`, `a-stated-enforcer-must-be-the-real-one.md`
      Are these one mechanism, or several lessons from one incident? Only the first is a merge — and a merge carries BOTH parents' provenance and both retirement conditions.
    - `../handoffs/2026-07-27-nothing-merges-behind-main.md` ← `a-branch-syncs-with-main-before-it-merges.md`, `every-pull-request-carries-a-label.md`
      Are these one mechanism, or several lessons from one incident? Only the first is a merge — and a merge carries BOTH parents' provenance and both retirement conditions.
    - `../handoffs/2026-07-27-the-enforcement-compiler.md` ← `a-doctrine-promise-belongs-in-the-row-it-names.md`, `a-plugin-payload-can-enforce-on-strangers.md`, `two-layers-need-two-jobs.md`
      Are these one mechanism, or several lessons from one incident? Only the first is a merge — and a merge carries BOTH parents' provenance and both retirement conditions.

  Steps 3 and 4 of `core/skills/consolidate/SKILL.md` — surfacing contradictions and compressing what survives — are **not automated here, and are not silently skipped**. Both need a reading of what two records mean, and a pass that guessed would be making the policy decision step 3 exists to forbid.

## rooftop

**Store.** 4 records, 3 rules, 7.6 KB. Index: current.

**Handoff series.** This workspace declares no `slots.handoffs` — not asked.

**Staleness.** Nothing is stale: no record has gone untouched for 180 days. The oldest is `fieldnotes-ships-on-merge.md` at 4 days.

**Sealed stamps.** 1 sealed rule of 3. None is past 365 days.

**Proposals.** This workspace declares no `slots.proposals` — not asked.

**Demotion drafts.** None. A draft is written for a record old enough to be worth re-reading, and no record here is.

**Mining — incidents.** No `slots.handoffs` series to mine — not asked.

**Mining — pull-request reviews.** Not asked: no review corpus was supplied, or this workspace declares no `tree` and so makes claims about no repository. *Not asked* is not *none recurring*.

**Consolidation.** Store: 7.6 of 11 KB (69%). Index: 10 of 14 lines (71%). Reported as a distance rather than a verdict: the `index` recipe already answers over or under at pull-request time, and what it cannot say is how close.

  - No two records cite one incident.

  Steps 3 and 4 of `core/skills/consolidate/SKILL.md` — surfacing contradictions and compressing what survives — are **not automated here, and are not silently skipped**. Both need a reading of what two records mean, and a pass that guessed would be making the policy decision step 3 exists to forbid.

**Open questions.** None raised by machinery. Every nag above is addressed to the maintainer,
and none of them is answered by re-running this pass.

**Next action.** Read the nags; merge, close, or act. An unmerged pass is itself a nag.

**Recoverability.** This pass writes this handoff, appends one Session log entry when it is
given a log to append to, and regenerates a memory index only when one had drifted. Nothing
outside the tree is touched. Closing the pull request unopened loses nothing — the next pass
reaches the same conclusions from the same store and says them again.
