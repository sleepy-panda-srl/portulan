# Task — Bound recipe process cleanup

**Goal.** Close [#480](https://github.com/sleepy-panda-srl/portulan/issues/480): finish and the Stop-gate must terminate ordinary recipe descendants when a recipe times out or the runner receives a handled interruption.

**Acceptance criteria.**
- When a recipe exceeds its existing time limit, both runners shall terminate its POSIX process group with TERM followed by bounded KILL escalation, including when the shell exits first or ignores TERM.
- When an active recipe receives runner SIGINT, SIGTERM or SIGHUP, the runner shall forward it, retain the interruption through pipe draining and return could-not-run after bounded cleanup.
- When finish observes an interruption, it shall stop before another recipe or push and undo its provisional commit.
- When recipe setup or cleanup fails, the Stop-gate shall report a recipe problem through its existing bounded verdict mechanism.
- When Windows runs a recipe, tree termination shall use a preflighted system taskkill command with a bounded invocation; live Windows behavior shall remain explicitly unverified here.

**Plan and verify.** Share one asynchronous recipe runner without changing either time limit. Preserve output bounds, classification, normal background-process draining and Stop-gate counter/trust policy. Prove late writes are prevented, each handled signal is forwarded, interruption prevents pushing, setup failure blocks, and native Windows command construction is bounded. Run every yielded recipe and strict plugin validation, obtain independent staged-diff review, then use finish and merge the separate PR after feedback and green CI.

**Session-open.** Fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE-WITH-ADJUSTMENTS. Folded: (1) typed interruption survives result normalization and prevents later recipes/push, repeated signals cannot restart grace, only owned listeners are removed; (2) signal receipt and late-write oracles cover all three signals and early-exit/TERM-ignoring leaders; (3) asynchronous setup and termination failures become Stop verdicts, with bounded Windows preflight/termination diagnostics; (4) regenerate the CLI roster and document background, escaped-group and unhandleable-signal limits. No new package dependency or time-limit configuration.

**Baseline.** Both runners signal only Bash; finish can lose an interruption or wait forever for a TERM-ignoring shell. The new behavioral controls are run against the old implementation before the shared runner is added.

**Review correction.** Independent pre-commit review requested changes on tree `f5eb5e3ca76b1ff3269aa34ba73ad83c244c2e0c`: its full run caught SIGINT arriving after Bash became ready but before signal handlers were installed. Install owned listeners before spawning. A delayed-spawn control now makes that startup window deterministic; the corrected tree requires the full review again.

**Review fold.** Full corrected tree `374ca2014b1ea1bccb2d1bc4940c8fd0c3cd2ca4` received APPROVE-WITH-ADJUSTMENTS after independent green recipes and strict validation. The remaining test-only adjustment replaces one repeated interruption with a signal storm until controller exit, so restarting the grace deadline cannot evade the control. The storm stops on exit or a failed send and is cleared again in cleanup.
The storm controller retains its own inert SIGHUP listener after the runner settles, and the parent stops sending once the result marker exists. This isolates cleanup behavior from signals delivered during the test controller's later result write and shutdown; owned-listener restoration is still asserted.

**Pre-commit — APPROVE.** Fresh-context Sleepy Panda Codex supervisor (`review_480`), 2026-11-09. Graded complete implementation tree `374ca2014b1ea1bccb2d1bc4940c8fd0c3cd2ca4`, then the entire staged fold delta through tree `15b92e8b2086ae7f8ec2a5398f97080ed8c23378`. The fold changes only the interruption control and this record; no implementation adjustment remains.

**Independent evidence.** All 31 yielded recipes have green results, and strict plugin validation passed with its existing missing-icon warning. The full tests recipe passed 3,478 tests in 392 suites, with zero skipped, cancelled or todo, on a solo retry after an unrelated two-second fixture startup timeout; that fixture also passed alone. The final fold passed all 10 runner controls, docs, comments and staged whitespace checks. Isolated mutations proved the startup window, shell-only signaling, omitted KILL escalation, lost interruption latch, discarded finish normalization and unbounded taskkill controls red. The original repeated-signal oracle let a restarted grace period pass; the folded storm now rejects it with the four-second bound. Actual asynchronous ENOENT and denied group cleanup both produced bounded Stop-gate recipe-block verdicts. Signal receipt, absence of late writes, owned-listener restoration, finish rollback/no-push and normal background draining were checked. Both existing time limits remain unchanged; no time-limit configuration was added.

**Identity and seam.** Live read-back: active, unsuspended `sleepy-panda-codex` installation 176200934, repository selection `all`; permissions are actions/checks/statuses/metadata read and contents/issues/pull_requests/administration write. The helper's Codex identity check passed without credential output. The staged files, diff, branch and prepared commit message passed the seam scan, whose planted-term control was rejected.

**Undemonstrated.** Native Windows execution; descendants intentionally escaping their POSIX group; cleanup when the OS denies signaling, the runner receives SIGKILL, or failure occurs outside active recipe execution. These are documented limits, not passing claims.
