# Handoff — CI reads the manifest instead of a hand-maintained list

**State.** Done, in one change stacked on the milestone-2 branch. CI no longer names the verify recipes;
it reads them from [`../workspace.json`](../workspace.json) and runs each. Proposal
[`0004`](../proposals/0004-ci-runs-every-declared-recipe.md) records the rule and, more importantly, the
part that is **not** done: the required check is still called `docs-integrity`, and renaming it is a
sequenced Gated operation that needs the maintainer.

**Decisions + why.**

- **Manifest-driven rather than one-step-per-recipe.** The alternative was a new CI job per recipe, which
  reads better and fails worse: `main` requires exactly one context, so a new job reports without
  blocking, and every future recipe would ship advisory until someone remembered a branch-protection
  change. Reading the manifest inverts the default — declaring a recipe is what enforces it.
- **The rename is deliberately not in this change.** Renaming the job id makes *that pull request*
  unmergeable — `docs-integrity` stops reporting, protection waits for a check that never arrives, and
  `enforce_admins: true` means the merge cannot be forced through. Other pull requests are unaffected;
  they still report the old context. It fails closed, which is safe, and it strands the rename behind the
  very settings change it was trying to sequence. The three-step sequence that works is in the proposal. Worth doing before `doctor` lands,
  because the cost is per-check and there are two today.
- **Zero recipes is a failure, not a pass.** If the manifest cannot be read or declares nothing, the step
  exits 2 rather than reporting a green it did not earn. This is
  [`verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md) applied one level
  up — enumerating the *recipes* is a precondition exactly as enumerating the *tree* is inside each
  recipe. Writing that rule this morning and needing it again this afternoon is the argument for writing
  rules down.
- **`stdin` is `/dev/null` for each recipe.** The recipe list is fed to the loop on stdin, so a recipe
  that read stdin would swallow the rest of the list and the remaining recipes would silently never run —
  a fail-open with no symptom. Caught while writing it, not by a test.

**Verification, run rather than asserted.** The step's shell was extracted and executed locally under
`bash -e`, as GitHub runs it, across every path below — four as first written, four more added after review
found the degenerate-value hole:

| Path | Result |
|---|---|
| both recipes green | exit `0`, both groups rendered |
| one recipe red | exit `1`; the *other* recipe still ran; `::error::` names which failed |
| manifest missing or truncated | exit `2` |
| manifest declares zero recipes | exit `2` |
| **a recipe declares an empty `run`** | exit `2` |
| **whitespace-only `run`** | exit `2` |
| **newline smuggled into `run`** | exit `2` |
| **tab in `id`, or an `id` that is not a slug** | exit `2` |

**The last four were a real fail-open, found in review and not by me.** The first version guarded the
manifest but not the *values inside it*: a recipe with an empty or whitespace-only `run` was silently
skipped by the loop and the check reported green, and a `run` containing a newline ran only its first line
and dropped the rest. Every one of those is schema-valid — `run` carries only `minLength: 1`, and nothing
validates the manifest against the schema until `doctor` anyway. The concrete future failure: `doctor` is
declared in session 2 with a mistyped `run`, and the check stays green while enforcing nothing, which is
exactly the payoff this change claims. Now the emitter validates before it emits, and a line the loop
cannot parse stops the run instead of being skipped.

The first measurement of the failure paths was also wrong — the exit code was read through a pipe, so it
reported `tail`'s status rather than the step's. Re-measured unpiped. Both mistakes are the same shape as
the change's own subject, which is worth noticing rather than tidying away: it is easy to build a gate
that reports success for work it never did, and hard to notice from the inside.

**Open questions.**

1. **The rename, and it needs you.** Step 2 of the sequence in the proposal is a branch-protection change.
   Until then the required check is named for a third of what it does.
2. **Fork exposure is unchanged but unresolved.** CI already ran a script from the PR's own tree, so
   reading the command from the manifest adds no privilege — but neither does it bound anything. It is
   fine while the repository is private and the token is read-only; it needs a real answer before the
   milestone-3 public flip, and it belongs with the milestone-4 runner.
3. **Nothing tests the workflow itself.** It was verified by running it; there is no harness, and the
   local extraction is not the same code path GitHub executes.

**Next action.** Milestone 2, session 2 — `doctor`, the demo workspace, the claims lint. When `doctor`
lands it is added to `verify.recipes` and becomes a required check by declaration alone, which is this
change's first real payoff. Do the rename before or with it.

**Recoverability.** One workflow file, one proposal, one spec paragraph. The workflow change is the only
thing with reach: if the manifest-driven step misbehaves on the runner, reverting this commit restores two
hardcoded steps and the same required context, with no settings change needed either way.
