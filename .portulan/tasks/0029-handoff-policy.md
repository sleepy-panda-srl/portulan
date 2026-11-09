# Task 0029 — the Stop-gate follows the declared handoff policy

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Goal.** Resolve [#505](https://github.com/sleepy-panda-srl/portulan/issues/505):
a workspace that declares no handoff series keeps its recipe and unfinished-work
checks without being told to write a handoff.

**Acceptance criteria.**

- When `slots.handoffs` is absent, uncommitted or unpushed work shall block with
  commit-and-push instructions; a file under an undeclared `handoffs/` shall not
  discharge that obligation. Release and stderr text shall follow the same policy.
- When the slot names a directory, the gate shall use that directory consistently
  for current and previously recorded handoffs, preserving its existing behavior.
- When the selected tree has malformed or unreadable record policy, the gate shall
  return a bounded refusal and still run only the trusted hook-told recipe.
- When a sibling worktree supplies record policy, its recipe shall never execute.
  Existing counters, clearing, bounds and the known `cwd` limitation shall remain.

**Plan.** Add failing tests, read the selected tree's declared series, route both
recording modes through the existing work check and counters, make wording
conditional, update directly contradicted doctrine/spec text, then run focused
tests, independent pre-commit review and every yielded recipe before opening a PR.

**Session-open.** Independent `/root/checkpoint_505_open` returned
APPROVE-WITH-ADJUSTMENTS on 2026-11-09. Honor the existing path contract, including
valid paths outside the workspace; distinguish absence from malformed policy;
prove the recipe trust boundary and all release/wording paths; leave this
repository's own declared handoff requirement and historical criteria unchanged.

**Verify.** `node --test cli/stop-gate.test.mjs`, then every recipe from
`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs`.
No milestone closure or live-host demonstration is claimed.

**Evidence.** All eight new policy regressions failed against the original runner.
The Stop-gate suite passed after the fix; additional trusted-recipe, recipe-only
release and custom-series remote/history controls passed separately.

**Pre-commit findings.** Independent `/root/checkpoint_505_precommit` initially
requested changes despite all 31 recipes passing: escape the declared directory's
glob characters in history lookups, with positive and unrelated-series controls;
make `evolution.md` follow the workspace record policy. The new glob regression
failed before the prefix fix. Both findings are addressed for re-review.

**Pre-commit approval.** The same independent reviewer returned APPROVE after
rechecking the revised diff on 2026-11-09: 31/31 yielded recipes exited zero,
3,443 tests passed, and additional path/counter/trust probes passed. Removing the
prefix escaping in scratch made the shipped regression fail. Final seam scan,
the finishing command and GitHub checks follow this approval.

**Integration approval.** After #591, #593 and #592 merged, the same independent
reviewer returned APPROVE on the resolved integration on 2026-11-09. All 31 recipes
exited zero and 3,455 tests passed. Eleven combined adversarial checks proved
unknown-state count preservation in absent/custom-series modes, literal custom
paths, bounded remote lookup, older-date leniency and malformed-policy bounds.
Removing the date bound or clearing unknown-state counts each caused two failures
in isolated controls. Product bytes and staged blobs remained unchanged during
review. The user authorized merging reviewed PRs after feedback is applied.
