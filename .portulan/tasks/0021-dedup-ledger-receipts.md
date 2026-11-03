# Task 0021 — dedup receipts in the ledger

**Lane:** full · **Opened:** 2026-11-03 · **Status:** implemented; verification before push

The maintainer asked to apply the review on [PR #556](https://github.com/sleepy-panda-srl/portulan/pull/556).
Its dedup receipt did not match the shared layout read by the ledger merged in #555.

**Acceptance criteria.**

- When dedup completes, its shared `mode=dedup` receipt shall preserve reported input/time and unknown
  output/rate, with file/pair/threshold metadata on a separate stderr line and pair stdout unchanged.
- When the ledger reads `formatDedupReceipt` output, known and missing figures shall round-trip without
  a reader change, and the CLI shall emit exactly one canonical receipt beside its informational line.
- When the hybrid fixture is read, its actual dedup Bash-result line shall add seven input tokens and
  four milliseconds while every host figure and the restart threshold remain unchanged.

## Plan

Merge current main while retaining PR history; update the formatter, generator, generated fixture,
CLI, reader tests, verify recipe expectations and docs together. Run red-before/green-after
regressions, all yielded recipes, independent pre-commit and the private seam scan before pushing
the existing PR branch.

Fresh session-open, Codex, 2026-11-03: **APPROVE-WITH-ADJUSTMENTS**. Folded sibling fixture/recipe
expectations and explicit known/missing figure plus exactly-one-receipt CLI assertions. The targeted
round-trip test first failed with `actual: null`. Final verification and checkpoint are in the commit.
No milestone, rule or ledger-parser change. Thread resolution and PR merge remain maintainer decisions.
