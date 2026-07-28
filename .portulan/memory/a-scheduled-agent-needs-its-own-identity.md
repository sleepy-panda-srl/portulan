**type:** rule
**scope:** workspace — anyone building a job that files work into this repository unattended
**provenance:** `form=link` `href=../proposals/0015-the-librarian-files-as-the-agent.md`
— milestone 5, session 1. The scheduled librarian's whole deliverable is *files its first real pull
request*, and the obvious build — a workflow opening one with `GITHUB_TOKEN` — produces a pull request
that can never merge.

A workflow that must file work the platform floor will accept needs an identity **other than the
repository's own `GITHUB_TOKEN`**. GitHub starts no workflow runs for events raised by that token —
`workflow_dispatch` and `repository_dispatch` are the only documented exceptions — so a pull request it
opens gets no `pull_request` runs at all. Here that means `workspace-verify` and `pr-labeled`, both
**required**, never report: not red, never reported, which is a state no amount of waiting resolves.

**Why it is worth a rule rather than a comment in one workflow.** The failure looks like a permissions
problem and is not — no `permissions:` block fixes it, because the token is the problem. It is also
invisible until the end: the job succeeds, the branch pushes, the pull request opens, and the thing
looks finished. Only the checks that never appear say otherwise, and *absent* reads like *pending*.

**The general shape, beyond this repository:** the platform floor is the guarantee this product sells —
branch protection, required checks, PR-as-gate, the gate no model can bypass. An unattended agent must
therefore arrive at that gate as **someone**, and the automation credential a CI system hands out is
deliberately not someone. Any team wiring a scheduled agent into a protected branch meets this, and
meets it late.

**How to apply:** give the job a real identity for the act that must be reviewed — here a GitHub App
installation token — and keep `GITHUB_TOKEN` for the parts nobody reviews, like pushing the branch.
Split by *what needs to be attributable*, not by what is convenient. And make the job **refuse** rather
than fall back: [`../../.github/workflows/librarian.yml`](../../.github/workflows/librarian.yml) fails
with the reason and leaves its branch pushed, because a fallback that quietly produced the unmergeable
version is the same defect arrived at by a different road.

The corollary that cost a design: an update push raises `synchronize` from the same token and starts
no runs either, so a pull request that was mergeable becomes unmergeable the moment automation touches
it again. That is why the pass has **no update path** — one pass, one branch, one pull request, and a
same-day re-run is a no-op.

**Retire when:** GitHub starts `pull_request` runs for `GITHUB_TOKEN`-raised events, or this
repository's floor stops requiring checks that only `pull_request` produces. Neither is in sight, and
the first would be a platform change nobody here controls — so this is a rule about a constraint rather
than about a defect, and it retires by the constraint lifting.
