# A branch syncs with main before it merges

**type:** rule
**dated:** 2026-11-03
**scope:** workspace — every PR into `main`
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/557`
— the maintainer amended proposal 0011: allow up to ten commits behind, fail at eleven or more.

Immediately before an approved merge, read the PR's current base/head SHAs and compare those exact
commits. `behind_by` must be an integer in 0–10. At eleven or more, sync with `main` and rerun the
checks. A failed or unreadable comparison is not zero and does not permit the merge.

**Why it holds:** the maintainer accepts limited drift to avoid syncing after every merge. Earlier CI
still describes the base it tested, so this allowance trades some integration certainty for less churn.
The historical strict rule remains in [proposal 0011](../proposals/0011-no-merge-from-behind-main.md);
[proposal 0040](../proposals/0040-allow-ten-commits-behind-main.md) records the accepted replacement.

**Enforcement and limit:** the prepared `branch-freshness` workflow checks each head and refreshes all
open PRs on PR/base events. It is asynchronous: delays, outages and movement after the final read can
leave an older green applicable temporarily. It neither reruns CI against the newest base nor replaces
the agent's immediate comparison. Live `strict: true` remains until the
[activation procedure](../tools/branch-freshness.md) is demonstrated; a prepared policy is not a
settings readback.

**Retire when:** a merge queue or replacement rule supersedes this explicit ten-commit allowance.
