# Bound handoffs and their index window

**Lane:** full · **Opened:** 2026-11-09 · **Status:** verified

**Acceptance criteria.**

- When an after-cutoff handoff exceeds its declared token cap, index shall return red; compression
  alone shall return it green under unchanged settings, while historical overages stay notes.
- When the series grows, its complete generated index shall fit the declared token budget and retain
  a contiguous newest-first prefix, naming the omitted count and source directory.
- When a series exists without an index, index shall validate its dates without requiring H1 headings.
- When either budget is accepted in init, it shall require the supplied ratio, opt into spec 2.14 and
  compute the cap cutoff at write time; declining shall introduce neither budgets nor ratio.

**Criterion.** [#512](https://github.com/sleepy-panda-srl/portulan/issues/512), row 12 demonstration 4,
and accepted [0037](../proposals/0037-a-handoff-is-budgeted-where-it-is-written.md): compression alone
returns a bound handoff from red to green; the whole index holds its token budget as the series grows.

**Plan.** Add optional 2.14 cap/cutoff and index-token keys, checked independently by direct index calls
and doctor. Read dates whenever a series is declared; require an H1 only to render an index. Generate
a contiguous newest-first window, accounting for all output bytes. Report the series without a tree,
and offer independently optional budgets in init with a supplied ratio and a write-time cutoff.
Update doctrine, templates and capability claims; preserve full-series output without a budget.
The repository's 3000/3000 adoption waits for a measured ratio; no calibration is invented.

**Session-open.** Codex, fresh context, 2026-11-09: APPROVE-WITH-ADJUSTMENTS. Folded: (1) no-index
date/H1 boundary; (2) complete contiguous window accounting and edge cases; (3) direct validation and
tree-free report; (4) independent offers, no invented calibration; (5) stale generated claims and
plugin validation. The user's one-PR-per-item instruction supersedes 0037's six-PR sequence.

**Verification plan.** First run the new behavior tests red; then test cap, cutoff, dates, malformed
settings, Unicode and long entries, empty/overhead-only windows and omission digit changes. Run the
actual index CLI red→compression→green and grow the series under unchanged settings. Run every yielded
recipe, strict plugin validation, private seam scan and a fresh pre-commit checkpoint before finish.
Row 12 stays open pending the later independent milestone review.

**Demonstration.** `node --test --test-name-pattern 'actual index CLI' cli/handoff-budget.test.mjs`
invokes the real index CLI: a handoff dated after the cutoff exits 1; compression alone returns exit 0;
the window remains within its 230-token budget at 2, 10, 100 and 106 handoffs. The test byte-compares the
manifest before and after, so neither budget nor cutoff moves. The fixture ratio is 2 bytes/token with
fixture provenance, not a host calibration. Header, footer, separators and trailing newline count.
Separate tests cover 105 growth steps, Unicode, multiple breaches and corrections, historical records,
missing/invalid/future dates without an index, malformed settings and independently accepted init offers.
The initial nine behavior tests ran red before implementation; direct index and existing index tests
subsequently passed together.

**Pre-commit.** Independent fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE. All 32 yielded
recipes were independently green, including 3599/3599 tests with no skips. Three stale generated/index/
librarian claims and one test host-isolation seam were corrected and the final delta graded.
Strict plugin validation passed with the existing missing-icon warning; the private seam scan was clean.
Independent actual-CLI fixtures held an unchanged manifest through cap red→compression green and 111
growth steps, with the whole index at most 242/250 fixture tokens. Fixture ratios prove no calibration.
Own-workspace calibrated 3000/3000 adoption and host-specific loading remain undemonstrated. The cutoff
day stays exempt; cutoff advancement, no-raise/backdating and preserving each decision's why remain
review duties. Row 12 remains open. Signed: independent fresh-context Sleepy Panda Codex checkpoint.

**Main integration.** Fresh-context Sleepy Panda Codex: APPROVE, 2026-11-09. The concurrent init spend
offer is preserved with handoff and cache settings; joint acceptance chooses spec 2.14. All 32 recipes
were independently green across the full run and targeted repair rechecks; 3612/3612 full tests and
165/165 affected tests passed without skips. Eighty independent flag/interview combinations and four
disposable mutations exercised composition. Scoped comments were reduced to fit the unchanged rail;
pointer handoff refusal now gives its policy rationale. Strict plugin validation retains the existing
missing-icon warning; all 125 packed files match staged blobs. The original calibration, host-loading,
cutoff-day and history-rule limits above still bind. Row 12 stays open. Signed: independent fresh-context
Sleepy Panda Codex checkpoint.
