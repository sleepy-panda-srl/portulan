# Compile host-reachable persona bindings

**Lane:** full · **Opened:** 2026-11-10 · **Status:** verified

**Goal.** Repair [#619](https://github.com/sleepy-panda-srl/portulan/issues/619), compiler finding 3
from M12's independent closure review. Base is merged main `01ca48872fdceac9d7aa548ac12a5107173f2b31`.

**Acceptance criteria.**

- When a declared tree is a plugin, compiler and doctor shall select `agents/`; when it is ordinary,
  both shall select `.claude/agents/`. A decoy in the other directory shall be ignored. Existing
  bindings shall preserve handwritten bytes, compile all declared fields and detect independent drift.
- When a source/marker/binding is malformed, escaping or nonregular, compilation shall refuse before
  writes; doctor shall distinguish unread and absent bindings and validate the selected name/tools.
  Actual FIFO controls shall terminate without reading the pipe.
- When a valid persona-only project has declared fields and an existing binding, compile/check/matrix
  shall work without emitting gate settings or guidance. Genuinely empty, refused and unreadable input
  shall retain meaningful refusal; missing adopter bindings shall remain optional and uncreated.
- When packaging this product, both core and actually composed charters shall have matching real
  bindings, including fieldless supervisor. Orphans, name mismatches and deletion of any intended
  binding shall fail. Merely having a similarly named uncomposed file shall not establish ownership.
- When checking a clean checkout, committed on-invoke and companion outputs shall exist before any
  generation and match their sources. Independent drift shall return 1 without repair; regeneration
  shall restore bytes. Either workspace's 0/1/2 shall propagate through the repository recipe.

**Plan and session-open.** Independent Astra Extra High: APPROVE-WITH-ADJUSTMENTS, 2026-11-10.
Folded all five groups: shared bounded adapter and pre-read source checks; persona-only entry point;
two-way composed packaging with optional adopter bindings; committed exemplar and exit propagation;
current qualified docs and unchanged budgets. No third plugin manifest is shipped: positive plugin
markers are built only in scratch tests. The branch contains only this repair, based on merged #614/#616/#618. Full recipes, strict validations,
private seam and fresh pre-commit precede normal finish. Row 12 remains in progress.

**Initial evidence.** Ordinary-binding and persona-only controls failed on the unchanged compiler.
The actual composed-owner packaging test failed before that correspondence was extended. The clean
artifact check failed because no tracked output existed; marker BOM and invalid binding UTF-8 controls
also failed before repair. The focused compiler/doctor/packaging suites passed 1,050 checks before
the final FIFO and aggregation additions. Real FIFO bindings and markers now return promptly; invalid
UTF-8 is unread rather than rewritten. The final verification and independent verdict follow.

**Budget correction.** The rail's historical 3,386-byte baseline was not the current measurement:
main's descriptions actually used 3,448 of the unchanged 3,454-byte cap. The two new short descriptions
added 50 bytes and correctly triggered red. The librarian's verbose routing description was shortened;
its full charter and binding body were preserved. No cap is raised. The final measured total follows.

**Pre-commit repair.** The independent first pass returned REQUEST-CHANGES: persona-only matrix
null handling, name/tools preflight, doctor charter type/UTF-8, packaging's first composition reads,
and compiler/doctor authority manifest containment and decoding. Retained tests reproduced each gap.
The repaired readers check actual workspace/pack owners and regular UTF-8 files before interpretation;
invalid authority leaves stale bindings and unrelated outputs unchanged. Canonical named-root aliases
remain supported. Both adapters reject malformed identities before selecting a binding. A shared flat
frontmatter reader retains the existing parser contract; no general YAML parser was introduced.
The original reviewed snapshot is preserved separately; the new pass grades this merged-base tree.

The second pass found three related boundary defects despite green recipes: the repository-root
entry allowed a workspace manifest to leave its directory, packaging opened a redirected pack before
checking its packs root, and an earlier resolver exception bypassed doctor's unread-shadow report.
The repaired workspace reader checks both owner levels for every manifest consumer. Packaging checks
plugin, packs root, nominated pack and manifest before its first data read. Doctor catches the second
resolution arm and preserves its could-not-compare report. Retained controls use both CLI spellings,
check unchanged outputs and actual reads, and exercise the real static doctor under a synthetic host.

**Verification.** All 32 yielded recipes passed on the repaired merged-base tree, including
3,700 tests with zero skips on Node 22.23.4. The 1,063 focused compiler/doctor/packaging checks
passed on Node 20.0.0 and 26.13.0. Both strict plugin validations passed with nonfatal directory
advice. Descriptions measure 3,384/3,454 B. Owned prompt rails measure 38,050/38,811 B skills,
23,001/23,236 B personas, 12,579/12,831 B hooks and 14,270/14,556 B vendor profiles.
Source comments measure 261,151/261,520 B. No cap was raised. Local test sockets and Git index
snapshots require an unrestricted verification process; the sandbox-blocked first run is not counted
as a pass. Third independent pre-commit returned APPROVE-WITH-ADJUSTMENTS on reviewed tree `9faef7b42c7361f64a58b8975179d5f6be7317eb`. Sleepy Panda Codex reproduced the eight earlier findings’ repairs and all 32 green recipes, including 3,700 passing tests. The two adjustments record this verdict and qualify the PR text to declared persona inputs. Compiler finding 3 is verified. Milestone 12 remains open.

**Limits.** File location and byte identity do not prove host enablement, field honoring, cache savings
or local model execution. Supervisor still needs a fresh invocation; the local-worker wrapper directs
local tasks through its existing loopback runner. No runtime model turn is claimed by this repair.
