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
- **Push a working branch to `origin`, including its first push, and force-push it.** Never `main`, which the
  platform refuses anyway. See below for why this stopped being Gated.
- Draft memory entries, task files, handoffs, and proposals.
- Delegate to a subagent persona ([`../core/personas/`](../core/personas/)).

**Pushing a working branch was Gated until 2026-07-27, and the argument for gating it did not survive
inspection.** It is recorded rather than quietly dropped, because the reasoning it replaces is still the
reasoning behind the commit-attribution rule below.

The old argument ran: commits carry the maintainer's git identity, every push is approved, therefore his name
on a commit records a decision he actually took — *"remove the push gate and the commit attribution would
become exactly the fiction the comment attribution was."* The flaw is that **push was never the moment that
guaranteed it.** A commit's author is fixed when it is written, not when it is sent; and a commit on an
unmerged working branch is not part of this repository's record. What makes his authorship honest is his
decision to **merge**, which is where a commit actually enters `main` — and that stays Gated. The push gate
was a proxy for a guarantee that lives one step later.

What ungating it does not touch, all of it platform-enforced rather than promised: `main` rejects direct
pushes, force-pushes and deletions on `main` are blocked, `workspace-verify` is required, conversation
resolution is required, and `enforce_admins` leaves nobody an exemption. A working-branch push cannot reach
any of that. Every commit still carries `Co-Authored-By` marking the agent's hand.

**The one real cost, named rather than waved past:** a push is the moment content leaves this machine for
GitHub, and it was the last human checkpoint before that happened. The confidentiality seam does not depend
on it — the seam scan is a **commit**-time obligation, and commits were already Auto — so nothing moves from
checked to unchecked. But the honest statement is that an unreviewed push now publishes to a private remote
where it is visible to anyone with access and may be cached or indexed. That is judged acceptable on a
one-collaborator private repository and is the thing to revisit first if either of those facts changes.

### Propose — a human or an eval gate reviews before it counts

Reversible but consequential: it changes what the repository says, or how it behaves.

- Open a pull request. **An agent never merges its own on its own authority** — what stays forbidden is an
  agent deciding for itself that a change is ready to land. Merging itself is Gated below, and as that
  tier's header says, the gate is the maintainer's decision rather than his keystroke: he may review a pull
  request and then instruct an agent to perform the merge. Default when nothing is said: open the pull
  request and hand it over.
- Add or change doctrine in [`../core/`](../core/), a template, a persona, or a skill.
- Add or change anything in this workspace, including this file.
- Update the Status column or the Session log in [`../docs/plan.md`](../docs/plan.md).
- Change the verify recipe — and *relaxing* a check is the case to scrutinise hardest, because it is the
  one change that makes every future "green" mean less.

### Gated — explicit human approval, per action, before it happens

Outward-facing or hard to undo. The agent prepares the action and asks; it does not proceed on inference,
and approval for one action never generalises to the next.

**The gate is the maintainer's decision, not his keystroke — and that governs every action in this tier**,
not only the merge it was first written about. He may approve in conversation and then have an agent run the
command; that is the gate working, not a bypass. What the tier forbids is an agent deciding for itself that
approval was implied, or treating one approval as standing permission. Default when nothing is said: prepare
the action, ask, and wait.

*Which* credentials run it is a separate question, answered in **Which identity acts** below: the agent
identity's token cannot perform Gated actions at all, so an agent executing one necessarily does so with the
maintainer's own credentials — which is precisely why the approval has to be explicit and per action rather
than inferred from a previous one.

_(Hoisted here 2026-07-27, after the omission cost several exchanges. The principle had been written down
once — in the Propose tier, attached to merging — while `git push` (Gated at the time, Auto since) and
`Merge a pull request` both sat in this tier under a header reading "explicit human approval, per action,
before it happens", with nothing connecting the two. An agent read this tier literally and handed `git push`
commands back to the maintainer
to type by hand, which is precisely the failure the original note predicted in its own words: "an agent
following it literally would have to refuse a direct instruction from the person the rule exists to
protect." That note was right about the hazard and wrong about its scope — **a principle stated once, in a
neighbouring tier, does not reach the actions it was meant to govern.** The lesson generalises past this
file: where a rule and its clarification live apart, only the rule gets read.)_

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
| **Opening a pull request** | **The maintainer's credentials**, with the body carrying an attribution line naming the agent | Not a choice either — the platform refuses it. Creating a pull request needs repository-**contents** read, and this App is deliberately refused contents: that refusal is what makes "the permission set is the enforcement, not the wrapper" true, so widening it to buy nicer attribution would trade the load-bearing guarantee for a cosmetic one. GitHub answers `not all refs are readable` (HTTP 422). Measured 2026-07-26 opening [#18](https://github.com/sleepy-panda-works/portulan/pull/18). The fallback is the one this repository used before the App existed: post under his name and *say so in the artifact*, which serves the rule's actual purpose — a reader can tell. Conversation on the pull request still comes from the bot. |
| **Resolving a review thread** | **The maintainer**, by hand | Not the agent identity's, and that part is a platform refusal: `resolveReviewThread` returns `FORBIDDEN — Resource not accessible by integration` for a GitHub App, whatever its permission set. Whether the maintainer's *own* credentials could is **untested and deliberately so** — attempting it would resolve a live thread, which is an action on the merge gate. It is beside the point anyway, because this is the one row where the split is right on the merits and not only on capability: a reply is *what the agent says*, while resolving is *the judgement that a review point is settled*, and this repository requires conversation resolution before merge, which makes it part of the merge gate rather than part of the conversation. |
| Everything Gated above — settings, releases, merges | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval | The agent identity's token cannot do these at all — that half is a platform refusal and is the load-bearing one. The other half is a *prohibition*: an agent running with the maintainer's credentials can call most of these, so what stops it is the Gated tier's header, not the platform. This cell read "**The maintainer**, by hand", which stated impossibility where the truth is authorization — corrected 2026-07-27, the same conflation proposal [`0006`](proposals/0006-dependabot-security-updates.md) shipped and had to fix, here in the file that defines the tier. |

Note the asymmetry, because it looks inconsistent until you say it out loud: the commit record must stay
*his* and the conversation must stop being his. Attribution is not one principle applied uniformly — it is
*who actually did this*, and the honest answer differs by artifact.

What makes the commit half honest rather than the same convention-reliance rejected for comments is that
**every merge is Gated**: the maintainer approves each one, so his name on a commit that reached `main`
records a decision he actually took, with the agent's hand marked by the `Co-Authored-By` trailer.

_This paragraph said "every push is Gated" until 2026-07-27, and the difference matters more than the word
does. Push was the wrong anchor: a commit's author is fixed when it is written, and a commit on an unmerged
working branch is not part of this repository's record — so approving the push guaranteed nothing that
approving the merge does not guarantee later and better. The guarantee was always at the merge; the push gate
was standing in front of it. Corrected when working-branch pushes moved to Auto, because a rule whose stated
reason has moved is a rule that will be defended on the wrong grounds._

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

| Setting | Value | Configured in |
|---|---|---|
| Direct pushes | rejected — every change goes through a pull request | classic branch protection |
| Required status check | `workspace-verify` — the workspace's verify recipes, run by CI; pinned to app 15368 | classic branch protection |
| Administrators | **included**; the maintainer has no exemption | classic branch protection, `enforce_admins` |
| Required approving reviews | 0 — see below | classic branch protection |
| Conversation resolution | required before merge | classic branch protection |
| Force-pushes and branch deletion | blocked | classic branch protection **and**, separately, the organisation ruleset below |
| SHA-pinned Actions | **required, and enforced by the platform** — `sha_pinning_required: true` | organisation *and* repository Actions policy |

Verified rather than asserted: a direct push to `main` was attempted after the change and rejected with
*"Changes must be made through a pull request."* This is the first gate in the repository that holds
against the agent, the maintainer, and any future collaborator equally — the difference between a rule
and a rail.

**The floor is three layers, and this section used to describe only one.** Recorded 2026-07-27, after an
audit prompted by an unrelated question found the table claiming to say what `main` enforces while omitting
two mechanisms that also enforce it. The errors ran in *both* directions, which is why the audit was worth
more than the patch:

1. **Classic branch protection** — every row above attributed to it. Read at
   `repos/{owner}/{repo}/branches/main/protection`.
2. **An organisation ruleset** — `default-branch protection (all repos)`, id `19450244`, active since
   2026-07-21, targeting `~DEFAULT_BRANCH` on `~ALL` repositories, with the rules `deletion` and
   `non_fast_forward`. It re-makes two guarantees classic protection already makes, and it carries a bypass
   for `OrganizationAdmin` with `bypass_mode: always`. Read at `orgs/{org}/rulesets/{id}`. It is not
   something this repository configured and does not present itself as this repository's, which is most of
   why it went unnoticed for six days.
3. **The Actions SHA-pinning policy** — `sha_pinning_required: true`, set at both organisation and
   repository level. This one was *understated* rather than missing: everything here has been calling SHA
   pinning "the organisation's policy", language that reads as a convention people comply with, when the
   platform refuses unpinned actions outright. It is a rail, and it was written down as a habit.

**An honest limit, because the inference is load-bearing.** GitHub documents that rulesets and classic
branch protection *aggregate*, with the most restrictive version of each rule applying — so
`enforce_admins: true` should still bind an organisation admin even though the ruleset would let one past
its own `non_fast_forward` rule. What GitHub does **not** document is how ruleset bypass actors interact
with `enforce_admins` specifically, and **that interaction is untested here.** The direct-push rejection
above is not evidence for it: that exercised classic protection, not the bypass. The test that would settle
it is a force-push to `main` by an organisation admin, and it is deliberately not run — the only way to
attempt it is to offer a rewritten history, and the cost of being wrong is `main`.

So the position to hold is that the floor is very probably intact and one layer of it is unverified. That
is a weaker claim than this section made before the audit, and it is the accurate one.

**A second ruleset exists and is deliberately not part of the floor.** `copilot auto-review on pull
requests` — id `19805871`, repository-sourced, added 2026-07-27 — targets the same `~DEFAULT_BRANCH` and
carries the single rule `copilot_code_review`, so every pull request gets a Copilot review requested without
anyone remembering to ask. It is recorded here because anyone auditing `repos/{owner}/{repo}/rulesets` will
now find two and needs to know which is which.

It gates nothing directly: required approving reviews remain 0, and a Copilot review arrives as `COMMENTED`
rather than as an approval. The honest qualification is that it can still decide whether a change lands —
conversation resolution is required on `main`, so a Copilot review that leaves an inline comment opens a
thread that blocks merge until the maintainer resolves it, which is exactly what happened on
[#25](https://github.com/sleepy-panda-works/portulan/pull/25). Not a gate, then, but upstream of one.

It was added while this section was being written, which is as good an illustration as the section could
ask for of why the layers needed counting in the first place.

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
maintainer re-pointed protection himself (Gated — the one step no agent may take on its own), and only then was the
transitional job deleted. See
[`proposals/0004-ci-runs-every-declared-recipe.md`](proposals/0004-ci-runs-every-declared-recipe.md).

The check is also **pinned to app 15368** (GitHub Actions). Without an app id, any GitHub App reporting a
check of that name would satisfy the gate — a distinction the branch-protection UI does not surface, and
one the API does.

**`CODEOWNERS` exists as of milestone 3 — and it is not yet part of the floor.**
[`../CODEOWNERS`](../CODEOWNERS) records who owns which paths and routes review requests. Every path is
owned by the org team **`@sleepy-panda-works/maintainers`** rather than by a person: the team was created
visible, granted write on this repository, and only then referenced — that order matters because every
way of getting it wrong is silent, since GitHub *skips* an invalid owner line rather than refusing it,
leaving the paths it named unowned while the file still reads as complete. Naming a team means the day a
second reviewer arrives is a membership change rather than an edit to eleven lines, and it keeps the one
file most likely to accumulate personal handles from carrying any. It does not
block anything, because *Require review from Code Owners* is **off** in branch protection, deliberately:
GitHub does not permit anyone to approve their own pull request, this repository has one human, and
`enforce_admins` gives him no exemption — so requiring a code owner's approval would require an approval
nobody present can give, and nothing would ever merge. That is the same arithmetic behind the 0
required-reviews decision above.

So the honest position is unchanged where it counts: [`../docs/vision.md`](../docs/vision.md) is still
protected by the prohibition above and **not** by the platform. What the file adds today is that
ownership is written down; what it adds later is a rail, on the day a second reviewer exists and the
setting can be switched on. That switch is a repository-settings change — Gated.

**The floor now watches what the repository pins**, as of 2026-07-27, per
[`proposals/0006-dependabot-security-updates.md`](proposals/0006-dependabot-security-updates.md):

> Every dependency the repository pins is watched for published advisories by the platform, not by
> whoever remembers to look. Dependabot alerts and security updates are on, and the dependency graph that
> feeds them is on. A pin that cannot move on its own requires something that can tell you when it should.

The occasion was a SHA-pinned `actions/checkout` that declared a deprecated runtime for as long as GitHub
had been deprecating it, with the warning in a green run's log as the entire notification mechanism. SHA
pinning is the organisation's policy and the policy is right; **a SHA pin is also by construction a pin
that never moves**, so what closes the tag-hijacking hole opens a staleness one in its place, and the
mandate was adopted with nothing paired to it that could answer for the drift
([`memory/a-mandate-nothing-checks-is-already-broken.md`](memory/a-mandate-nothing-checks-is-already-broken.md)).

Three settings, and they chain — the graph feeds alerts, alerts feed security updates, so enabling only the
last does nothing. Each is a repository-settings change and therefore **Gated**. Worth stating precisely,
because the short version of that sentence drifts into a stronger claim than it can carry: the *agent
identity's* token cannot touch repository settings at all, but of the three only the dependency graph has
no repository-level REST endpoint. Alerts and security updates are both reachable by any admin-scoped
token — including the maintainer's own credentials, which this repository already routes every commit
through. Two of the three are withheld by the gate rather than refused by the platform, and a gate map
that blurs those two has mislaid the distinction it exists to record.

**What it buys today is one watched dependency**, and the count belongs in the record rather than rounded
up: [`../.github/workflows/verify.yml`](../.github/workflows/verify.yml) is the only manifest in the tree,
`actions/checkout` the only entry in it, and there is no `package.json` and no lockfile. The mechanism is
the point and not the count — but a floor described as broader than it is would be the same drift this
rule was added to catch.

**A watcher earns its place by being watched**, as of 2026-07-27, per
[`proposals/0007-every-watcher-ships-with-its-observation-procedure.md`](proposals/0007-every-watcher-ships-with-its-observation-procedure.md):

> A watcher earns its place by being watched. Anything added here whose job is to notice something — a bot,
> a scheduled job, a required check, an alert, a review request — ships with the procedure that would
> demonstrate it works, and that procedure is run once and its result recorded. Where no such procedure
> exists, the artifact says so in as many words, and says that its own silence is not evidence.

The occasion was a watcher adopted because nothing was watching, which nothing then watched.
[`../.github/dependabot.yml`](../.github/dependabot.yml) landed to catch drift in the Actions pins and for
five days had no evidence behind it at all: version-update jobs have no REST endpoint, no `dependabot` check
run appeared, and the pin already sat on the newest release, so the correct behaviour was to open nothing.
**Success and failure produced the same silence** — the same shape as the incident that prompted the watcher.
Third instance of
[`memory/a-mandate-nothing-checks-is-already-broken.md`](memory/a-mandate-nothing-checks-is-already-broken.md)
in one subject area, and the first where the unchecked mandate was itself a checker.

Three watchers were made to produce a positive signal on the day the rule was adopted, and those are the
worked examples of what the rule asks for:

| Watcher | The procedure that was actually run |
|---|---|
| Dependabot version updates | the pin was deliberately regressed one patch to v7.0.0; Dependabot opened the bump back to v7.0.1, and merging that was simultaneously the proof and the revert |
| Dependency graph, alerts, security updates | the SBOM went `404` → `200`, and then tracked a pin *through a change* — which the first reading alone could not have shown |
| Copilot auto-review ruleset | recorded as unvouched-for with its test stated in advance — the first pull request opened after `09:30:38Z` — and Copilot was then requested on that pull request at open, unasked |

**The honest limits, because the rule is weaker than it sounds.** Nothing here checks it: whether a watcher
works is a fact about live services, and `doctor` already reports live settings as something it does not
fetch. What makes it more than taste is that it asks for an *artifact* visible in a diff — either a stated
procedure or a sentence admitting there is none — so a reviewer can require it where no script can. And not
every watcher can be forced red safely: this one could, at a cost of one patch and a few minutes of a
required check running an older action, while a watcher for something destructive, rate-limited, or
irreversible may have no safe red test at all. The rule prefers evidence and settles for an admission, and
it should not pretend those are equal.

One corollary learned the same day, and left in
[`../.github/workflows/verify.yml`](../.github/workflows/verify.yml) where it will be tripped over:
**a mechanical revert is not a narrative revert.** Dependabot rewrote the pin and could not rewrite the
paragraph describing the pin, so `main` briefly carried a deliberate-regression notice above a line that no
longer matched it — a false claim produced by the fix working exactly as designed. When a bot rewrites a
value, the prose around it is the half nothing checks.
