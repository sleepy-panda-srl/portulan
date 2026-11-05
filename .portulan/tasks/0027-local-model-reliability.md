# Task 0027 — local-model reliability

**Lane:** full · **Opened:** 2026-11-05 · **Status:** implementation under verification

Issue: https://github.com/sleepy-panda-srl/portulan/issues/564

Owner Marius requested repairs for repeated local-model timeouts and incomplete
work, applicable across hosts/models without changing operator-selected profiles.

**Acceptance criteria.**

- When a default loopback chat response exceeds a five-minute header wait, the
  runner shall retain a finite 15-minute deadline over the entire response and
  a 256-KiB body bound, without following redirects.
- When a caller injects a fetch or explicitly selects an authorized remote endpoint,
  the runner shall preserve that transport; embeddings shall retain their capacity.
- When output is truncated or a fence is unfinished, the runner shall refuse it
  before applying a replacement or running a verifier; valid whitespace and inline
  backticks shall parse correctly, with rollback preserved.
- When a small live local task completes, its independently verified receipt shall
  identify the profile and result without claiming universal completion or savings.

Fresh session-open `/root/qwen_reliability_checkpoint`:
APPROVE-WITH-ADJUSTMENTS. Adopted complete-body/size/abort tests, localhost and
transport-injection compatibility, shared length rejection with legacy response
compatibility, project-owned stricter stop/slice rules, every yielded recipe,
fresh pre-commit and external seam scan. Installed plugin caches remain unchanged.

The source repair does not publish a release or upgrade installed hosts.
