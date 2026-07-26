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

- Open a pull request. **An agent never merges its own on its own authority** — but the gate is the
  maintainer's *decision* to merge, not his keystroke. He may review a pull request and then instruct an
  agent to perform the merge; that is the gate working, not a bypass. What stays forbidden is an agent
  deciding for itself that a change is ready to land. Default when nothing is said: open the pull request
  and hand it over. _(Recorded because the shorter wording reads as an absolute, and an agent following it
  literally would have to refuse a direct instruction from the person the rule exists to protect.)_
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

## Which identity acts

Two identities operate on this repository, and which one acts is not a detail — the record of who did what
is the thing the whole gate map exists to keep honest.

| Action | Identity | Why |
|---|---|---|
| Commits and pushes | **The maintainer's** git identity and credentials | The build's provenance discipline requires his authorship on the commit record. An agent co-authoring is fine and already conventional; an agent *replacing* him there is not. |
| Pull-request conversation — comments and review replies | **The agent identity**, via [`tools/gh-bot`](tools/gh-bot) | A reply written by an agent and posted through the maintainer's credentials makes the conversation read as human when it is not, and the reader cannot tell. See [`memory/agent-activity-is-attributable.md`](memory/agent-activity-is-attributable.md). |
| **Resolving a review thread** | **The maintainer**, by hand | Not a choice — the platform refuses it. `resolveReviewThread` returns `FORBIDDEN — Resource not accessible by integration` for a GitHub App, whatever its permission set. It is also the right split on reflection: a reply is *what the agent says*, while resolving is *the judgement that a review point is settled*, and this repository requires conversation resolution before merge, which makes it part of the merge gate rather than part of the conversation. |
| Everything Gated above — settings, releases, merges | **The maintainer**, by hand | Unchanged. The agent identity's token cannot do these at all. |

Note the asymmetry, because it looks inconsistent until you say it out loud: the commit record must stay
*his* and the conversation must stop being his. Attribution is not one principle applied uniformly — it is
*who actually did this*, and the honest answer differs by artifact.

What makes the commit half honest rather than the same convention-reliance rejected for comments is that
**every push is Gated**: the maintainer approves each one, so his name on a commit records a decision he
actually took, with the agent's hand marked by the `Co-Authored-By` trailer. Remove the push gate and the
commit attribution would become exactly the fiction the comment attribution was.

Enforcement is the App's permission set rather than the wrapper: that token writes pull-request
conversation and nothing else. The wrapper's refusal of a few subcommands is a guard against habit and is
trivially bypassable.

**Live since 2026-07-25.** The App exists, is installed on this repository alone, and has posted its
first `portulan-agent[bot]` comment. Its permissions are pull-request conversation write and metadata
read; **repository contents is refused**, which is the load-bearing part — it is what makes the
permission set the enforcement rather than the wrapper. Setup and its honest limits are in
[`tools/README.md`](tools/README.md).

_This paragraph read "the App does not exist" until milestone 2, session 2, by which time it had existed
for several hours. The change that brought it live updated `tools/README.md` and its handoff and not this
file — an ordinary miss, worth naming because it happened inside the milestone whose subject is claims
drift, and because the lint that milestone shipped **cannot catch this one**: it checks paths and a
status-check name against the tree, and "the App does not exist" is prose about a fact outside the tree
entirely. Found by grepping for stale claims by hand. That is the honest boundary of the machinery._

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
| Required status check | `workspace-verify` — the workspace's verify recipes, run by CI; pinned to app 15368 |
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

**The required check was renamed by a sequence, not an edit** — completed 2026-07-25, and worth keeping
because the same constraint applies to any future rename. The context was `docs-integrity`, a name that
stopped describing the job once it ran more than a docs linter. It could not be renamed in place: the
required context would stop reporting, the pull request doing it would never be mergeable, and
`enforce_admins` means that block could not be forced past. So the new job ran alongside the old, the
maintainer re-pointed protection by hand (Gated — the one step an agent cannot take), and only then was the
transitional job deleted. See
[`proposals/0004-ci-runs-every-declared-recipe.md`](proposals/0004-ci-runs-every-declared-recipe.md).

The check is also **pinned to app 15368** (GitHub Actions). Without an app id, any GitHub App reporting a
check of that name would satisfy the gate — a distinction the branch-protection UI does not surface, and
one the API does.

**`CODEOWNERS` exists as of milestone 3 — and it is not yet part of the floor.**
[`../CODEOWNERS`](../CODEOWNERS) records who owns which paths and routes review requests. It does not
block anything, because *Require review from Code Owners* is **off** in branch protection, deliberately:
GitHub does not permit anyone to approve their own pull request, this repository has one human, and
`enforce_admins` gives him no exemption — so requiring a code owner's approval would require an approval
nobody present can give, and nothing would ever merge. That is the same arithmetic behind the 0
required-reviews decision above.

So the honest position is unchanged where it counts: [`../docs/vision.md`](../docs/vision.md) is still
protected by the prohibition above and **not** by the platform. What the file adds today is that
ownership is written down; what it adds later is a rail, on the day a second reviewer exists and the
setting can be switched on. That switch is a repository-settings change — Gated.
