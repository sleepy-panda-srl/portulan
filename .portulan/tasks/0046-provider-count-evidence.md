# Record the successful provider count with its accepted limit

**Lane:** full · **Opened:** 2026-11-10 · **Status:** verified

**Goal.** Resolve [#625](https://github.com/sleepy-panda-srl/portulan/issues/625), M12 closure finding 5.

**Acceptance criteria.**

- When read, the record shall distinguish captured UTC/model/corpus/bytes/exit and stdout from
  subsequent provenance checks and command reconstruction.
- When checked offline, its bytes, ratio and original renderer shall agree with the saved observation.
- When the plan names the count mode, it shall carry the accepted provider-estimate limit and retain
  the offline recipe rule.
- When published, the record shall expose no credential or local credential location and adopt no
  production ratio, always cap or conditional handoff policy.
- When this item is complete, M12 shall remain in progress pending its remaining work and review.

**Session-open.** Independent GPT-6 Astra Extra High returned APPROVE-WITH-ADJUSTMENTS. Both adjustments
are included: captured fields stay separate from later revision/fixture reconstruction, and the manual
live example creates a fresh invented fixture, preserves its final LF and requires explicit execution
with an authorized credential. The original receipt did not capture a code SHA or manifest digest.
The supervisor independently reproduced its corpus and exact stdout offline at the subsequently
verified invocation-worktree revision. Neither this documentation change nor its verification makes
a provider request. This records the existing accepted ruling rather than changing the count API.

**Verification.** All 32 yielded recipes pass on Node 22.23.4, with 3,769 tests and zero skips.
Both strict plugin validations pass. Offline readback matches all captured fields against the saved
receipt; the original and current collectors each return its one 126-byte entry, and both renderers
reproduce stdout exactly. The corpus digest and 126/29 ratio also match. The existing task-artifact
check first rejected paragraph criteria; the required bullet structure repaired that failure without
changing the check. Source comments remain 261,233/261,520 B, zero historical lines, with fixed prompt
caps unchanged. The private seam is clean; fresh pre-commit follows before commit. Historical network
execution rests on the saved observation; offline verification cannot replay that event. M12 stays open.


**Pre-commit.** Independent GPT-6 Astra Extra High returned APPROVE-WITH-ADJUSTMENTS on staged tree
`866ccbf90e0db1a4131f5e71d8eeed9bdf8792cd`. It independently passed all 32 recipes and both strict
plugin validations, reproduced the receipt and exact original/current output, and checked the accepted
plan qualification. The prescribed two `&&` guards prevent the manual example from dispatching after
either fixture-preparation failure. Folded-text inert success and failure probes pass. The final seam
is clean across all staged content, diff, branch and proposed commit/PR text. Historical execution
still rests on the saved observation; no live request was repeated. M12 remains in progress.
