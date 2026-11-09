# Task — Prove the doctor recipe stays outside host usage records

**Goal.** Close the remaining demonstration in [#513](https://github.com/sleepy-panda-srl/portulan/issues/513). Default ledger reporting, the static doctor recipe and its runtime isolation tests already exist; add the dedicated forced-red drill for the static guard.

**Acceptance criteria.**
- When doctor runs normally against fixture records, its existing controls shall show the branch-owned ledger summary; when static mode runs, the filesystem-denial controls shall prove no usage record is consulted.
- When the forced-red sweep removes only `--static` from the doctor recipe, telemetry shall exit 1 and identify the local usage-record reader.
- When that drill runs, it shall execute the source auditor in an isolated worktree, never the altered doctor recipe or live usage-record reader.
- When readers consult the recipe reference, it shall distinguish runtime filesystem proof from the source audit's bounded spelling coverage.

**Plan and verify.** Add a second telemetry drill with one exact source mutation, run the existing usage-report controls and both telemetry drills, then verify the full yielded recipe set and strict plugin validation. Obtain independent pre-commit approval and a clean seam scan before the separate PR. Apply review feedback, wait for green CI, check live merge prerequisites and merge before the next item.

**Constraints.** Full lane. No runtime, recipe, dependency or job added; no milestone close. Host usage records remain outside verification.

**Session-open.** Fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE. The existing filesystem-denial tests prove runtime isolation; the new drill proves the source audit catches removal of static mode. Keep that distinction explicit.

**Baseline.** The existing telemetry drill perturbs a network mode only. Its roster has no doctor-static guard-removal case.

**Evidence.** The seven existing `workspace usage report` tests passed, including default ledger figures and filesystem-denial controls for static mode. The working-copy telemetry sweep ran two isolated drills: both exited 1 with their expected findings, including `invokes cli/doctor.mjs without an immediate --static`. The sweep exited 0 after both rails fired; it did not execute the mutated doctor recipe.

**Pre-commit.** Fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE on staged tree `e729d240bd21fc587b3b3b257730f14897135593`. Independently ran all 31 yielded recipes (3,455 tests, none skipped), strict plugin validation (exit 0; directory icon warning), the seven targeted usage-report controls, and both telemetry drills. Each drill exited 1 with its recorded tell; removing only `--static` identified `cli/doctor.mjs` through the source auditor, without executing the altered doctor recipe. The runtime filesystem-denial controls include a default-path positive control. The seam scan rejected its planted control and was clean across the staged files, branch and proposed message. Undemonstrated: the source audit is bounded spelling coverage, not an execution sandbox; a dynamically constructed module path bypassed it in a source-only probe. No real host usage record was read, and row 13's real-session comparison and other demonstrations remain outside this change.
