# Keep incomplete cache input unpriced

**Criterion.** [#645](https://github.com/sleepy-panda-srl/portulan/issues/645),
M13 repeat closure's missing-cache-counter finding and the current context contract.

**Acceptance criteria.**

- When any required cache input observation is absent, doctor and advisory paths
  shall decline unsupported comparisons and Stop shall remain unheld.
- When a duplicate supplies the missing observation, the same session shall recover
  pricing; explicit zeros shall remain known and both once files shall be preserved.
- When aggregate writes are absent, both explicit lifetime buckets shall be needed
  for derivation after duplicate maxima; derived sums shall not become ceilings.
- When live input is explicitly partial it shall remain unpriced; null/absent live
  usage and valid input-only math with unknown output shall retain their behavior.
- When old cache6 state appears priced, cache7 shall reread it without resetting
  told/held markers or copying prompt content; complete appends shall stay incremental.

**Opening.** Independent `m13_cache_open` returned APPROVE-WITH-ADJUSTMENTS:
(1) preserve explicit-only aggregate identity and prove the 100/200 bucket-maxima
case; (2) demonstrate same-session zero completion, once markers, behavioral cache6
migration and targeted guard mutants. Folded into the implementation and controls.
The public fixture/price/quality records stay frozen. This is separate from budget
PR644 and policy-free advisory delivery. M13 remains open for merged closure review.
