# Revalidate init policy after final confirmation

**Lane:** full · **Opened:** 2026-11-11 · **Status:** verified

**Goal.** Repair [#636](https://github.com/sleepy-panda-srl/portulan/issues/636), the first blocker
from M12's independent post-merge review. The cutoff eligibility defect is a separate change.

**Acceptance criteria.**

- When an operator accepts an always cap, init shall remeasure the exact accepted declaration
  against current and prospective project guidance in both supported formats after final consent.
  An overage or newly unavailable measurement shall refuse before writing; no cap rises silently.
- When confirmation spans a change to the effective handoff cutoff, init shall refuse without
  writes. A retry shall display and write the current cutoff, including when the always offer was
  declined or unavailable. A clock change leaving the effective policy unchanged shall permit writing.
- When an append source changes, its original bytes or absence shall remain the comparison baseline.
  Cancellation and EOF preserve the target; stable inputs and changes within accepted headroom remain
  usable. Pointer, unattended and no-default contracts remain.

**Session-open.** Independent GPT-6 Astra Extra High returned APPROVE-WITH-ADJUSTMENTS on `e93ab684`.
All four adjustments are incorporated: compare effective handoff consent, measure the fixed accepted
scalar with all four host/state combinations, preserve the append baseline, and independently measure
the target at each mutation prompt. Tests exercise initially unavailable versus newly unavailable
offers, cancellation, UTC rollover, newer records, compiler-only imports and before-only sources.

**Verify.** Red-first controls in `cli/init-budget.test.mjs`; real terminal arrival, cancellation
and successful retry; all yielded recipes through normal finish; focused Node 20/22/26 checks,
strict plugin roots, private publication scan and a fresh pre-commit checkpoint.

**Limits.** The final preflight is synchronous after the awaited questions. It does not make the
filesystem transactional against concurrent writers or provide crash rollback. M12 remains open.

**Implementation evidence.** Before repair, 16 of 22 new confirmation cases failed and six retained
positive cases passed. After repair, all 255 focused init, budget and handoff checks pass on Node
22.23.4 with zero skips. The real terminal refuses late 48,000-byte guidance without creating a
workspace, preserves cancellation, then offers and writes 12,000 tokens on a successful retry.
The cutoff controls cover valid next-day records and UTC rollover with accepted, declined and
unavailable always offers; window-only and unchanged effective cutoffs remain usable. Append controls
preserve edits and distinguish an absent ignore file from a newly created empty one.

**Pre-commit repair.** The first independent pre-commit returned REQUEST-CHANGES on staged tree
`d499613405bde53316b195b6c7eae191ea23ee0f`. Although all 32 recipes, 4,475 tests, the focused runtime
matrix, strict validators and seven red/restoration mutations passed, a real terminal control exposed
a newly unavailable compiler state: a migration journal arriving during confirmation. The scratch
compiler could not see that root marker. Five retained cases first reproduced the failure, then the
entry guard was repeated after the interview. The repair preserves the pending journal's bytes and
mode on accepted, declined and unavailable offer paths.

**Final pre-commit.** Independent GPT-6 Astra Extra High returned APPROVE, without adjustments,
on staged tree `da1d89cfe33469b7a99a9dcd6465dd7fee348f32`. All 32 recipes passed, including
4,480 tests with zero skips; the 260 focused tests passed independently on Node 20.20.2, 22.23.4
and 26.13.0. Both strict plugin roots and both nine-surface private publication scans passed.
Six journal terminal cases preserved the target, six retries passed static doctor and index,
and removing/restoring the final guard made all five retained regressions red/green. Renewed
cutoff, alias, manifest-import, cancellation and EOF controls passed. The reviewer explicitly
released the source freeze and authorized recording this verdict before normal finish.
