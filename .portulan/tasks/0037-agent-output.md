# Task 0037 — Counted agent output

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Criterion.** [#517](https://github.com/sleepy-panda-srl/portulan/issues/517),
row 13: every recipe and doctor offer agent mode with one green line, full failure
and human output, with a rail on the one-line green.

**Acceptance criteria.**

- When recipe-set emits agent commands, it shall wrap every workspace and pack
  recipe through the shared executor, including opaque future commands.
- When a recipe succeeds in that mode, the executor shall return one counted line
  and no stderr; when it fails, it shall preserve complete separate output bytes.
- When execution is interrupted or capture fails, the executor shall clean its
  owned descendants and leave no named temporary logs.
- When doctor validates multiple green directories in agent mode, it shall return
  one aggregate count line; when a later directory fails, earlier reports shall remain.
- When help, quiet or static mode is requested, doctor shall retain its help,
  silence and host-record isolation respectively.

**Plan.** Shared executor and recipe-set interface, one existing CI job, buffered
doctor presentation, required unit/live rails, packaging and documentation. Human
enumeration and direct script output retain their current form. Run the actual
agent recipe set plus all required checks, strict plugin validation, seam scan,
independent pre-commit review and finish one labeled PR. Row 13 remains open.

**Session-open.** Independent `/root/checkpoint_517_open` returned
APPROVE-WITH-ADJUSTMENTS: specify the shared interface, preserve complete streams
past outer tails, test nested cleanup, verify every yielded agent command, and
retain multi-directory/help/quiet/static doctor behavior. All are included.

**Limits.** Full failure output is the executor's boundary; outer finish/Stop
summaries retain their bounds. Normally exiting background jobs and deliberate
process-group escapes retain the runner's existing limits. Native Windows output
and forced-termination filesystem behavior remain undemonstrated.

**Pre-commit.** Independent `/root/checkpoint_517_precommit` returned APPROVE
for the revised 15-file diff. All 31 actual emitted agent commands passed with
exactly one green line and no stderr. After the narrow deadline and group-ID
repairs, all 30 runner/output controls passed; reverting those repairs forced
the new regressions red. Nested timeout, signals and capture failures prevented
late descendant writes and left no named spools. Binary stdout/stderr of 200,003
and 150,007 bytes survived exits 1/2/126/127 exactly. Doctor presentation and
static/quiet behavior passed; extra-line and byte-loss mutations failed. Docs,
payload, staged package identity, strict plugin validation and the seam scan
passed, with seven planted seam controls. The complete agent pass preceded the
guard repairs; affected controls and packaging were rerun afterward. The limits
above remain undemonstrated. Final record-fold review and finish follow.
