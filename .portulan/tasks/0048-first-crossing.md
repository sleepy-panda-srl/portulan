# Recover the first recorded restart crossing

**Criterion.** [#630](https://github.com/sleepy-panda-srl/portulan/issues/630),
gap 1 of the M13 closure review on `9061693`, plan row 13 demonstration 2.

**Acceptance criteria.**

- When a hook receives multiple newly completed requests, the advisory shall
  retain and identify the first usable crossing in the current compaction generation.
- When a later request is below its comparison threshold, the report shall
  distinguish historical crossing from current advice and shall not hold Stop;
  status shall remain current.
- When declared assumptions change, the advisory shall replay the history;
  warm and cold reads shall agree.
- When records are partial, duplicated or sidechains, or the transcript is
  compacted or replaced, the advisory shall preserve its existing safety bounds.

**Plan.** Keep a numeric first-crossing snapshot in the advisory's incremental
cache, version and validate that cache, and replay on changed price/horizon/resume
inputs. Preserve the shared ledger figures contract. Add paired decreasing,
sustained and equality batch controls, plus restoration and interleaving cases.
Record an actual installed-host request/transcript/hook trace against an isolated
loopback stub backend. Its messages and usage are synthetic; observed lifecycle
timing is specific to that host and run. Outbound network is denied except the
stub, with positive/negative isolation probes. No provider request or existing
sign-in is used. Retain source hashes and raw evidence; verify it offline without
launching a host. Update current contracts and footprint profiles within existing
caps, run all yielded recipes and strict validation, obtain independent
pre-commit/fold verdicts, seam-scan, finish and open one PR.

**Session-open.** Independent `gap1_open` returned APPROVE-WITH-ADJUSTMENTS on
2026-11-11: assert crossing identity and equality, bind original comparison inputs
and replay changed assumptions, correlate live host message IDs and hook views,
and cover the retrospective native message without raising rails. These are
incorporated. A controlled host trace does not establish provider usage or a
universal one-request timing guarantee. The other three gaps remain separate work.
