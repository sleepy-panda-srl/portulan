# Task — Bound handoff lookup and preserve unknown counts

**Goal.** Address both points in [#491](https://github.com/sleepy-panda-srl/portulan/issues/491), without claiming completion of milestone 13.

**Acceptance criteria.**
- When checking a committed handoff, the remote content walk shall stop at UTC midnight two days before its filename date; an older-dated remote commit may therefore leave it counted as this tree's own.
- When Git cannot determine whether work remains, the hook shall preserve the handoff refusal count through that stop, on both the status and revision-walk failure paths.
- When no work remains or this tree holds its own handoff, the hook shall clear that count; cumulative totals and release caps shall retain their behavior.

**Plan and verify.** Add hook-level regression tests first, observe red, then bound the content lookup and return explicit clearing evidence from a tri-state work check. Run the yielded recipe set, strict plugin validation and the seam scan, then obtain independent pre-commit review before committing and opening a labeled PR.

**Constraints.** Full lane. Keep #590's handoff-policy change separate. No milestone-status change or merge.

**Session-open.** Sleepy Panda Codex, fresh context, 2026-11-09: APPROVE-WITH-ADJUSTMENTS. Folded: describe the bounded lookup and demonstrate its older-date leniency; derive the recipe set and include strict host validation and the seam scan.

**Verification.** Four new regressions failed against the original runner; all 71 Stop-gate tests and all 31 yielded recipes passed after the fix (3,435 tests in the full suite). Strict plugin validation exited 0. The staged files, branch and commit message passed the private seam scan with a rejected planted-term control.

**Pre-commit.** Sleepy Panda Codex, fresh context, 2026-11-09: APPROVE-WITH-ADJUSTMENTS on tree `c28cc1fd1209937cc1162974b7371892a464f2ab`. Independently reran all 31 recipes and strict plugin validation; original-runner regressions failed four cases, and five adversarial fixtures passed. Folded: describe the lower date bound precisely and replace external `which` with Bash's `command -v`. Large-history performance and live-host Stop-hook execution remain undemonstrated.

**Fold review.** Sleepy Panda Codex (GPT-6-based Codex; exact runtime model identifier unavailable), fresh non-implementing context, 2026-11-09: APPROVE on tree `ffe1e4d6c118e8d9ffa0568c2a40fe1c16a70078`. Graded the delta from `c28cc1fd1209937cc1162974b7371892a464f2ab`: the two requested edits and their recorded evidence. All five bounded-evidence tests passed with Git, Node and Bash on PATH and no external `which`; the staged-files, diff, branch and commit-message seam scan passed independently with its planted-term control. The earlier undemonstrated limits remain. Only this approval record was added after the graded tree.
