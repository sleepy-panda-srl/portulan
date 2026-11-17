# Task 0061 — advisory record policy and active work

**Lane:** full · **Opened:** 2026-11-17 · **Status:** implemented; review pending

Addresses [#575](https://github.com/sleepy-panda-srl/portulan/issues/575). The restart
estimates from #503 and #505 remain in force. This task closes no roadmap row.

**Acceptance criteria.**

- When the governing manifest omits `slots.handoffs`, the advisory shall omit
  handoff wording; when declared, both compiler paths shall pass that policy
  explicitly and preserve repeat compilation and removal drift detection.
- When a hook supplies nonempty `background_tasks`, the advisory shall remain
  silent without consuming its prompt/tool or Stop marker, then deliver when idle.
- When inventory is absent or malformed, restart advice shall remain conditional
  on collecting delegated work and results; documentation shall distinguish the
  Stop inventory from prompt/tool hooks' unknown inventory.
- When `--handoffs` accompanies malformed estimates, Stop shall remain fail-open;
  child agents, compaction generations and existing cost arithmetic shall retain
  their safeguards.

**Plan.** Add red-first behavioral checks, derive policy from the resolved manifest,
propagate it through the formatter and CLI, suppress busy hooks before state work,
and document the host signal's limits. Fresh session-open returned
APPROVE-WITH-ADJUSTMENTS: include managed-settings ownership and provenance,
validate declarations without testing directory existence, preserve numeric flag
parsing, and exercise busy-to-idle delivery on all three hooks. These are folded.

**Verification.** Targeted advisory/compiler checks, every yielded recipe and strict
plugin validation are required before commit, followed by independent adversarial
review, green CI and the authorized merge.
