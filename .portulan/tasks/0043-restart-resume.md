# Task — price a restart before advising it

**Criterion.** [#503](https://github.com/sleepy-panda-srl/portulan/issues/503),
accepted proposal 0038 and plan row 13. The bounded-run comparison must include
the cost of recovering the task and disclose its remaining-request assumption.

**Acceptance criteria.**

- When a resume expense is declared, every restart comparison shall include it
  in uncached-input-token equivalents, excluding the existing fresh-context write
  and baseline reads; explicit zero shall differ from an unknown expense.
- When the horizon or resume expense is undeclared, hooks shall report their
  assumptions conditionally and shall never hold a Stop.
- When both estimates are explicit, a declared block shall hold once only on
  finite, strictly positive estimated savings, never at equality or overflow.
- When compiling a declaration, every advisory command shall receive the same
  figures; invalid or unsupported declarations shall preserve existing artifacts.
- When reporting the biggest lever, doctor shall subtract priced resume expense
  and shall not rank an unpriced restart as a quantified saving.

**Plan.** Red-first regression controls; optional spec 2.16 resume estimate;
shared ledger arithmetic and validation; compiler propagation; conditional hook,
status and ledger reports; sibling doctor and session-report repairs; current
contract documentation and fragment. No task resolver, predictor or init question.
All yielded recipes, strict plugin validation, seam scan, independent pre-commit,
then finish and one labeled PR. Row 13 remains open pending #520.

**Session-open.** Independent `/root/checkpoint_503_open` returned
APPROVE-WITH-ADJUSTMENTS on 2026-11-10. All seven adjustments are incorporated:
compact scope; weighted cost units; explicit horizon and resume for holds;
unrounded finite profitability; assumptions on all surfaces; sibling claims;
propagation/refusal and red controls. A horizon means requests remaining and does
not decrement automatically. For example, 2,000 handoff output tokens at 5× cost
contribute 10,000 input-equivalent tokens to the additional resume expense.

**Limits.** Estimates are supplied by the caller, not measured or predicted by
the advisory. An unknown resume cost yields only a lower-bound threshold. Existing
block declarations without both estimates degrade to conditional reports.

**Pre-commit.** Independent `/root/checkpoint_503_precommit` returned
APPROVE-WITH-ADJUSTMENTS on tree `a6332f3d9fe37ccf6a1d1303b14551a9e8edd86e`:
bound resume declaration versions to the shipped schema and guard floating-point
equality, preserving positive fractional estimates across hooks, status and doctor.
All 32 yielded recipes and 3,651 tests independently passed; six temporary
mutations forced the relevant controls red. Strict plugin validation exited 0
with existing directory-only icon and untracked system-file warnings. Both
adjustments are folded with focused controls; a review of this fold precedes commit.
Real-host execution of newly compiled declarations and estimate accuracy remain
undemonstrated. The private seam scan is the implementer's separate obligation.
