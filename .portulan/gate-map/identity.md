# Which identity acts — who, and why

> The rest of the gate map's [identity table](../gate-map.md#which-identity-acts), which says who performs each act.
> This file says why, and what holds it.

**Three** identities operate on this repository, and which one acts is not a detail — the record of who
did what is the thing the whole gate map exists to keep honest. The third arrived on 2026-07-28 with the
scheduled librarian and acts with nobody at a keyboard: the **workflow**, which commits and pushes as
`github-actions[bot]` under the repository's own `GITHUB_TOKEN`, and since 2026-09-24 keeps the pass's
report in one standing issue. It is listed because an unattended actor
left off this table is exactly the drift the table exists to catch. For the same reason the table has
carried, since 2026-09-23, the one act the maintainer's credentials perform unattended: requesting
Copilot's review on a pull request a bot opened.

| Action | Why |
|---|---|
| Commits and pushes | The build's provenance discipline requires his authorship on the commit record. An agent co-authoring is fine and already conventional; an agent *replacing* him there is not. |
| Pull-request conversation — comments and review replies | A reply written by an agent and posted through the maintainer's credentials makes the conversation read as human when it is not, and the reader cannot tell. See [`memory/agent-activity-is-attributable.md`](../memory/agent-activity-is-attributable.md). |
| **Opening a pull request** — by a person or a session | The practice, not a platform limit any more. It is the one this repository used before the App existed: post under his name and *say so in the artifact*, which serves the rule's actual purpose — a reader can tell. Conversation on the pull request still comes from the bot. |
| **Opening a pull request** — by the scheduled librarian | The one artifact nobody is present to open, so *say so in the artifact* has nobody to say it. Creating a pull request needs repository-**contents** read, which this App is refused — GitHub answers `not all refs are readable` (HTTP 422), measured 2026-07-26 opening [#18](https://github.com/sleepy-panda-srl/portulan/pull/18). [`proposals/0015`](../proposals/0015-the-librarian-files-as-the-agent.md) reverses that on the maintainer's ruling of 2026-07-28; **the ruling is recorded and the setting is his to apply**, so this row describes the design while the live permission set is read back at the supervised checkpoints and never from here and records what the earlier reasoning got wrong: it priced `contents` as *the ability to write code*, which **read** is not, and it was written while this repository was private. Write is still refused, so "the permission set is the enforcement, not the wrapper" is unchanged. The alternative was worse than it looks — `GITHUB_TOKEN` opening the pull request starts no `pull_request` runs at all, so the two required checks never report and the thing can never merge. |
| **Committing and pushing a scheduled pass** | The identity that actually pushes, named as itself. Committing as the maintainer would be fabricated contemporaneity — he was not there — and committing as `portulan-agent[bot]` would be worse: that App holds no `contents` write and could not have pushed this. The row above it stays true of everything a person or a session commits. What keeps this honest without his authorship is the same thing that keeps the row above honest *with* it: the merge is Gated, so nothing an unattended pass writes reaches `main` without his decision. |
| **Filing a scheduled pass's report** — one standing issue, opened once and edited by each pass | Added 2026-09-24, the maintainer's choice once the pass stopped writing a handoff: a pass that changes nothing opens no pull request, and a report left in a run's summary reaches no one who does not open the run. **No new identity**: the workflow that already pushes a pass files it, with `GITHUB_TOKEN` and `issues: write`, because nothing has to run on an issue event, so the recursion guard that keeps the pull request with the App costs nothing here. The App was not widened: it holds no Issues permission, and widening it is a gate-policy change ([`../tools/README.md`](../tools/README.md)). The body is replaced by each pass and never commented on, so it notifies no one: the issue is where the nags wait to be read, not a ping. |
| **Filing an issue from `portulan feedback`** — by a person or a session here | Added 2026-08-10 with the sender, because an act this table does not name is exactly the drift it was built to catch — and the answer is the one worth recording: **no new identity**. The tool operates no service and mints nothing; it shells out to whatever `gh` is logged in, so every issue is attributable to an accountable account and GitHub's own abuse limits apply. That is proposal [`0014`](../proposals/0014-a-feedback-pipe-points-out-of-the-seam.md)'s Q5(a), and it is why Q5(b) — a Sleepy-Panda-operated relay — stays unbuilt and constitutional. **The approval is the tool's rather than this table's:** `send` refuses without `--approve`, per send, never inherited from a draft or a preview. **The count above is unchanged**: an outside reporter running the same tool files under their own account, and that is not an actor on this team's behalf — this table's subject — any more than someone filling the web form is. |
| **Resolving a review thread** | Not the agent identity's **token** — the App, not the runtime the Identity cell means by *an agent's* — and that half is a platform refusal that still holds: `resolveReviewThread` returns `FORBIDDEN — Resource not accessible by integration` for a GitHub App, whatever its permission set. The maintainer's own credentials **can resolve a review thread** — measured 2026-07-27 on two Copilot threads on [#42](https://github.com/sleepy-panda-srl/portulan/pull/42), where resolution was a precondition of a merge he had already approved and the agent ran the command. This cell read "**The maintainer**, by hand" and called that question "untested and deliberately so"; the test arrived the only way it safely could, carried by an approved merge rather than sought for its own sake. The answer is the one row 223 already records: **impossibility stated where the truth is authorization**, and what stops an agent here is this row and the Gated tier's header, not the platform. The split is still right on the merits rather than only on capability — a reply is *what the agent says*, while resolving is *the judgement that a review point is settled*, and this repository requires conversation resolution before merge, which makes it part of the merge gate rather than part of the conversation. So the judgement travels **with** the merge approval, and never ahead of it: absent an approved merge there is nothing for an agent to resolve on. Measured once, with an admin account under `enforce_admins`; it says nothing about a non-admin collaborator's token. **And the requirement this row leans on is weaker than it reads.** `required_conversation_resolution` does not establish that a *human* judged a point settled: on [#44](https://github.com/sleepy-panda-srl/portulan/pull/44) the Copilot review bot — login *copilot-pull-request-reviewer* — raised a thread, and the account named `Copilot` resolved it once a reply addressed it, so the party that made the objection cleared the gate on it, unasked. Read `resolvedBy` before reading a resolved thread as anyone's judgement. Two things this is not: the comment's author is typed `Bot` and the resolver `User`, so it does not contradict the App refusal above; and the platform does **not** auto-resolve a thread for going outdated — that was inferred here from a resolution landing beside an outdated flag, and `resolvedBy` is the field that disproved it. |
| **Requesting Copilot's review on a pull request a bot opened** | GitHub bills a review on a pull request a bot opened, and a review a bot requests, to the organisation, and nothing here pays that share; it attributes a review a person requests to that person (*About GitHub Copilot code review*, read 2026-09-23). So unless the organisation pays, the request has to be his, and the timeline line it writes reads as his click, while the workflow's run is the record that it was not. That is acceptable for this act alone because a review request says nothing and decides nothing: it asks for the round a person's pull request already gets. The token's *Pull requests: write*, the smallest permission that can request a reviewer, would also let it approve as him, so it is held in environment `copilot-request`, which he limits to `main`, and read only from `pull_request_target`, so no pull request can change what runs with it. The route that needs no token is the organisation paying, through its *AI credits paid usage* policy, and that is his decision. |
| Everything Gated — settings, releases, merges | The agent identity's token cannot **change** any of these — that half is a platform refusal and is the load-bearing one. The other half is a *prohibition*: an agent running with the maintainer's credentials can call most of these, so what stops it is the Gated tier's header, not the platform. This cell read "**The maintainer**, by hand", which stated impossibility where the truth is authorization — corrected 2026-07-27, the same conflation proposal [`0006`](../proposals/0006-dependabot-security-updates.md) shipped and had to fix, here in the file that defines the tier. **And the correction did not go far enough, in the direction it was already about.** It then read "cannot do these *at all*", which is false of reading: the App's `metadata: read` carries repository **ruleset reads**, and `GET repos/{owner}/{repo}/rulesets` through [`tools/gh-bot`](../tools/gh-bot) returned `200` on 2026-07-28 — while `branches/main/protection` returned `403`, so the surface is narrower than `gh api` and is not empty. The `gh api` gate covered reads on purpose while it stood, so this was a gap and not a technicality — and it is the read half that outlived the gate, since the wrapper still refuses it. Corrected 2026-07-28 by measuring rather than by re-reading: the permission set was recorded accurately below all along and the *inference* drawn from it here was too strong, which is the one drift a claims lint over this tree can never catch. |

Note the asymmetry, because it looks inconsistent until you say it out loud: the commit record must stay
*his* and the conversation must stop being his. Attribution is not one principle applied uniformly — it is
*who actually did this*, and the honest answer differs by artifact.

**Pull-request ownership is authorship, not assignment — and the assignee field cannot say otherwise.**
Measured 2026-07-29: only `marius-cetanas` is assignable on this repository. `portulan-agent[bot]` and
`Copilot` both answer 404 on the assignability check, and the assignee list has exactly one entry —
read-back `gh api repos/sleepy-panda-srl/portulan/assignees`, per-login check
`…/assignees/{login}`. A GitHub App's bot identity cannot be an assignee whatever its permission set:
the field takes user accounts with repository access and nothing else, so no setting this repository
controls changes the answer. The App-authored pull request therefore already carries the only
ownership mark the platform offers this identity — **authorship**, the attribution this table is built
on. If ownership-as-assignee is ever wanted anyway, both routes are the maintainer's to take, neither
an agent's: a machine-user account (a second credential to create, hold, and audit — priced before
wanted), or the status quo, authorship plus the declared label set. Nothing here substitutes for the
field, and this paragraph exists so the 404 is a recorded measurement rather than a surprise
re-discovered per session. **Ruled 2026-07-29** (the maintainer, verbatim: *"go with option B, wire
the agent-driven label"*): the status quo stands — authorship carries ownership, the machine-user
route is declined — and the [`agent-driven`](../labels.json) label from that file's ownership vocabulary
is the filterable mark; [the Propose tier](../gate-map.md#propose--a-human-or-an-eval-gate-reviews-before-it-counts) carries who applies it, and when.

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
conversation and nothing else. The wrapper's refusals — a few subcommands, and since 2026-07-28 an
allowlist of the API endpoints this identity is for — are a guard against habit and are trivially
bypassable.

_Precise about **writes**, and that precision is load-bearing rather than pedantic. The token also holds
`metadata: read`, which is a real read surface: repository ruleset reads ride on it. So "nothing else"
is true of what this identity can change and false of what it can see, and [hole 6](compiler.md#the-honest-holes) is where the
difference cost something._

**Live since 2026-07-25.** The App exists, is installed on this repository alone, and has posted its
first `portulan-agent[bot]` comment. Its permissions are pull-request conversation write and metadata
read; **repository contents is refused**, which is the load-bearing part — it is what makes the
permission set the enforcement rather than the wrapper. Setup and its honest limits are in
[`tools/README.md`](../tools/README.md).

_This paragraph read "the App does not exist" until milestone 2, session 2, by which time it had existed
for several hours. The change that brought it live updated `tools/README.md` and its handoff and not this
file — an ordinary miss, worth naming because it happened inside the milestone whose subject is claims
drift, and because the lint that milestone shipped **cannot catch this one**: it checks paths and a
status-check name against the tree, and "the App does not exist" is prose about a fact outside the tree
entirely. Found by grepping for stale claims by hand. That is the honest boundary of the machinery._
