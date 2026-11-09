# Task — Close the restart block's follow-up points

**Goal.** Address all three optional points in [#494](https://github.com/sleepy-panda-srl/portulan/issues/494), without completing milestone 13 or adding #490's shared version table.

**Acceptance criteria.**
- When `spend.restart` is declared, compile shall require a string `MAJOR.MINOR`, major 2, minor at least 13; unsupported declarations shall exit 2 in write, check and matrix modes, leaving absent artifacts absent and existing artifacts byte-identical. The earlier-minor diagnostic shall remain unchanged.
- When no restart is declared, the new check shall impose no general version gate. A future minor on major 2 shall retain the compiler's current behavior, independently of doctor's stricter version checks.
- When a Stop carries `stop_hook_active: true`, the ledger recipe shall prove it emits nothing and consumes no hold; a subsequent ordinary Stop under that same fresh ID shall still block.
- When a harness omits the retry marker and rotates session IDs, the slot reference and guard comment shall state that repeated holds are possible.

**Plan and verify.** Add compiler regressions first and observe red. Harden only restart's version check; extend the existing ledger payload helper and sequence without adding a dependency. Document the measured residual, update the recipe reference and add one changelog fragment. Force the ledger recipe red by removing the guard in an isolated copy. Run the yielded recipes, strict plugin validation and seam scan, then obtain independent pre-commit approval before commit, push and a labeled PR.

**Constraints.** Full lane. No shared manifest-version redesign, milestone close or merge.

**Session-open.** Fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE-WITH-ADJUSTMENTS. Folded: exact compiler-version boundary, future-minor and no-restart controls, absent and preserved artifacts in all three CLI modes, and recorded guard-removal exit and assertion.

**Evidence.** The new compiler regression failed on the original implementation with a missing expected `CompileError`. The targeted compiler/advisory suite then passed 603 tests. Removing the retry guard in an isolated copy made the updated ledger recipe exit 1, reporting `a provoked stop was held` and that it consumed the next ordinary stop; the intact recipe exited 0.

**Pre-commit.** Fresh-context Sleepy Panda Codex, 2026-11-09: **APPROVE**. Initial verdict: APPROVE-WITH-ADJUSTMENTS on staged tree `4664bb46384238515e923af767fb7462757e78bf`, requiring an EARS-shaped fourth criterion and an unambiguous host-marker sentence. The independently graded fold delta contains exactly those two prose corrections. Approved implementation tree: `03171f0e75055ac4263bd47840dbe903b4203bbd`; this signed checkpoint record is the only subsequent delta.

**Independent verification.** All 31 recipes yielded by the pinned recipe-set command passed, including all 3,432 tests, and `claude plugin validate --strict .` exited 0 with its existing missing-icon warning. In isolated staged-tree copies, 206 CLI invocations checked both restart values, absent and preserved settings/ruleset artifacts in write/check/matrix modes, malformed/missing/other-major declarations, the unchanged earlier-minor diagnostic, future major-2 minors and no-restart controls. The new compiler regression against the original compiler exited 1 with a missing expected `CompileError`; deleting only the retry guard made the ledger recipe exit 1, showing a provoked Stop held and its subsequent ordinary same-ID Stop empty. The intact recipe passed. The seam scan passed across staged files, diff, branch and proposed commit message, with its planted-term control rejected.

**Limits.** The marker contract was checked against the primary [Claude Code Stop-input reference](https://code.claude.com/docs/en/hooks#stop-input). Live-host hook execution remains undemonstrated here. The compiler still accepts future major-2 minors; no doctor parity, shared birth-version table for #490, or milestone close is claimed.

**Identity readback.** The active App and installation are `sleepy-panda-codex`: actions/checks/metadata/statuses read, contents/issues/pull requests/administration write. The installed helper narrows ordinary tokens and requests the broader permissions only for its allowed operations; the legacy repository App table is not evidence of this active identity's permissions. This checkpoint changed no App permission or repository setting.
