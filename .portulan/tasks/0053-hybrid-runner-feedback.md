# Hybrid runner feedback

**Lane:** full. Selected priorities from [milestone 17](https://github.com/sleepy-panda-srl/portulan/milestone/17):
[#573](https://github.com/sleepy-panda-srl/portulan/issues/573),
[#582](https://github.com/sleepy-panda-srl/portulan/issues/582), and
[#572](https://github.com/sleepy-panda-srl/portulan/issues/572). The milestone has no complete priority ranking.

**Acceptance criteria.**

- When a generation exhausts its budget, the runner shall preserve a private raw response
  diagnostic and restore the target without verification or acceptance.
- When a caller selects a positive safe output budget, chat/summarize/transform shall propagate
  it and report effective budgets without changing ledger totals or stricter owner caps.
- When progress is requested, phase heartbeats shall arrive before completion and stop on
  completion, error or cancellation; tokens shall remain unknown until final usage.
- When a retried transform succeeds, stderr shall expose each earlier bounded verification
  tail and stdout shall contain only one receipt.
- When a precheck fails red, the runner shall retry without full verification; when it passes,
  full verification shall remain mandatory. Non-green outcomes shall restore original bytes.
- When these controls are used, help, README and delegation guidance shall describe their limits.

**Session-open.** Independent `runner_open`, 2026-11-17: APPROVE-WITH-ADJUSTMENTS.
Folded conditions: validate CLI/API budgets before work and preserve ledger compatibility;
keep raw diagnostics private and separate from metadata-only lifecycle records; describe nonstream
heartbeats with unknown tokens; expose every failed tail including expectation misses; keep full
verification authoritative after a green precheck; grade and push each coherent checkpoint before
the next. No routing/profile change, real-model measurement or milestone close is claimed.

**Checkpoint order.** Generation diagnostics/progress (#573), retry feedback (#582), precheck (#572).
Each receives red-first tests, all yielded recipes, independent pre-commit review and a remote checkpoint.
