# Branch freshness — active

The maintainer's allowance is active: 0–10 commits behind live `main` pass; eleven or more require a
sync. PRs [#557](https://github.com/sleepy-panda-srl/portulan/pull/557) and
[#560](https://github.com/sleepy-panda-srl/portulan/pull/560) merged before activation.

Actions checks on all four then-open heads passed at five behind `3613cd8f`, observed 13:27:01 UTC.
The Panda helper applied the narrow protection PATCH; full readback observed at 13:27:40 UTC showed
`strict: false` with all three checks pinned to Actions app 15368 and other fields unchanged.
PR #555 merged at 13:27:28 UTC with its head unchanged. Counts are dated, not current-state promises.

The [activation record](../tools/branch-freshness-activation-2026-11-03.md) carries the head/check table,
settings and limits. The [task](../tasks/0020-ten-commit-freshness.md) is complete. Any merge still needs
maintainer authorization and the immediate exact-SHA comparison; event delays and outages can leave
an older green temporarily applicable. Eleven-behind rejection was tested offline, not by a live merge.
