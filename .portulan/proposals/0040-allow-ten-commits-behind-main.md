# Proposal 0040 — allow ten commits behind main

**Status. ACCEPTED — active, 2026-11-03.**

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/557

## Decision

The maintainer clarified on 2026-11-03: “Up to 10 commits behind main. It should fails if it's behind 11 commits, not 10.”
The merge precondition in [proposal 0011](0011-no-merge-from-behind-main.md) is amended: zero through
ten commits behind the base are allowed; 11 or more require a sync. The earlier ruling remains the
historical record. [Task 0020](../tasks/0020-ten-commit-freshness.md) carries the acceptance criteria.

## Enforcement and cost

GitHub's native freshness setting is boolean. A required `branch-freshness` check compares each
open PR's exact head with current `main`, pass at most ten, and fail at 11 or more. Trusted base code
refreshes every open PR on PR events and pushes to `main`; missing or invalid comparison data cannot
produce a new passing verdict. Gate-policy 2.3 adds a validated boolean `floor.strict`, leaving older
policies strict. This workspace explicitly disables native strict freshness and requires the new
check from GitHub Actions, beside its existing checks.

The replacement is asynchronous: event delays, workflow/API outages and movement after its final read
can leave an earlier green applicable temporarily. It does not establish that tests ran against the
latest base. An agent still compares the exact SHAs immediately before a merge and refuses eleven or
more, or an unreadable comparison. This is a deliberate relaxation of proposal 0011, on the maintainer's
instruction, rather than a claim that the old guarantee is preserved.

## Ordered activation

The implementation and live-main correction merged in #557 and #560. After the specifically
approved merge, Actions-attributed check runs were demonstrated on every existing PR head. The
supported Panda route then changed only the required-status-check subresource to loose freshness
plus the existing checks and the new one. Full settings readback preserved every other protection.
The [dated activation record](../tools/branch-freshness-activation-2026-11-03.md) carries the evidence.

**Decision.** Marius Cetanas's instruction above accepts the policy amendment. The session-open
checkpoint approved the implementation plan with adjustments incorporated here. Neither that verdict
nor the accepted proposal alone established live activation; the later readback above does.

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/557` — the
maintainer's 2026-11-03 request and boundary clarification, recorded before implementation.
