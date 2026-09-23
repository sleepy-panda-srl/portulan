# Gate map — what an agent may do in this repository

> The **policy** half of [`../core/operating/autonomy.md`](../core/operating/autonomy.md). Core defines
> the tiers — Auto, Propose, Gated, Prohibited — as universal mechanism; this file binds *this repository's* concrete
> actions to them, because which action is dangerous is a property of the team, not of the engine.

## How to read this map

This file is the index a session reads at boot: each gate with its rule, under its tier, and the rules a
session holds whether or not it is on a gate's path. The rest of each tier and topic, its conditions,
measurements, amendments and reasons, is in one file under [`gate-map/`](gate-map/), and every line here that has
more links straight to it. **Open the linked text before acting on what it covers**: a merge, a release, a
settings change, a branch deletion, a review round, or an edit to what a gate guards. Where a rule says
*this gate map*, it means this index and those files together. Nothing is kept in both beyond a hole's
title and an identity row's action, which name what the on-read text continues.

## Where the policy actually lives, since milestone 4

**This gate map is the rationale. [`gates.json`](gates.json) is the policy.** Each bullet below carries the
`rule-id` of the rule that enforces it, and the two are checked against each other **both ways** — a rule
here with no id, or an id here that no rule declares, fails the suite. *(The reverse direction has a
boundary worth knowing: it recognises a citation by its shape, three or more hyphenated segments in a code
span, so a two-segment invention would not be caught. Measured at the pre-commit checkpoint, and stated
rather than tightened — an allowlist of every non-rule term in this file would need maintaining, and a
checker nobody maintains is the fail-open one step later.)* That is deliberate and it is the
narrow thing a checker can actually hold: two files stating one policy is this repository's signature
defect, and *"the gate map is the compiler's input"* — which this paragraph replaced — had been false from
the moment a separate policy file existed.

What no check here can hold is whether a *sentence* below contradicts the rule it names. Prose about a
fact is outside what a claims lint sees, the same boundary that let this file claim the agent identity did
not exist for hours after it did. So: **where they disagree, `gates.json` is authoritative**, because it is
the one that compiles.

Two tiers below compile to nothing at all, on purpose, and the compiler prints them as refusals rather than
passing over them in silence — see [What the compiler refuses](gate-map/compiler.md).

## The tiers, bound

### Auto — the agent acts unattended

Recoverable and reversible. **Nothing here lands on `main`, and nothing here asks a person for anything** —
no decision is requested, so nothing waits on one.

- `read-anything-in-the-repository` — including git history.
- `edit-on-a-working-branch` — create and edit files on a working branch, in a worktree.
- `run-a-verify-recipe` — [`verify/docs.sh`](verify/docs.sh) or any read-only shell command.
- `commit-to-a-working-branch` — never to `main`. **Unattended is not unchecked:** the commit-time
  obligations stand — the **pre-commit scan** ([`dod.md`](dod.md) condition 5, which this file elsewhere
  calls the *seam scan*; one obligation, two names, and the condition number is the carrier) and, when
  the work is full-lane, the pre-commit checkpoint
  ([Supervised-build checkpoints](#supervised-build-checkpoints)) — because a tier says who must attend
  an action, not what the session owes before it. Ruled on
  [#174](https://github.com/sleepy-panda-srl/portulan/issues/174), recorded as
  [`proposals/0024`](proposals/0024-a-tier-says-who-attends-a-checkpoint-says-what-is-owed.md).
- `push-a-working-branch` — **to `origin`, including its first push.** Never `main`, which the platform
  refuses anyway. Why this stopped being Gated, and what that costs: [`gate-map/auto.md`](gate-map/auto.md). Force-pushing a working branch is included,
  with `--force-with-lease` rather than `--force`: the lease refuses the push if the remote moved since it
  was last fetched, which is the difference between rewriting your own history and silently discarding
  someone else's. Bare `--force` on a shared remote is the one part of this that is not recoverable inside
  a working copy, so it does not belong in this tier — it is `force-push-without-a-lease`, Gated below.
- Draft memory entries, task files, handoffs, and proposals. _(Covered by `edit-on-a-working-branch`.)_
- Delegate to a subagent persona ([`../core/personas/`](../core/personas/)). _(No tool-level rule: which
  subagents exist is the plugin's business, not the gate policy's.)_

### Propose — a human or an eval gate reviews before it counts

Reversible but consequential: it changes what the repository says, or how it behaves.

- `open-a-pull-request`. **An agent never merges its own pull request on its own authority** — what
  stays forbidden is an agent deciding for itself that a change is ready to land. Merging itself is
  Gated below, and as that tier's header says, the gate is the maintainer's decision rather than his
  keystroke: he may review a pull request and then instruct an agent to perform the merge. Default
  when nothing is said: open the pull request and hand it over.

  **It is opened with a label** — at least one from [`labels.json`](labels.json), in the `gh pr create`
  command rather than remembered afterwards. The maintainer's ruling, 2026-07-27, taken when 45 pull
  requests had produced exactly one label and Dependabot had applied it.
  [`../.github/workflows/pr-labels.yml`](../.github/workflows/pr-labels.yml) checks it and
  [`memory/every-pull-request-carries-a-label.md`](memory/every-pull-request-carries-a-label.md) carries
  the reasoning. Which label is right is judgement; that there is one is not.

  Since 2026-07-29 an agent-driven pull request also carries **`agent-driven`** — **beside its area
  label, never instead of one**. It comes from [`labels.json`](labels.json)'s separate *ownership*
  vocabulary, which answers *who drives this* rather than *what it touched*, and is invisible to the
  at-least-one check by construction. The maintainer's ruling (2026-07-29, verbatim: *"go with option
  B, wire the agent-driven label"*): ownership rides authorship — the assignee field cannot take an
  App's name, per the measurement recorded in [*Which identity acts*](gate-map/identity.md) — and
  the label is what makes it filterable. The librarian applies it mechanically to the pull request
  nobody is present to open; a session applies it in its `gh pr create`.
- `change-doctrine` — [`../core/`](../core/), a template, a persona, or a skill.
- `change-this-workspace` — anything here, including this file and [`gates.json`](gates.json).
- `change-the-plan` — the milestones and their Status column in [`../docs/plan.md`](../docs/plan.md).
- `change-a-verify-recipe` — and *relaxing* a check is the case to scrutinise hardest, because it is the
  one change that makes every future "green" mean less.

**An idea that adds an axis, a mode, or a surface starts as a proposal.** It is written into
[`proposals/`](proposals/) and ruled on there — never opened as an implementation pull request with
tests. [Why, and what building first cost](gate-map/propose.md).

### Gated — explicit human approval, per action, before it happens

Outward-facing or hard to undo. The agent prepares the action and asks; it does not proceed on inference,
and approval for one action never generalises to the next.

**The gate is the maintainer's decision, not his keystroke — and that governs every action in this tier**,
not only the merge it was first written about. He may approve in conversation and then have an agent run the
command; that is the gate working, not a bypass. What the tier forbids is an agent deciding for itself that
approval was implied, or treating one approval as standing permission. Default when nothing is said: prepare
the action, ask, and wait.

_Why this header governs every action in the tier, and whose credentials run one:
[`gate-map/gated.md`](gate-map/gated.md#why-the-header-governs-every-action-in-this-tier)._

**Composed into this tier: `commit-without-the-hooks`** — contributed by the `rituals/checkpoints` pack
rather than declared in [`gates.json`](gates.json), and **as of 2026-08-14 it carries no matcher at all.**
Gated for the reason the pack gives, restated **whole** and not measured here: bypassing the local hooks
**by any spelling** turns a compiled gate back into a convention on a workspace that compiles its gate
policy *into* those hooks — and if the hooks are wrong, change the policy through the evolution gate rather
than stepping around it for one commit, because a bypass leaves no trace in the record that a policy change
would have left. _(That second clause is the what-to-do-instead, and this file carried only the first half
until 2026-08-14 — restating half a reason is the same half-copy defect the repository keeps finding.)_

_Why it compiles to nothing, and why it was listed late:
[`gate-map/gated.md`](gate-map/gated.md#commit-without-the-hooks-composed)._

- `merge-a-pull-request`, and `delete-a-remote-branch` — which is a push, and is the one push spelling
  that did not move to Auto, because it destroys a ref on a shared remote rather than adding one.

  **What that tier does NOT cover, ruled 2026-08-14 and sharpened 2026-08-17.** The rule protects a
  **shared** ref — one other people, or the platform, may be **relying on**. Two conditions, and **both**
  must hold before a deletion is outside this gate:

  > **1. You created the branch**, and **2. deleting the ref destroys no work that exists nowhere else.**

  Fail either, or be unable to establish either, and it stays Gated. *Unsure resolves to Gated rather
  than to convenience.*

  How to establish each condition, and why neither has a shortcut:
  [`gate-map/gated.md`](gate-map/gated.md#merge-a-pull-request-and-delete-a-remote-branch).

  **The merge carries a precondition the approval does not waive: the head must not be behind `main`.**
  Sync first — `git rebase origin/main`, then `git push --force-with-lease`, both Auto — let
  `workspace-verify` re-run, and merge after that. The condition is one command —
  `gh api repos/{owner}/{repo}/compare/main...<head> --jq .behind_by`, and zero is the only acceptable
  answer. Why, and why it is also a rail:
  [`gate-map/gated.md`](gate-map/gated.md#the-merge-precondition).
- `force-push-without-a-lease` — bare `--force`. `--force-with-lease` is Auto above; the lease is the
  whole difference, and it is why these are two rules rather than one with a caveat.
- `change-repository-settings` — **visibility above all**. `gh repo edit` and nothing beside it now:
  branch protection, collaborators and rulesets are changed through `gh api`, which is **no longer
  gated** — see [the amendment](gate-map/gated.md#the-gh-api-amendment). So this rule's matcher is narrower than the settings surface its
  name suggests, which is said here rather than left to be inferred, because a sentence broader than its
  matcher is exactly the defect this section refuses elsewhere.

  What stands where the `gh api` gate stood, measured:
  [`gate-map/gated.md`](gate-map/gated.md#change-repository-settings).
- `create-a-repository` and `delete-a-repository`. `rename-or-transfer-a-repository` is named too and
  compiles to **nothing** — a transfer is ordinarily a web-UI action and no permission rule reaches it.
- `tag-a-release` and `publish-a-release`; `publish-to-a-package-registry`, which covers a plugin
  marketplace.

  **From milestone 8 these carry an obligation as well as a tier, and it is SPLIT between a rail and a
  person because the two halves are answerable at different times** — the shape [the drill calendar](gate-map/platform-floor.md)
  already uses for its own halves. The obligation is `../docs/plan.md`'s Protocol → Versioning: *a
  release carries an eval result*.

  What the rail reaches and what the person owns: [`gate-map/gated.md`](gate-map/gated.md#releases).
- `spend-money-or-register-a-domain`.
- `send-something-outside-this-repository` on the team's behalf.

The last two compile to **nothing**, and the policy says why in its own words rather than leaving a
reader to notice the absence: neither has a tool-level surface a permission rule can reach. A matcher
pretending to cover "send a message outward" would be worse than the honest gap, because it would read
as enforcement. They stay prompt-level, and the compiler prints them as refusals on every run.

**Telemetry has a standing consent, ruled 2026-08-28, and it is the first reading this tier has been
given rather than a change to it.** Milestone 8's OTel clause put a second sendable artifact in the
tree, and `../core/operating/autonomy.md` holds that Gated is **per action** — so an emitter that sent
on its own after one approval would be outside this tier, while an emitter asking per export would be
unusable in the loop it measures. His ruling: **a committed opt-in config IS the consent for the
emission it enables.** What stays Gated and his alone is *committing a config that says
`enabled: true`*; each export then rides on that commit the way a compiled gate carries a tier without
asking again.

_The three rails that keep it from widening, and the `gh api` amendment:
[`gate-map/gated.md`](gate-map/gated.md#telemetrys-standing-consent)._

## Prohibited — what no yes makes acceptable

**Composed into this tier: `self-certify-a-checkpoint`** — contributed by the `rituals/checkpoints` pack
rather than declared in [`gates.json`](gates.json). Prohibited because a checkpoint graded by the context
that did the work is not a checkpoint: [`0018`](proposals/0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md)'s
rule given a tier — *no approval exists* for a session signing off on its own diff, which is why it is
here and not under Gated. [Why neither backend compiles it](gate-map/prohibited.md#self-certify-a-checkpoint-composed).

`edit-the-constitution` — [`../docs/vision.md`](../docs/vision.md) is the constitution, and it is
**human-owned**. No agent edits it — not with approval, not as a proposal that rewrites it in place. An
agent that believes the constitution is wrong raises the question with the maintainer and stops.

_Why this is a prohibition rather than Gated, and the shell half of its gate, which only the hook holds:
[`gate-map/prohibited.md`](gate-map/prohibited.md#edit-the-constitution)._

## What the compiler refuses

[`../cli/compile.mjs`](../cli/compile.mjs) turns [`gates.json`](gates.json) into
[`../.claude/settings.json`](../.claude/settings.json) — permission rules and hooks. Every rule ends in
exactly one of **compiled** or **refused with a stated reason**, and the counts are asserted by the suite,
because the distinctive failure of a compiler that emits gate machinery is a rule that goes in and nothing
comes out: the map reads as configured and the machine enforces nothing.

**The honest holes** are the cases no layer here enforces, so the agent holds the rule itself. Each line
below is that rule; the measurements and the argument for each are in
[`gate-map/compiler.md`](gate-map/compiler.md#the-honest-holes), which also carries the third outcome, the two
backends and what each refuses, the gates neither compiles, and composition.

1. **Spellings neither layer sees.** A gate binds the act, not its spelling: two shell wrappers, an
   interpolated heredoc target or variable, a command assembled at runtime, a quoted command
   substitution, a language runtime or a writer outside
   [the shell half's table](gate-map/prohibited.md#the-shell-half-and-why-the-strongest-rule-here-had-the-weakest-layer)
   writing the file, or `find -exec` and `xargs` running a writer, reaches neither layer, and none of
   them is a way past a gate.
2. **A gated command that was not the first word on the line.** The hook splits a line at its separators
   and nothing more: a leading assignment, `env` or `sudo`, a compound keyword, a loop body or a brace
   group still escapes it, and the permission rule matches only a command's start. A Gated command is
   Gated wherever it sits.
3. **A gate whose only layer is the hook — and the hook is the one that fails open.** The shell half of
   the constitution's gate is the hook alone, and an error in the hook removes that half while the
   `Edit` denial still stands. No shell command writes `docs/vision.md`, whether or not anything
   refuses it.
4. **A local `allow` rule beside the compiled gates is unmeasured.** What a broad allow in
   `.claude/settings.local.json` does to a wrapper spelling has not been measured, so a local allow is
   never approval for a Gated act.
5. **A rule whose sentence is broader than its matcher.** A gate reaches as far as its sentence, not as
   far as its matcher: `rename-or-transfer-a-repository` compiles to nothing, and a prompt that does not
   appear is not permission.
6. **This repository ships a wrapper of its own, and holes 1 and 4 meet in it.** No compiled rule sees
   [`tools/gh-bot`](tools/gh-bot), and on the maintainer's machine it runs unattended. It is for
   pull-request conversation, which is what the agent identity is for; what holds everything else is the
   App's permission set, not a matcher. A Gated act spelled through it is still Gated.
7. **A pack the hook cannot resolve, where `compile` can.** A gate composed from a pack found only in the
   plugin cache reaches `compile` and not the hook, so the hook's silence on a composed gate is not
   permission.
8. **A rule whose target is the whole repository matches nothing at runtime.** The two Auto rules written
   that way lose nothing, and `compile` refuses to run on a Gated or Prohibited rule whose target can
   never match, so a gate's target is a real path.
9. **A write gate's permission layer rests on one host behaviour.** On the host version measured,
   `Edit(path)` also stops `Write` and `NotebookEdit`; a later host could narrow that with nothing
   going red. A write to a gated path is gated whichever tool makes it.

## Which identity acts

| Action | Identity |
|---|---|
| Commits and pushes | **The maintainer's** git identity and credentials |
| Pull-request conversation — comments and review replies | **The agent identity**, via [`tools/gh-bot`](tools/gh-bot) |
| **Opening a pull request** — by a person or a session | **The maintainer's credentials**, with the body carrying an attribution line naming the agent |
| **Opening a pull request** — by the scheduled librarian | **The agent identity**, via an App installation token minted inside the workflow |
| **Committing and pushing a scheduled pass** | **The workflow**, as `github-actions[bot]` |
| **Filing an issue from `portulan feedback`** — by a person or a session here | **The maintainer's** GitHub credentials: the `gh` login already on the machine |
| **Resolving a review thread** | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval of the merge the thread blocks |
| **Requesting Copilot's review on a pull request a bot opened** | **The maintainer's** credentials, as a fine-grained token of his that [`copilot-request.yml`](../.github/workflows/copilot-request.yml) uses with nobody at a keyboard |
| Everything Gated above — settings, releases, merges | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval |

Who the three identities are, why each row is what it is, and why pull-request ownership is authorship
rather than assignment: [`gate-map/identity.md`](gate-map/identity.md).

## Merge discipline — the review is awaited, not just resolved

**A pull request may not merge until Copilot's feedback has been *awaited* and *resolved*.** The
maintainer's ruling, 2026-07-27, and the occasion is the useful part: browsing closed pull requests, he
found merges that had landed **before** Copilot's round on the final push arrived. The review was
requested, the review happened, and its feedback reached a pull request that was already closed — so it
was disregarded by nobody in particular, which is the worst way for it to happen.

**Amended 2026-09-23, his ruling of 17:21 UTC: no check awaits the round; the session that owns the pull
request does.** It awaits Copilot's round on the final head and says in its ready message which review, on
which commit, it addressed; conversation resolution still blocks a merge while a thread is open. Merging
without a round is his call, as he ruled at 14:07: *"This shouldn't be an error and it shouldn't cause the
CI to fail."*

What carries each half, the form of the ready line, the bounds on the loop, and what left with the check:
[`gate-map/merge-discipline.md`](gate-map/merge-discipline.md).

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

**Core states the obligation; this section binds it.** Since 2026-07-30 the full lane's verdict comes
from a context that has not seen the implementation
([`../core/operating/loop.md`](../core/operating/loop.md)), and the three-moment cycle is doctrine an
adopter receives ([`../core/operating/evolution.md`](../core/operating/evolution.md)). What core
deliberately does **not** supply is everything below: which work crosses the threshold, who grades, and
in what vocabulary. **Those are this workspace's to set**, and the table restates nothing core says — it
names the moments in this repository's own words.

Three moments from [`../docs/plan.md`](../docs/plan.md), each requiring a supervisor in a **fresh context**
that has not seen the implementer's window:

| Checkpoint | When | What it grades |
|---|---|---|
| Session-open | before implementation starts | the session plan, against the constitution and the plan |
| Pre-commit | when the work is finished, before it is committed | the diff, against the milestone's exit criterion |
| Milestone-close | before a milestone is marked done | that the criterion was *demonstrated*, not asserted |

If supervision is unavailable in a session, that is stated plainly and the maintainer reviews the diff.
A milestone is never self-certified.

**The tiers above do not move these moments — ruled 2026-08-09 on
[#174](https://github.com/sleepy-panda-srl/portulan/issues/174), recorded as
[`proposals/0024`](proposals/0024-a-tier-says-who-attends-a-checkpoint-says-what-is-owed.md).**
`commit-to-a-working-branch` and `push-a-working-branch` are Auto, and the pre-commit verdict is still
owed before finished full-lane work is committed: a tier says who must attend an action — no person, for
those two — while this table says what the session owes before it acts, the same coexistence the seam
scan has always had with commits being Auto.

**Doctrine, tier and floor work takes a checkpoint even when no row moves.** Work that touches
**doctrine, the autonomy tiers, or the platform floor** takes a **fresh-context pre-commit
checkpoint**, even when no milestone row moves. [`dod.md`](dod.md) condition 7 carries the obligation
and cites this sentence for the trigger.

**Session-open runs `clarify` against the milestone row itself.** When a row's criterion reads two ways,
the criterion is an **input** to the ritual, not merely its context.

_Both sentences are the maintainer's, taken 2026-07-28 on the two-day review's R3. Neither is enforced by
machinery today: like the checkpoint table above them, they are read and honoured rather than compiled,
and the audit behind the first is the Dependabot arc named in [its reason](gate-map/checkpoints.md#doctrine-tier-and-floor-work) rather than a sweep of every past
session._

_The reading the first ruling retires, and the incident behind each of the other two:
[`gate-map/checkpoints.md`](gate-map/checkpoints.md)._

## The platform floor

Core calls the platform floor the gate no prompt can bypass
([`../core/operating/autonomy.md`](../core/operating/autonomy.md)). **On this repository it is now
configured**, as of 2026-07-25, per
[`proposals/0001-platform-floor-on-main.md`](proposals/0001-platform-floor-on-main.md). What `main`
enforces:

| Setting | Value | Configured in |
|---|---|---|
| Direct pushes | rejected — every change goes through a pull request | classic branch protection |
| Required status checks | `workspace-verify` — the workspace's verify recipes — and, since 2026-07-27, `pr-labeled` — every pull request carries a label from the declared set. Both run by CI and both pinned to app 15368 | classic branch protection |
| Administrators | **included**; the maintainer has no exemption | classic branch protection, `enforce_admins` |
| Required approving reviews | 0 — see [`gate-map/platform-floor.md`](gate-map/platform-floor.md) | classic branch protection |
| Conversation resolution | required before merge — every thread *resolved*, which is not *adjudicated*; see [`gate-map/platform-floor.md`](gate-map/platform-floor.md) | classic branch protection |
| Branch up to date with `main` before merging | **required** since 2026-07-27 — `strict: true`; a behind pull request reports `BEHIND` and cannot merge | classic branch protection, `required_status_checks.strict` |
| Force-pushes and branch deletion | blocked | classic branch protection **and**, separately, the organisation ruleset in [`gate-map/platform-floor.md`](gate-map/platform-floor.md) |
| SHA-pinned Actions | **required, and enforced by the platform** — `sha_pinning_required: true` | organisation *and* repository Actions policy |

How each row was verified and where it is weaker than it reads, the three layers under the table, the
floor's compiled form, `CODEOWNERS`, and the watchers on what the repository pins:
[`gate-map/platform-floor.md`](gate-map/platform-floor.md).
