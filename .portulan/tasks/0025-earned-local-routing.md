# Task 0025 — acquire and enforce supported local routing

**Lane:** full · **Opened:** 2026-11-03 · **Status:** implemented; verification before push

The maintainer requested [M14 closure](https://github.com/sleepy-panda-srl/portulan/milestone/16).
The independent close returned REQUEST-CHANGES for [#547](https://github.com/sleepy-panda-srl/portulan/issues/547):
no actual capture, permanent register verification or supported routing. The maintainer authorized
Sonnet 5.5 under a $2–3 total budget and later explicitly authorized a host-only retry after sign-in.

**Acceptance criteria.**

- When the acquired record is verified, the runner shall regrade all 30 turns and reproduce the
  register without model calls; the failed acquisition and recovery provenance shall remain durable.
- When operational defaults or explicit roles select a local chat model, they shall refuse unsupported
  roles, unmeasured model substitutions and unmeasured effort before a socket or file change; explicit
  model-only candidates and evaluation shall remain possible, including packs-only installations.
- When CI verifies the A/B records, it shall retain the old baseline check, check the acquired local
  register, and independently derive the shipped routing flags, models and capture digest. A red or
  could-not-run result shall survive later greens, with exit 2 taking precedence over exit 1.
- When an offline recipe calls the local runner, the audit shall admit only exact --verify-offline or
  eval --verify modes and reject capture/network combinations independently for every invocation.

## Plan and checkpoints

Freeze tasks, models, seed, five-turn acceptance rule and budget before acquisition. Preserve all
local outcomes and authorize any host replacement explicitly. Embed support metadata so packs-only
runtime needs no root capture; keep generic capture verification separate from this repository's
routing-policy verifier. Guard operational paths before I/O, retain historical task roles, and wire
no-model checks beside the existing baseline. Update all capability claims and force the checks red.

Fresh session-open and recovery review, Codex, 2026-11-03: **APPROVE-WITH-ADJUSTMENTS**. Folded immutable
failed evidence, exact-object/no-call recovery proof, explicit host-only retry authorization, and
whole-role gating. Follow-through review required malformed/incomplete record tests, digest/model/flag
mutations, pre-I/O default/role/override refusals, and candidate/packs-only coverage. Independent
acquisition fidelity: **APPROVE**; evidence and limits are in
[the acquisition note](../../evals/ab/local-worker-acquisition.md).

The acquired cells support code and disable shared prose. No milestone DONE claim is made here:
remaining changes must merge before a fresh independent milestone-close pass.
