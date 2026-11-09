# Task — record the real-session ledger comparison

**Status.** Reviewed with provenance correction; finish and CI precede merge.

**Criterion.** [#519](https://github.com/sleepy-panda-srl/portulan/issues/519),
plan row 13 demonstration 1: record a real-session ledger run with the host's own
totals, the ledger's totals and its stated difference. Row 13 remains open.

**Acceptance criteria.**

- When acquiring the real session, the result, saved transcript and saved host
  summary shall share one full session identity and contain actual usage.
- When retaining the capture publicly, normalization shall preserve every selected
  usage value, order, identity relationship and relevant boundary, while excluding
  messages, account data and original local paths.
- When replayed offline, both comparison vectors, signed differences and the
  printed host-comparison line shall agree with the acquired observation.
- When a capture total or comparison line regresses, a focused check shall fail;
  recipes shall replay only committed metadata and never acquire from the host.

**Plan.** One bounded non-editing model probe, private acquisition evidence,
independent numeric recomputation, normalized replay, the existing ledger recipe
and focused vector/output assertions, documentation and fragment. Full recipe set,
fresh pre-commit, strict validation, seam scan, finish, one PR and refreshed CI.

**Session-open.** Independent `/root/checkpoint_519_open` returned
APPROVE-WITH-ADJUSTMENTS: require successful matching acquisition and stable private
snapshots; preserve all ledger-relevant inputs through explicit normalization;
independently pin both vectors and printed difference; update the recipe and its
exact-call test together. The ordinary request used the existing authenticated
subscription, with no purchase, fallback, settings override or bypass.

**Acquisition revision.** The successful headless request saved usage but no
matching summary. The same independent checkpoint approved one bounded ordinary
resume and local exit, with no new model request, normal hooks and permissions,
and both invocations disclosed. That shutdown saved the matching four totals;
usage records remained unchanged. Saved host and
ledger totals are 2 uncached, 77,208 written, 0 read and 26 output, with zero
difference in each class. The retained raw sources and normalization are private;
the public capture holds only whitelisted metadata and source hashes.

**Limits.** One request in one two-invocation lifecycle demonstrates this pair,
not general ledger accuracy, billing agreement, headless summary persistence,
cache-read accounting or subagent/dedup behavior on real sessions. Public replay
holds the recorded bytes and comparison; acquisition fidelity is an independent
checkpoint judgement against the private originals.

**Pre-commit.** Independent `/root/checkpoint_519_precommit` returned
APPROVE-WITH-ADJUSTMENTS on tree `fe7d3a70`: remove the historic Git-cleanliness
claim, whose chat observation is not reconstructed from the retained files, and
grade this record fold. **Signed acquisition-fidelity verdict: PASS**, Codex Panda,
2026-11-09. Independent reconstruction without executing the normalizer established
full identity, stable snapshots, no new request/tool call, exact retained metadata
and ID/path mapping, independently summed totals and agreement with actual CLI
rows and comparison output. All 32 yielded recipes and 3,611 tests passed; focused
ledger tests passed 77/77. Host/ledger-vector, printed-line and usage-replay
mutations forced red, missing capture exited 2 and restoration passed. Strict
validation and the full 12-file seam scan passed with seven refusal controls.
The limits above remain and row 13 stays open. Final fold review, finish and
refreshed CI precede merge.
