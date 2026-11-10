# Reconcile the librarian draft carrier

**Lane:** full · **Opened:** 2026-11-10 · **Status:** approved for PR

**Goal.** Resolve [#627](https://github.com/sleepy-panda-srl/portulan/issues/627), M12 closure finding 6.

**Acceptance criteria.**

- When proposal 0036 describes delivery, a dated qualification shall cite the later accepted #508
  report carrier and distinguish report-only delivery from a derived-file PR.
- When read, the qualification shall retain the original accepted wording as history and preserve
  the human decision/application boundary, citing the existing contract and workflow.
- When this item is complete, report #483 shall remain closed and M12 shall remain in progress
  pending fresh independent closure review; workflow and product behavior shall be unchanged.

**Session-open.** Independent GPT-6 Astra Extra High returned APPROVE. It verified the later
maintainer-authored #508 and its completed state, the report carrier and workflow predicates, and
the existing tier-matrix correction. The three-file plan annotates accepted history without claiming
a new ruling or changing the proposal's decision. A report-only draft carries no automatic adoption.

**Verification.** All 32 yielded recipes pass on Node 22.23.4, with 3,769 tests and zero skips.
Both strict plugin validations pass. The first test run caught an abbreviated heading anchor, now
corrected to the actual contract heading. Two subsequent timed failures coincided with an approximately
298-second pause; a process-scoped keep-awake run passed the complete suite in about 52 seconds.
No test or limit changed. Source comments remain 261,233/261,520 B, with zero historical lines and
fixed prompt caps unchanged. The independent pre-commit on 2026-11-10 returned APPROVE-WITH-ADJUSTMENTS on staged tree
`f7e9a3b420eff0ddb76460780bf27b90321d83e2`: all 32 recipes, both strict plugin validators and all
3,769 tests passed independently, with zero skips. The private seam passed on full staged and
outward surfaces. Its sole adjustment records this verdict in the task. A separate fresh post-merge
M12 closure review remains owed.
Existing librarian controls retain the report-only and curated-guidance boundary. M12 stays open.
