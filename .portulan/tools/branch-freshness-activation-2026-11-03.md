# Ten-commit freshness — activation evidence, 2026-11-03

**Active:** zero through ten commits behind live `main` pass; eleven or more fail. The maintainer
approved #560's merge in this session. It had already merged as `3613cd8f4a155b0c6f9de195227bc3b0ca392c32`
when the pre-merge guard read it, so the operator did not repeat the merge.

## Workflow and exact-head checks

The corrected trusted-main [push workflow](https://github.com/sleepy-panda-srl/portulan/actions/runs/41644240131)
completed successfully. The independent live audit observed the following at **13:27:01 UTC**, all
against live `main` SHA `3613cd8f4a155b0c6f9de195227bc3b0ca392c32`. Every check was completed with
`success`, attributed to GitHub Actions app **15368**, and named the exact base, head and count in its
output. The audit reread each head and the live branch to reject movement. These counts are historical.

| PR | Exact head | Behind | Verified check |
|---|---|---|---|
| [#559](https://github.com/sleepy-panda-srl/portulan/pull/559) | `555ac006b26e203b0dca2a868774f44612c5d5ff` | 5 | [125945307024](https://github.com/sleepy-panda-srl/portulan/runs/125945307024) |
| [#558](https://github.com/sleepy-panda-srl/portulan/pull/558) | `4fdbf17fcdc12cb144312cc5f9e23c81d98d3da6` | 5 | [125945340831](https://github.com/sleepy-panda-srl/portulan/runs/125945340831) |
| [#556](https://github.com/sleepy-panda-srl/portulan/pull/556) | `dedac410bd399aad085e91cc276aed40734c4e1b` | 5 | [125945368467](https://github.com/sleepy-panda-srl/portulan/runs/125945368467) |
| [#555](https://github.com/sleepy-panda-srl/portulan/pull/555) | `d92fcb9d7348d474f8754faf0c6afa6de08cc3b3` | 5 | [125945398564](https://github.com/sleepy-panda-srl/portulan/runs/125945398564) |

## Protection readback

After that audit, the installed Panda helper PATCHed only
`repos/sleepy-panda-srl/portulan/branches/main/protection/required_status_checks` as Sleepy Panda Codex.
Full protection snapshots were read before activation at **13:26:33 UTC** and after at
**13:27:40 UTC**. The required-status-check subresource changed from `strict: true` with
`workspace-verify` and `pr-labeled` to:

```json
{
  "strict": false,
  "checks": [
    { "context": "workspace-verify", "app_id": 15368 },
    { "context": "pr-labeled", "app_id": 15368 },
    { "context": "branch-freshness", "app_id": 15368 }
  ]
}
```

The full JSON objects excluding that subresource compared equal. Administrator enforcement,
conversation resolution, review settings, force-push and deletion blocks were preserved. The
organisation ruleset was read separately and contains deletion and non-fast-forward rules, with
no competing freshness requirement. The compiled repository ruleset was not imported.

PR [#555](https://github.com/sleepy-panda-srl/portulan/pull/555) merged at **13:27:28 UTC** as
`8989bbc4008ab994c352b3ee889b010a97a3f02e`, retaining its head from the table without a branch sync.
The subsequent [push workflow](https://github.com/sleepy-panda-srl/portulan/actions/runs/41644497546)
also completed successfully.

## Verification and limits

The live-main correction's independent pre-commit ran all 31 recipes and 3,291 tests. Offline
mutations restoring the stored-base bug, removing final confirmation and allowing eleven all failed.
The helper's 23 synthetic permission-route and dispatch cases passed. No live merge at eleven behind
was attempted; its rejection is an offline check result, not a claimed platform experiment.

The workflow remains asynchronous. Event delays, API/write failures and movement after the last read
can leave an older green temporarily applicable. It does not rerun integration tests against newest
`main` or provide an atomic merge-time comparison. The agent still obtains specific merge approval
and compares the live branch SHA with the PR head immediately before merging. See the
[activation procedure and limits](branch-freshness.md).
