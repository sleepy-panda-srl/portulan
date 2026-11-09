# Task 0037 — on-demand provider token count

**Lane:** full · **Opened:** 2026-11-09 · **Status:** implementing

**Goal.** Resolve [#506](https://github.com/sleepy-panda-srl/portulan/issues/506)
with an explicit provider count beside the offline bytes-per-token estimate.

**Acceptance criteria.**

- When explicitly asked with a model, doctor shall count the measured project
  always-tier representation through Anthropic, including extracted descriptions
  and excluding later-tier bodies, with the same bytes as the submitted corpus.
- When a provider count is reported, it shall identify provider/model, its estimate
  limit, effective ratio and existing scope exclusions, without changing a manifest.
- When arguments, sources, credentials or transport cannot be judged, counting
  shall fail closed with sanitized diagnostics and a bounded request/body timeout.
- When verification runs, defaults shall remain offline and the existing audit
  shall refuse literal count-mode invocations through every supported CLI spelling.

**Human ruling.** On 2026-11-09 Marius chose “Provider count with stated limit”
when told the official Anthropic endpoint returns an estimate that can differ
from actual usage, while #506 asks for a true exact count. This resolves that
criterion for this implementation; actual Claude Code prompt tokens are not claimed.

**Plan.** Extend the existing context carrier and doctor, with an explicit model
and environment-only API key, a fixed HTTPS endpoint, no redirects and no automatic
calibration write. Preserve measured strings, including descriptions rather than
whole skill/command/agent files. Reuse telemetry's recipe audit and test injected
transport only. Qualify current capability claims and annotate historical acceptance.
Run all yielded recipes, private seam and fresh pre-commit review, then one labeled
PR and merge after approval/green CI. Row 12 remains open.

**Session-open.** Independent `/root/checkpoint_506_open` returned
APPROVE-WITH-ADJUSTMENTS. Its four adjustments are included: preserve the measured
representation; extend the existing offline audit across direct/dispatcher/bare
spellings and manifest/shell sources; carry the ruling through current contracts
without inventing a compile-host ID; and pin the documented API/auth pair with
request and stalled-body controls. Fake transport proves the contract, not live
provider integration. Primary API documentation was checked on 2026-11-09.

**Focused evidence.** The feature suite failed before the count exports existed.
Eleven offline tests now cover description-only bodies, disabled descriptions,
imports/scoping, BOM/Unicode/CRLF, default/static isolation, malformed inputs and
counts, sanitized failures, stalled requests/bodies, and literal audit violations
in commands and shell scripts. No provider API key is available in this session,
so live-provider integration remains unverified. No calibration has been written.

**Review repair.** Independent `/root/checkpoint_506_precommit` requested changes
over `c57ce7abf35ce76c6250ac586bbfde4f17dc35dc`: 30 recipes passed and the full
suite exposed the new test's nonstandard host-isolation carrier. That carrier now
matches the established rule without relaxing it. New regressions failed before
repairing continued dispatcher audit calls, unsupported/missing workspace kinds,
and source-value disclosure in count diagnostics. The normalizers now share one
carrier for LF/CRLF continuations. Count preflight checks its governing kind,
context declaration and readable tree; it does not pretend to validate the whole
schema. Provider-source errors are categorized without excerpts, and doctor count
mode summarizes failed validation while the separate static validator retains
its details. A whole-diff independent re-review follows.

**Pre-commit.** Independent `/root/checkpoint_506_precommit` returned
APPROVE-WITH-ADJUSTMENTS over `5dc3eee5c62cda3a4b650e720dda93553e8593d4`:
all 31 recipes and 3,528 tests passed, with the original four findings repaired.
The two bounded adjustments delete escaped newlines rather than inserting spaces,
including inside module/subcommand/flag tokens, and replace throwing negative
fixtures with successful fake responses plus zero-call counters. A new partial-token
regression failed before the normalization repair. Sixteen provider tests now pass.
The fold awaits independent delta review. Live provider integration, complete host
prompt counts and calibration accuracy remain undemonstrated; final finish and CI
follow the fold's approval.

**Main integration.** Concurrent main commit `22c209fe` added doctor's measured
savings report. The rebase preserves its context imports, single usage-read/evidence
path and lever rendering, alongside provider preflight, sanitized validation and
count output. The provider and savings-report suites pass together. Independent
integration verification follows before the rebased head is pushed.
