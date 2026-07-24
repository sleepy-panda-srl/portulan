# Gate map — what an agent may do in this repository

> The **policy** half of [`../core/operating/autonomy.md`](../core/operating/autonomy.md). Core defines
> the tiers — Auto, Propose, Gated — as universal mechanism; this file binds *this repository's* concrete
> actions to them, because which action is dangerous is a property of the team, not of the engine. When
> the enforcement compiler arrives (milestone 4), this table is its input.

## The tiers, bound

### Auto — the agent acts unattended

Recoverable and reversible inside a working copy. Nothing here reaches another person or a shared branch.

- Read anything in the repository, including git history.
- Create and edit files on a working branch, in a worktree.
- Run [`verify/docs.sh`](verify/docs.sh) or any read-only shell command.
- Commit to a working branch — never to `main`.
- Draft memory entries, task files, handoffs, and proposals.
- Delegate to a subagent persona ([`../core/personas/`](../core/personas/)).

### Propose — a human or an eval gate reviews before it counts

Reversible but consequential: it changes what the repository says, or how it behaves.

- Open a pull request. **An agent never merges its own.**
- Add or change doctrine in [`../core/`](../core/), a template, a persona, or a skill.
- Add or change anything in this workspace, including this file.
- Update the Status column or the Session log in [`../docs/plan.md`](../docs/plan.md).
- Change the verify recipe — and *relaxing* a check is the case to scrutinise hardest, because it is the
  one change that makes every future "green" mean less.

### Gated — explicit human approval, per action, before it happens

Outward-facing or hard to undo. The agent prepares the action and asks; it does not proceed on inference,
and approval for one action never generalises to the next.

- `git push` to `origin` — including the first push of a new branch.
- Merge a pull request; delete a remote branch.
- Change repository settings — **visibility above all** — collaborators, or branch protection.
- Create, rename, transfer, or delete a repository.
- Tag or publish a release; publish to a package registry or a plugin marketplace.
- Register or change a domain; anything that spends money.
- Send any message or artifact outside this repository on the team's behalf.

## Above the tiers: what no agent may do at all

[`../docs/vision.md`](../docs/vision.md) is the constitution, and it is **human-owned**. No agent edits
it — not with approval, not as a proposal that rewrites it in place. An agent that believes the
constitution is wrong raises the question with the maintainer and stops.

_Why this is a prohibition rather than simply the Gated tier: every other change in this repository is
graded against that file. An agent that can edit the standard it is judged by can launder any other
change past its own grader, and the gate stops meaning anything._

## The triage threshold

Core defines two lanes and leaves the boundary to the workspace
([`../core/operating/loop.md`](../core/operating/loop.md)). Here:

- **Triage lane** — a change confined to one file, with no rule change, no new claim about what the
  product does, and no milestone effect. A typo, a dead link, a sentence tightened.
- **Full lane** — everything else, and always: new or changed doctrine; anything touching the kernel;
  anything that moves milestone status; any change to this gate map or to the verify recipe.

_Why the boundary sits there and not at a diff size: in a prose product, blast radius is what a change
commits the framework to, not how many lines it moves. A four-word edit that promises enforcement we do
not have is a full-lane change._

## Supervised-build checkpoints

Three gates from [`../docs/plan.md`](../docs/plan.md), each requiring a supervisor in a **fresh context**
that has not seen the implementer's window:

| Checkpoint | When | What it grades |
|---|---|---|
| Session-open | before implementation starts | the session plan, against the constitution and the plan |
| Pre-commit | before any commit | the diff, against the milestone's exit criterion |
| Milestone-close | before a milestone is marked done | that the criterion was *demonstrated*, not asserted |

If supervision is unavailable in a session, that is stated plainly and the maintainer reviews the diff.
A milestone is never self-certified.

## The platform floor

Core calls the platform floor the gate no prompt can bypass
([`../core/operating/autonomy.md`](../core/operating/autonomy.md)). **On this repository it is now
configured**, as of 2026-07-25, per
[`proposals/0001-platform-floor-on-main.md`](proposals/0001-platform-floor-on-main.md). What `main`
enforces:

| Setting | Value |
|---|---|
| Direct pushes | rejected — every change goes through a pull request |
| Required status check | `docs-integrity` — the verify recipe, run by CI |
| Administrators | **included**; the maintainer has no exemption |
| Required approving reviews | 0 — see below |
| Conversation resolution | required before merge |
| Force-pushes and branch deletion | blocked |

Verified rather than asserted: a direct push to `main` was attempted after the change and rejected with
*"Changes must be made through a pull request."* This is the first gate in the repository that holds
against the agent, the maintainer, and any future collaborator equally — the difference between a rule
and a rail.

**Why zero required reviews, on purpose.** GitHub does not permit anyone to approve their own pull
request. On a repository with one human, requiring an approving review *and* enforcing for
administrators would deadlock every merge. Requiring the PR and the green check — with no exemption for
anyone — is the strongest floor a solo maintainer can actually stand on. When a second reviewer exists,
raise the count; the setting to preserve is `enforce_admins`, because a floor with an exemption for the
only actor who can act is not a floor.

**Still absent:** no `CODEOWNERS`, so no path-specific human is required on any file — including
[`../docs/vision.md`](../docs/vision.md), which is protected today only by the prohibition above and not
by the platform. That is the next piece of the floor, and it is worth doing before the repository goes
public at milestone 3.
