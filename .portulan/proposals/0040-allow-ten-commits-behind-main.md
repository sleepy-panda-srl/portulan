# Proposal 0040 — allow ten commits behind main

**Status. ACCEPTED — prepared; activation pending, 2026-11-03.**

**Pull request:** https://github.com/sleepy-panda-srl/portulan/pull/557

## Decision

The maintainer clarified on 2026-11-03: “Up to 10 commits behind main. It should fails if it's behind 11 commits, not 10.”
The merge precondition in [proposal 0011](0011-no-merge-from-behind-main.md) is amended: zero through
ten commits behind the base are allowed; 11 or more require a sync. The earlier ruling remains the
historical record. [Task 0020](../tasks/0020-ten-commit-freshness.md) carries the acceptance criteria.

## Enforcement and cost

GitHub's native freshness setting is boolean. A required `branch-freshness` check will compare each
open PR's exact head with current `main`, pass at most ten, and fail at 11 or more. Trusted base code
refreshes every open PR on PR events and pushes to `main`; missing or invalid comparison data cannot
produce a new passing verdict. Gate-policy 2.3 adds a validated boolean `floor.strict`, leaving older
policies strict. This workspace will explicitly disable native strict freshness and require the new
check from GitHub Actions, beside its existing checks.

The replacement is asynchronous: event delays, workflow/API outages and movement after its final read
can leave an earlier green applicable temporarily. It does not establish that tests ran against the
latest base. An agent still compares the exact SHAs immediately before a merge and refuses eleven or
more, or an unreadable comparison. This is a deliberate relaxation of proposal 0011, on the maintainer's
instruction, rather than a claim that the old guarantee is preserved.

## Ordered activation

Live strict protection stays enabled while the implementation is reviewed. After the specifically
approved merge, demonstrate Actions-attributed check runs on every existing PR head. Only then change
the required-status-check subresource to loose freshness plus the existing checks and the new one,
preserving every other protection. Read the settings back. The Panda helper currently lacks a supported
Administration-token route for this PATCH; do not substitute maintainer writes.

**Decision.** Marius Cetanas's instruction above accepts the policy amendment. The session-open
checkpoint approved the implementation plan with adjustments incorporated here. Neither that verdict
nor this accepted proposal claims live activation.

**Provenance.** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/557` — the
maintainer's 2026-11-03 request and boundary clarification, recorded before implementation.
