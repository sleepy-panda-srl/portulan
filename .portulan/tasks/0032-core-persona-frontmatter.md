# Task 0032 — compile the core personas' declared frontmatter

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Resolve [#507](https://github.com/sleepy-panda-srl/portulan/issues/507):
compile the core personas' declared context fields into committed host bindings,
with the existing compile recipe detecting drift.

**Acceptance criteria.**

- When this compiler compiles its own declared tree, its core persona sources
  shall enter the shared declaration/ownership/binding pipeline, including a
  canonical alias of that tree. A foreign lookalike tree shall retain its bindings.
- When any of model, instruction-floor or cache fields drifts in any core binding,
  the actual compile recipe shall exit one; regeneration shall restore zero.
- When source fields change or disappear, only their owned block shall change;
  malformed or duplicate sources shall refuse before artifacts are written.
- When matrix mode examines stale bindings, it shall report core fields without
  repairing files. Unsupported-host and live-loading limits shall remain explicit.

**Plan.** Declare `model: inherit`, `omitClaudeMd: false` and `cacheLifetime: 5m`
in each core source, with effort undeclared. Select core sources only for this
compiler's own tree, derive their roster, reuse the pack-persona pipeline, and
regenerate existing `agents/` bindings. Add isolated product-copy regressions,
update stale documentation, run every yielded recipe and independent pre-commit
review, seam-scan and finish one labeled PR. The user authorized merging reviewed PRs after feedback is applied.

**Session-open.** Independent `/root/checkpoint_507_open` returned
APPROVE-WITH-ADJUSTMENTS on 2026-11-09: prove alias/foreign-tree and duplicate-owner
boundaries, including a source declaring no fields; independently exercise all
nine role/field drift combinations; prove source/removal byte preservation and
matrix read-only behavior; accurately describe model/force/cache precedence;
scope doctor validation to composed pack sources. All are included.

These are explicit product-role declarations, not compiler defaults or evidence of
quality or savings. `inherit` outranks the ordinary subagent-model environment
default, with invocation and force-setting overrides. No live-host behavior,
new agent-directory support or milestone closure is claimed.

**Focused evidence.** Before implementation, six of seven core-persona regressions
failed; the foreign-tree control passed. With the implementation, all seven pass,
including each of the nine independent binding/field drift-and-repair cycles
through the copied actual compile recipe. The fixture uses canonical scratch
paths so direct Node entry-point detection executes the copied CLI. No host model
is invoked. Independent pre-commit review and all yielded recipes follow.

**Pre-commit finding and repair.** The independent reviewer ran all 31 recipes
green but found that a missing frontmatter delimiter silently became an empty
declaration and could erase a compiled block. The shared declaration parser now
refuses unusable frontmatter for core and pack sources. Four new regressions
failed before this repair; all 57 focused persona tests pass afterward. The new
cases require exit two with byte-identical artifacts in normal, check and matrix
modes. The branch is updated to main after #590's merge; re-review follows.

**Pre-commit approval.** Independent `/root/checkpoint_507_precommit` returned
APPROVE on 2026-11-09 over main `a5724844`, after independently running all 31
yielded recipes green with 3,466 tests and no failures or skips. It verified all
nine actual-recipe drift/repair cycles, alias/foreign boundaries, removal byte
preservation, matrix read-only behavior and duplicate ownership including empty
declarations. Removing the header refusal made all four new regressions fail;
restoring exact bytes made them pass. Private literal/contextual scans, including
a planted-term refusal, passed. Strict plugin validation exited zero with its
existing icon warning. Product and staged bytes remained unchanged. Final finish
and CI follow this approval; live-host loading and model/cache effects, quality
and savings remain undemonstrated.
