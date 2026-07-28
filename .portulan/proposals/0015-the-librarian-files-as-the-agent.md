# Proposal 0015 — the scheduled librarian files as the agent identity

**Status. ACCEPTED by Marius, 2026-07-28**, put to him at this session's opening checkpoint as one of
two live routes and chosen over the other. Recorded as a proposal rather than folded into the change,
on the [`0009`](0009-a-gate-policy-beside-the-gate-map.md) · [`0010`](0010-prohibited-as-a-fourth-universal-tier.md) ·
[`0011`](0011-no-merge-from-behind-main.md) precedent: **a settings change with no proposal behind it is
a floor nobody can audit** — and this one both widens a permission and reverses a decision this
repository had already written down.

## Incident

Milestone 5's row requires that the scheduled librarian **file its first real pull request**. Building
it ran straight into a platform behaviour: GitHub does not start workflow runs for events raised by a
workflow's own `GITHUB_TOKEN`, with `workflow_dispatch` and `repository_dispatch` as the only
documented exceptions. `main`'s live floor requires `workspace-verify` and `pr-labeled`, and both run
on `pull_request`.

So a pull request opened by the repository's own token gets **neither required check, ever**. It is
not slow to merge; it is unmergeable, permanently, with two checks that will never report rather than
two that failed. The librarian would file a decoration — and the milestone's word is *demonstrated*.

There is no arrangement of `permissions:` that fixes this. The token is the problem, not its scope.

## The two routes, and why this one

**(a) This proposal — the pull request is opened by `portulan-agent`.** The App is a different actor,
so the `pull_request` runs start normally. It also makes the filing attributable at a glance, which is
[`../memory/agent-activity-is-attributable.md`](../memory/agent-activity-is-attributable.md) getting
what it asked for on one more artifact.

**(b) Enable *Allow GitHub Actions to create and approve pull requests*** (measured 2026-07-28:
`can_approve_pull_request_reviews: false` at both org and repository level). No credential is stored
anywhere, which is a real advantage. Two costs: the flag is one switch for two capabilities, and the
second is *approve* — inert today at 0 required reviews and load-bearing the moment that rises, which
is the same latent-widening shape [`../tools/README.md`](../tools/README.md) already records about the
App's own review permission. And the author would be `github-actions[bot]`, so the repository's own
agent identity is bypassed for the one artifact an agent files unattended.

**(c) Neither — run the pass from a local scheduler and open the pull request by hand.** Rejected by
the maintainer, and worth recording as the option it was: it needs no permission at all, and it is
the weaker answer for a product whose thesis is that the repository is the enforcement plane.

## The proposed change

1. **`portulan-agent` gains `contents: read`.** Nothing else. It still cannot push, merge, or change
   settings, and it still cannot write code.
2. **Two repository secrets**, `PORTULAN_BOT_APP_ID` and `PORTULAN_BOT_PRIVATE_KEY`, so a workflow can
   mint an installation token through the existing [`../tools/gh-bot-token.mjs`](../tools/gh-bot-token.mjs),
   unchanged.
3. **[`../gate-map.md`](../gate-map.md)'s identity table gains a third actor** — the workflow, which
   commits and pushes as `github-actions[bot]` — and its App row stops saying the App cannot open a
   pull request.

## The recorded decision this reverses, and the correction it deserves

[`../tools/README.md`](../tools/README.md) has said since 2026-07-26, with a measurement behind it:

> **The App cannot open a pull request, only talk on one.** Creating one requires repository-contents
> read, which this installation is refused; GitHub answers `not all refs are readable` (HTTP 422).

That measurement stands and is not in question. **The reasoning attached to it does not**, on two
counts, and both are corrected in the same change as this proposal rather than left standing beside a
contradicting setting:

- It says granting contents "would give the token the ability to **write code**". It would not.
  `contents: read` is read. Write is a separate permission and this proposal does not ask for it. The
  sentence conflated the two, and the bullet directly above it — "The App's permissions cannot write
  code at all, which is the enforcement rather than the intention" — stays true afterwards.
- It was written on **2026-07-26, while this repository was private**. It has been public since
  2026-07-27. `contents: read` on a public repository grants the ability to read what any stranger can
  already read. The cost the sentence was pricing has since gone to approximately zero, and nothing
  re-read it.

**What the widening does still cost, stated because the paragraph above is an argument for the change
and this one is the argument against it.** Visibility is a live setting, not a pinned one: if this
repository were ever made private again, `contents: read` would become a real grant that nobody would
revisit, because permissions are not re-derived from visibility. And `.pem` in hand plus this scope is
read access to every file, which for a private repository is the whole of it. That is the trade, and
it is the maintainer's; it is recorded here so the next reader can price it rather than discover it.

## Enforcement

**None of it is enforceable from inside this repository, and saying so is the point.** An App's
permission set is a live setting no file here pins — the same limit
[`../gate-map.md`](../gate-map.md) already records for branch protection, and the reason
[`../tools/README.md`](../tools/README.md) says to read the permissions back at the supervised
checkpoints. What this change *can* do, and does:

- The workflow **refuses to open a pull request with `GITHUB_TOKEN`** if the secrets are missing. It
  fails the job with the reason, leaving the branch pushed and waiting, rather than filing something
  that cannot merge. A fallback that silently produced a worse artifact would be the failure this
  proposal exists to prevent, arrived at by a different road.
- The reasoning lives in `.github/workflows/librarian.yml` beside the code that depends on it, so a
  future session reading *why does this mint a token* finds the answer in the file rather than here.

## Provenance

`form=link` `href=https://github.com/sleepy-panda-works/portulan/pull/81` — the change that builds the
scheduled librarian, read against `.portulan/tools/README.md`'s 2026-07-26 measurement and GitHub's
documented recursion guard. Written once the pull request existed, and the reason it was not written
earlier is worth keeping: the first draft **guessed** the number as `#80` and the guess was wrong —
`#80` had been opened by a different session an hour before, which is also the collision this branch
should expect on `docs/plan.md`. A pointer that cannot be known yet is a red on `docs.sh`'s new
`proposal` check until it is, and that red is correct rather than inconvenient: until this pull request
existed, nothing had filed this.

**Decision.** Marius Cetanas — **accepted, 2026-07-28**, choosing route (a) over (b) and (c) at this
session's opening checkpoint.

**Pull request:** [#81](https://github.com/sleepy-panda-works/portulan/pull/81) — the change that filed this.
