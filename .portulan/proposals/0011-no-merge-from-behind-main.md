# Proposal 0011 — require a branch to be up to date with `main` before it merges

**Status: ACCEPTED and APPLIED, 2026-07-27.** Written as a proposal awaiting the maintainer, and accepted
before it was finished: *"This rule needs to be set in GitHub too. The PR should be blocked from merging
if it's behind main."* Applied in the same session by an agent on that explicit instruction — which is the
Gated tier working exactly as its header says, the gate being his decision rather than his keystroke
([`../gate-map.md`](../gate-map.md)). Kept as a proposal rather than folded away, on the
[`0009`](0009-a-gate-policy-beside-the-gate-map.md) and [`0010`](0010-prohibited-as-a-fourth-universal-tier.md)
precedent: a setting change with no proposal behind it is a floor nobody can audit.

**Incident.** Marius ruled on 2026-07-27 that a pull request may not merge while it is behind `main`.
The repository at that moment showed why the ruling was not hypothetical: **three open pull requests —
#41, #42, #43 — each exactly one commit behind**, and #43 reported by GitHub as `mergeStateStatus:
CLEAN`, `mergeable: MERGEABLE`. Mergeable on the spot, with a green `workspace-verify` describing a tree
that stopped existing when `8c02c5f` landed. Nothing had gone wrong yet; that is the argument for the
setting now rather than after something does — the same argument, in the same words, that `0001` made.

**Proposed rule.** Into [`../gate-map.md`](../gate-map.md), as a precondition on the Gated merge and as a
row of the platform floor:

> A pull request does not merge while its head is behind `main`. Rebase onto `origin/main`, push with
> `--force-with-lease`, let the checks re-run, then merge.

Recorded as [`../memory/a-branch-syncs-with-main-before-it-merges.md`](../memory/a-branch-syncs-with-main-before-it-merges.md),
which carries the reasoning and the one-command check.

**Enforcement.** One setting: `required_status_checks.strict = true` on `main` — *Require branches to be
up to date before merging* — via `gh api`, since branch protection is not reachable from `gh repo edit`.
The value was `false` when this was written, read from
`repos/{owner}/{repo}/branches/main/protection`; the command as run, and what it returned, are under
**Decision** below.

What it buys is not a reminder but the thing this repository keeps insisting on: the platform refuses.
A behind branch reports `BEHIND` instead of `CLEAN`, the merge is unavailable, and `enforce_admins:
true` means the one human has no exemption either. Updating the branch re-triggers `pull_request`, so
the required check re-runs against the merge it will actually be — which is what makes a green check
mean what everyone already reads it as meaning.

**Why the rule needs the setting, stated plainly.** CI runs on `pull_request` and checks out
`refs/pull/N/merge` — a test merge against `main` *as it stood when the run happened*. GitHub does not
re-run it when the base moves. So without `strict`, "green" is a claim about a merge that is no longer
the one on offer, and the failures it cannot see are the correspondence checks this workspace is built
out of: `links`, `map` and `record` all go red on unions of changes that are individually green.

**The cost, honestly.** Three costs, and the first is the real one.

- **Merges serialise.** Every merge puts every other open pull request behind, so each must be rebased
  and must wait for a fresh `workspace-verify` before it can land. With three open pull requests today
  and parallel sessions producing them, that is three rebases and three CI runs per landed change in the
  worst case — bought deliberately, because the alternative is exactly what the ruling forbids.
- **`allow_update_branch` is `false` here**, so GitHub offers no *Update branch* button and the sync is
  done by hand: `git rebase origin/main && git push --force-with-lease`. Both are Auto, so no gate is
  added by this proposal — only a step. Leaving it off is also the better fit: the button's default is a
  merge commit, and this repository rebase-merges.
- **A stacked pull request must be rebased bottom-up.** Nothing new, but this setting makes it
  mandatory rather than tidy.

If the friction proves worse than the risk, the honest response is another proposal turning it off, not
leaving the setting off while these documents claim otherwise.

**One thing this does not do.** It does not stop two *conflicting* changes from being merged one after
the other — it stops the second from being merged **untested against the first**. Semantic conflicts are
caught because the re-run happens, not because the platform understands them.

**Carried into milestone 4.** The row's repository-ruleset export is *importable branch-protection JSON*
compiled from this workspace's policy. If this is accepted, the export must carry strict required status
checks, or the exported floor would be weaker than the live one — a drift the export exists to prevent.
Noted for session 1 rather than folded into the criterion, which is the maintainer's to change.

**Provenance.** The maintainer's ruling of 2026-07-27; vision thesis 3 — rails, not prose; the platform
floor in [`../../core/operating/autonomy.md`](../../core/operating/autonomy.md); and the three-pull-request
measurement above.

**Decision.** _Accepted — Marius Cetanas, 2026-07-27_, in the session that drafted this, by the
instruction quoted at the top. Configuring branch protection is **Gated**
([`../gate-map.md`](../gate-map.md)) — his decision, and here executed by an agent on an explicit
per-action instruction rather than on inference.

**Applied, and read back rather than assumed.**

```
$ gh api -X PATCH repos/sleepy-panda-works/portulan/branches/main/protection/required_status_checks \
    --input - <<'JSON'
{"strict":true,"checks":[{"context":"workspace-verify","app_id":15368}]}
JSON
{"strict":true,"contexts":["workspace-verify"],"checks":[{"context":"workspace-verify","app_id":15368}]}
```

_(`--input` takes a **file**, or `-` for stdin — inline JSON as its argument is read as a filename and
fails. Written as the heredoc form so it is copy-pasteable; what was actually run passed a temporary file,
which is the same request.)_

The `checks` array was sent explicitly rather than trusting the `PATCH` to preserve it, because a
required check that quietly loses its `app_id` pin is satisfiable by any GitHub App reporting that name —
the hole [`0001`](0001-platform-floor-on-main.md) closed and this change must not silently reopen. The
whole protection object was then re-read: `enforce_admins: true`, conversation resolution on, force-pushes
and deletion blocked, reviews 0, check pinned to 15368 — nothing else moved.

**Demonstrated, not asserted — on the pull request carrying this proposal.** The first attempt at a
demonstration failed for an uninteresting reason and is recorded so the second is not mistaken for the
first: the three pull requests that were behind when the ruling was taken all merged or rebased within
the same half-hour (#41 and #42 landed, #43 rebased to `behind_by=0`), so every subject synced itself. A
`BLOCKED` reading was caught on #43 mid-recompute, and one ambiguous observation is not evidence — GitHub
reports `BLOCKED` for several reasons.

The real one came from **#46**, this proposal's own pull request, when `main` moved two commits under it
while a review round was being addressed:

```
$ gh pr view 46 --json mergeStateStatus,mergeable   → BEHIND / MERGEABLE
$ gh api …/pulls/46 --jq .mergeable_state           → behind
$ gh api …/compare/main...how-a-pull-request-reaches-main --jq .behind_by  → 2
```

`MERGEABLE` beside `BEHIND` is the whole point: there is **no textual conflict** — git would merge this
cleanly — and the platform refuses anyway, because the green check on it describes a merge with a `main`
that is two commits gone. Before the setting, that same state read `CLEAN` and was mergeable on the spot.
That is the before-and-after this proposal exists to produce.

**The honest limit on this evidence:** what was observed is GitHub *reporting* the refusal, not a merge
being attempted and rejected. The direct-push demonstration in [`0001`](0001-platform-floor-on-main.md)
could be run because a rejected push changes nothing; a merge attempt that is *not* refused would land
the change, so it is deliberately not run — the same reasoning that leaves the ruleset-bypass interaction
untested in [`../gate-map.md`](../gate-map.md).
