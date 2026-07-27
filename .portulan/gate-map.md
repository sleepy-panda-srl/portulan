# Gate map — what an agent may do in this repository

> The **policy** half of [`../core/operating/autonomy.md`](../core/operating/autonomy.md). Core defines
> the tiers — Auto, Propose, Gated, Prohibited — and the modes — Auto, Gated, Strict — as universal
> mechanism; this file binds *this repository's* concrete
> actions to them, because which action is dangerous is a property of the team, not of the engine.
>
> **Tier and mode are different axes.** A tier says what an action is; a mode says how often this
> repository's development cycle stops for approval. Where both are in scope below, they are written
> "the Auto **tier**" and "Auto **mode**" — the bare word is always ambiguous.

## Where the policy actually lives, since milestone 4

**This file is the rationale. [`gates.json`](gates.json) is the policy.** Each bullet below carries the
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
passing over them in silence — see [What the compiler refuses](#what-the-compiler-refuses).

## The three modes

**This repository runs `auto`**, on the maintainer's ruling of 2026-07-27: **customer zero runs the most
autonomous mode.** The engine *ships* `gated` as its recommendation for everyone else
([`../core/operating/autonomy.md`](../core/operating/autonomy.md)); this workspace deliberately does not
take its own recommendation, because dogfooding the extreme is how the extreme gets tested and a setting
nobody runs is a setting nobody has checked. Declared in [`gates.json`](gates.json)'s top-level `mode` and
compiled into [`../.claude/settings.json`](../.claude/settings.json)'s `$portulan.mode`.

Two rules vary with the mode here, and only two:

| Rule | `auto` ← **ours** | `gated` (engine default) | `strict` |
|---|---|---|---|
| [`push-a-working-branch`](gates.json) | Auto tier | Auto tier | **Gated tier** |
| [`merge-a-pull-request`](gates.json) | Auto tier | **Gated tier** | **Gated tier** |

So: **Auto** raises no agent-side prompt anywhere in the cycle. **Gated** is autonomous until the merge,
which asks once. **Strict** asks before every push as well.

**What the declaration changed, as a diff rather than a reassurance.** It **removed one compiled gate**:
`Bash(gh pr merge:*)` is no longer in the artifact's `ask` list, so an agent running here is not prompted
before a merge. That single line is the whole of what the ruling changed in enforcement, and it is the
line to look at hardest. The mechanism was separately validated against the posture it replaced —
compiled at `gated`, the artifact was byte-identical to its predecessor plus one line — so the difference
visible here is the **ruling**, not the machinery.

### What a mode never touches: the platform floor

A mode changes how often *this loop* stops. It changes nothing the platform enforces, at any value:
branch protection, the required checks, `required_status_checks.strict`, required conversation
resolution and `enforce_admins` all hold identically at `auto` and at `strict`. That is the property
that makes offering `auto` defensible at all, and it is worth being precise about what it does and does
not buy on this repository:

- **Where a pull request carries an unresolved review thread**, it cannot merge until that thread is
  resolved. The agent *identity* — the App token — is refused `resolveReviewThread` by GitHub outright.
  But that is not the same as "no agent can clear it": an agent running with the maintainer's own
  credentials **has** resolved threads here, on his per-action approval (see
  [Which identity acts](#which-identity-acts)), and on
  [#44](https://github.com/sleepy-panda-works/portulan/pull/44) the Copilot reviewer resolved its **own**
  thread unasked. So this row stops a comment being *ignored*; it does not guarantee a human judged
  anything.
- **A Copilot review is *requested* on every pull request** by repository ruleset — **requested, not
  awaited.** Nothing today makes a merge wait for that round to land, and the floor section below says so
  in its own words: that ruleset "gates nothing directly". Naming this as a rail would be inventing one.
- **Where a pull request carries no thread at all**, nothing on the floor requires a human act, because
  required approving reviews are 0 (deliberately — see the solo-maintainer arithmetic below).

**So the honest statement is narrower than it is tempting to write:** `auto` moves this repository's last
*agent-side* checkpoint onto a floor that is **strong about process and weak about judgement**. A pull
request that draws a review comment still waits for a human to resolve it. A pull request that draws none
can land with no human act at all. Both of those are true, and the second is the one that must not be
left out of the sentence. _(A workspace declaring `auto` without conversation resolution, without a
required check, or with admin exemptions is declaring something quite different under the same word.)_

**Everything else in this file is mode-invariant** — repository settings, the two destructive push
spellings, repository creation and deletion, releases, package publication, spending, sending outward,
and the constitution. That is not an omission. Those are classified by undoability, and how often we want
to be asked about our own loop says nothing about whether deleting a repository is recoverable. A mode is
not a licence, and the suite asserts it: a test walks that list and fails if any of them stops being
Gated at any mode.

**The Prohibited tier is unreachable by any mode**, in either direction, enforced by the compiler rather
than promised. A mode-keyed tier naming `prohibited` fails the whole compile. A prohibition a setting
could switch off would be the Gated tier wearing its name.

### A session may tighten its own mode; it may not loosen it

`node cli/mode.mjs` reports the mode in force; `node cli/mode.mjs strict` tightens **this session only**;
`node cli/mode.mjs --clear` drops back to the default. It touches no tracked file — the record is
worktree-local session state in the OS temp directory, carrying the session that claimed it, invisible to
every other session, and inert once that session is gone. Same shape and same reasons as the Stop-gate's
counter in [`compile/stop.mjs`](compile/stop.mjs).

Loosening is refused, and the reason is a measurement rather than a preference: **the compiled permission
rules — the only layer that cannot fail open — were emitted at the default.** A session claiming to be
looser would still meet every prompt its mode promised to remove. That is a stated enforcer that is not
the real one, which is the defect
[`memory/a-stated-enforcer-must-be-the-real-one.md`](memory/a-stated-enforcer-must-be-the-real-one.md)
exists about. The second reason is independent and would be enough alone: an agent writes that file, and
editing on a working branch is in the Auto tier — so an agent that could loosen its own mode could
un-gate its own merge.

To loosen, change `mode` in [`gates.json`](gates.json) and recompile. That is `change-this-workspace` —
Propose, so a pull request, so a human. **The direction that needs a human keeps one.**

**Precedence, in one line:** _session override > workspace default; the Prohibited tier and every
mode-invariant rule above ignore both._

**What an auditor can reconstruct afterwards, stated precisely because the record discipline will ask.**
The tracked artifact at any commit names the mode that commit was compiled at, so `git log -p
.claude/settings.json` is the durable history of this repository's declared posture. It also **bounds**
every session that ran against that commit: because an override can only tighten, no session was ever
looser than the artifact says. What git cannot tell you is whether a particular session tightened —
that is untracked by design, and the honest mechanism for it is the same one that carries every other
"why": the session says so in its handoff. A tightening is worth a line there; the absence of a line is
not evidence either way, and this paragraph is the reason nobody should read it as such.

**What no mode touches at all: the platform floor.** Branch protection, the required check,
`enforce_admins` and conversation resolution hold identically at `auto` and at `strict`, because the
server enforces them rather than the run. That is the property that makes offering `auto` defensible.

## The tiers, bound

### Auto — the agent acts unattended

Recoverable and reversible. **Nothing here lands on `main`, and nothing here asks a person for anything** —
no decision is requested, so nothing waits on one.

That definition was rewritten on 2026-07-27, because the previous one — "recoverable and reversible inside a
working copy; nothing here reaches another person or a shared branch" — stopped being true the moment
working-branch pushes moved into this tier. A push does reach a shared remote. The tier's real boundary was
never the working copy: it is that an Auto action cannot change what the repository *is*, and cannot put
anything in front of anyone. A pushed working branch is visible and is not yet a claim on the repository. What
that visibility costs is stated below rather than defined away.

- `read-anything-in-the-repository` — including git history.
- `edit-on-a-working-branch` — create and edit files on a working branch, in a worktree.
- `run-a-verify-recipe` — [`verify/docs.sh`](verify/docs.sh) or any read-only shell command.
- `commit-to-a-working-branch` — never to `main`.
- `push-a-working-branch` — **to `origin`, including its first push.** Never `main`, which the platform
  refuses anyway. **Mode-varying**: Auto here at `auto` and `gated` modes, and in the Gated tier at
  `strict` — see [The three modes](#the-three-modes). See below for why this stopped being Gated.
  Force-pushing a working branch is included,
  with `--force-with-lease` rather than `--force`: the lease refuses the push if the remote moved since it
  was last fetched, which is the difference between rewriting your own history and silently discarding
  someone else's. Bare `--force` on a shared remote is the one part of this that is not recoverable inside
  a working copy, so it does not belong in this tier — it is `force-push-without-a-lease`, Gated below.
- Draft memory entries, task files, handoffs, and proposals. _(Covered by `edit-on-a-working-branch`.)_
- Delegate to a subagent persona ([`../core/personas/`](../core/personas/)). _(No tool-level rule: which
  subagents exist is the plugin's business, not the gate policy's.)_

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
on it — the seam scan is a **commit**-time obligation, and commits were already Auto — so nothing moves
from checked to unchecked. But the honest statement is that an unreviewed push publishes to a remote where
it is visible and may be cached or indexed.

**That revisit clause fired, and this is the answer to it.** The paragraph above used to end "judged
acceptable on a one-collaborator private repository and the thing to revisit first if either of those facts
changes." One of them changed on 2026-07-27, when the repository went **public** — and an unreviewed push
now publishes to a remote that is world-readable and permanently so. The clause did its job: it named in
advance the fact whose change would matter, and the fact changed.

The answer is **`strict` mode**, and it is a better answer than re-gating the push would have been. Re-gating
would have imposed one team's risk posture on every adopter of the engine and re-opened the misreading that
cost a session of hand-typed `git push` commands. A mode leaves the tier table intact and makes the
checkpoint a **setting** — so whoever wants the last human look before content leaves the machine turns it
on, per workspace or per session, and whoever does not is not taxed for it.

**What this repository itself runs on that axis went the other way.** The declared mode here is `auto`,
which leaves the push unattended and the merge unprompted as well. So the public flip did not buy this
repository a tighter push posture: it bought the **engine** a `strict` mode that any adopter can turn on,
and left customer zero deliberately at the loose end of its own axis. Moving to `strict` remains a
one-word edit to [`gates.json`](gates.json) plus a recompile.

The argument for it is the public flip. The argument against is that the two facts are about different
things, and the distinction is the one to keep straight: the confidentiality obligation rests on the
**seam scan**, a commit-time obligation unchanged at every mode, and not on anyone eyeballing a push.
`strict` buys a *review* checkpoint, not a confidentiality one.

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
- `change-doctrine` — [`../core/`](../core/), a template, a persona, or a skill.
- `change-this-workspace` — anything here, including this file and [`gates.json`](gates.json).
- `change-the-plan` — the Status column or the Session log in [`../docs/plan.md`](../docs/plan.md).
- `change-a-verify-recipe` — and *relaxing* a check is the case to scrutinise hardest, because it is the
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
commands back to the maintainer to type by hand, which is precisely the failure the original note
predicted in its own words: "an agent following it literally would have to refuse a direct
instruction from the person the rule exists to
protect." That note was right about the hazard and wrong about its scope — **a principle stated once, in a
neighbouring tier, does not reach the actions it was meant to govern.** The lesson generalises past this
file: where a rule and its clarification live apart, only the rule gets read.)_

- `merge-a-pull-request`, and `delete-a-remote-branch` — which is a push, and is the one push spelling
  that did not move to Auto, because it destroys a ref on a shared remote rather than adding one.

  **`merge-a-pull-request` is the mode-varying one**, and it is the step the modes are named around: Gated
  here at `gated` (the engine default) and at `strict`, and in the Auto tier at `auto` — **ours** — where a session ships with no
  agent-side prompt. `delete-a-remote-branch` is mode-invariant and stays Gated at every mode — deleting a
  ref is irreversible, which is a fact about the action rather than about how closely anyone is watching.

  **The merge carries a precondition the approval does not waive: the head must not be behind `main`.**
  Sync first — `git rebase origin/main`, then `git push --force-with-lease`, both Auto — let
  `workspace-verify` re-run, and merge after that. The approval is the maintainer's decision that the
  change should land; being in sync is what makes the green check describe the tree it will land *as*,
  since CI tests `refs/pull/N/merge` against `main` as it stood when the run happened and nothing re-runs
  it when `main` moves. The condition is one command —
  `gh api repos/{owner}/{repo}/compare/main...<head> --jq .behind_by`, and zero is the only acceptable
  answer. Reasoning and the local spelling:
  [`memory/a-branch-syncs-with-main-before-it-merges.md`](memory/a-branch-syncs-with-main-before-it-merges.md).
  **And this one is a rail, since 2026-07-27** — `required_status_checks.strict` is `true` on `main` (see
  the platform floor below), so a behind pull request reports `BEHIND` and the platform refuses the merge
  for the maintainer too. [`gates.json`](gates.json)'s reason states the precondition as well, which is a
  courtesy and not a second layer: on a bare `gh pr merge` the permission rule matches and the host
  discards the hook's sentence, so that reason reaches an agent only on the wrapped spelling — the
  measurement is in [`compile/gate.mjs`](compile/gate.mjs)'s own header.
- `force-push-without-a-lease` — bare `--force`. `--force-with-lease` is Auto above; the lease is the
  whole difference, and it is why these are two rules rather than one with a caveat.
- `change-repository-settings` — **visibility above all**. And `change-settings-through-the-api`,
  because branch protection and collaborators are changed through `gh api` rather than `gh repo edit`;
  this repository's own floor was configured that way, so a rule naming only the first would have had a
  sentence broader than its matcher.
- `create-a-repository` and `delete-a-repository`. `rename-or-transfer-a-repository` is named too and
  compiles to **nothing** — a transfer is ordinarily a web-UI action and no permission rule reaches it.
- `tag-a-release` and `publish-a-release`; `publish-to-a-package-registry`, which covers a plugin
  marketplace.
- `spend-money-or-register-a-domain`.
- `send-something-outside-this-repository` on the team's behalf.

The last two compile to **nothing**, and the policy says why in its own words rather than leaving a
reader to notice the absence: neither has a tool-level surface a permission rule can reach. A matcher
pretending to cover "send a message outward" would be worse than the honest gap, because it would read
as enforcement. They stay prompt-level, and the compiler prints them as refusals on every run.

## Prohibited — what no yes makes acceptable

`edit-the-constitution` — [`../docs/vision.md`](../docs/vision.md) is the constitution, and it is
**human-owned**. No agent edits it — not with approval, not as a proposal that rewrites it in place. An
agent that believes the constitution is wrong raises the question with the maintainer and stops.

_Why this is a prohibition rather than simply the Gated tier: every other change in this repository is
graded against that file. An agent that can edit the standard it is judged by can launder any other
change past its own grader, and the gate stops meaning anything._

Since milestone 4 this is a tier of its own — `prohibited`, not `gated` — in both [`gates.json`](gates.json)
and, as of the same session, [`../core/operating/autonomy.md`](../core/operating/autonomy.md). The distinction is load-bearing rather than decorative. Gated means *approvable
per action* and compiles to a prompt; prohibited means *no approval exists* and compiles to a flat refusal.
A three-tier policy would have had to file this under Gated, and the compiler would then have emitted a
prompt — turning "no agent edits it, ever" into "no agent edits it unless someone clicks yes". Found at the
session-open checkpoint, before the schema was written, by a supervisor counting the classes in this file
against the three the implementer had planned.

## What the compiler refuses

[`../cli/compile.mjs`](../cli/compile.mjs) turns [`gates.json`](gates.json) into
[`../.claude/settings.json`](../.claude/settings.json) — permission rules and hooks. Every rule ends in
exactly one of **compiled** or **refused with a stated reason**, and the counts are asserted by the suite,
because the distinctive failure of a compiler that emits gate machinery is a rule that goes in and nothing
comes out: the map reads as configured and the machine enforces nothing.

Three kinds of refusal, all printed on every run:

| Refusal | Why |
|---|---|
| tier `auto` | Unattended by definition. Emitting an `allow` rule would *loosen* a check rather than add one — the maintainer's ruling, 2026-07-27: the compiler only ever adds restriction. |
| tier `propose` | Enforced by the platform floor — pull request, required check, review — not by a permission rule on one machine. |
| action `none` | No tool-level surface exists. Spending money and sending something outward are the two here. |

**Two layers are emitted for every gate, and only one of them is the gate.** The permission rule holds;
the hook supplies the sentence. That split is forced by a measurement rather than chosen: on CLI 2.1.220 a
hook that *crashes* fails **open** — the tool proceeds — on the identical wiring that blocks when the hook
is healthy. A permission rule does not fail open. So [`compile/gate.mjs`](compile/gate.mjs) is written to
step aside silently on any internal error, handing the decision back to the layer that cannot be removed by
a syntax error.

**The honest holes, named because they are the ones to know.** Three of them, and the first is smaller than
an earlier draft of this paragraph claimed — that draft said the wrapper spelling "falls through to the
host's default mode", which was true *before* the hook existed and false of the shipped configuration. A
pre-commit supervisor measured it and found the hook's `ask` governing and its sentence reaching the agent.
Corrected here rather than left, because a gate map that overstates a hole is as wrong as one that hides it.

1. **Spellings neither layer sees.** The permission rule matches a literal prefix; the hook peels **one**
   shell wrapper. Two wrappers, a heredoc, an interpolated variable, or a command assembled at runtime
   reach neither. This is asserted as a test rather than only written down, so anyone tempted to call this
   layer a rail meets the counterexample.
2. **A local `allow` rule beside the compiled gates is unmeasured.** `.claude/settings.local.json` is
   git-ignored, so an adopter's own allow rules sit invisibly next to these. A compiled `deny`/`ask` beats
   an `allow` for the *same* pattern; what a broad local `Bash` allow does to the *wrapper* spelling has
   not been measured, and is not claimed either way.
3. **A rule whose sentence is broader than its matcher.** Guarded against by splitting rather than by
   trusting prose — `rename-or-transfer-a-repository` compiles to nothing and says so, rather than hiding
   inside a neighbour's matcher.
4. **A session can loosen its own *local* enforcement unattended, and the mode override is not the way it
   would.** [The three modes](#the-three-modes) says a session may tighten and never loosen, and that is
   true of the override mechanism. It is not a claim about the whole machine: editing
   [`gates.json`](gates.json) is `change-this-workspace` — Propose, which is a *review* obligation, not a
   runtime refusal — and the file is writable on a working branch, while `node cli/compile.mjs` is
   ungated. So an agent that decided to could rewrite the policy and recompile, and the local permission
   layer would follow it. **What catches that is the pull request**, where the diff shows both the policy
   and the regenerated artifact, plus `verify/compile.sh`, which fails if the two disagree. Named here
   rather than left implied, because "a session cannot loosen" is exactly the kind of sentence that gets
   read one clause wider than it was written. The honest form: *a session cannot loosen the mode without
   leaving the change in the diff.*

All of which is the same point: **this layer is a convenience above a rail, not the rail.** The rail is the
platform floor below, which refuses the push at the server regardless of what any local file says, and is
the only layer indifferent to how a command was spelled.

One qualification, added when this section met the floor audit below rather than left to read as stronger
than the floor now claims to be: that audit records the floor as **three layers with one of them
unverified** — the interaction between the organisation ruleset's bypass actors and `enforce_admins` is
undocumented and deliberately untested. So "the rail beneath this" is very probably intact and is not
certified. This layer being a convenience is unchanged either way; what changes is that neither layer
should now be described as unconditional.

## Which identity acts

Two identities operate on this repository, and which one acts is not a detail — the record of who did what
is the thing the whole gate map exists to keep honest.

| Action | Identity | Why |
|---|---|---|
| Commits and pushes | **The maintainer's** git identity and credentials | The build's provenance discipline requires his authorship on the commit record. An agent co-authoring is fine and already conventional; an agent *replacing* him there is not. |
| Pull-request conversation — comments and review replies | **The agent identity**, via [`tools/gh-bot`](tools/gh-bot) | A reply written by an agent and posted through the maintainer's credentials makes the conversation read as human when it is not, and the reader cannot tell. See [`memory/agent-activity-is-attributable.md`](memory/agent-activity-is-attributable.md). |
| **Opening a pull request** | **The maintainer's credentials**, with the body carrying an attribution line naming the agent | Not a choice either — the platform refuses it. Creating a pull request needs repository-**contents** read, and this App is deliberately refused contents: that refusal is what makes "the permission set is the enforcement, not the wrapper" true, so widening it to buy nicer attribution would trade the load-bearing guarantee for a cosmetic one. GitHub answers `not all refs are readable` (HTTP 422). Measured 2026-07-26 opening [#18](https://github.com/sleepy-panda-works/portulan/pull/18). The fallback is the one this repository used before the App existed: post under his name and *say so in the artifact*, which serves the rule's actual purpose — a reader can tell. Conversation on the pull request still comes from the bot. |
| **Resolving a review thread** | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval of the merge the thread blocks | Not the agent identity's **token** — the App, not the runtime the Identity cell means by *an agent's* — and that half is a platform refusal that still holds: `resolveReviewThread` returns `FORBIDDEN — Resource not accessible by integration` for a GitHub App, whatever its permission set. The maintainer's own credentials **can resolve one** — measured 2026-07-27 on two Copilot threads on [#42](https://github.com/sleepy-panda-works/portulan/pull/42), where resolution was a precondition of a merge he had already approved and the agent ran the command. This cell read "**The maintainer**, by hand" and called that question "untested and deliberately so"; the test arrived the only way it safely could, carried by an approved merge rather than sought for its own sake. The answer is the one row 223 already records: **impossibility stated where the truth is authorization**, and what stops an agent here is this row and the Gated tier's header, not the platform. The split is still right on the merits rather than only on capability — a reply is *what the agent says*, while resolving is *the judgement that a review point is settled*, and this repository requires conversation resolution before merge, which makes it part of the merge gate rather than part of the conversation. So the judgement travels **with** the merge approval, and never ahead of it: absent an approved merge there is nothing for an agent to resolve on. Measured once, with an admin account under `enforce_admins`; it says nothing about a non-admin collaborator's token. **And the requirement this row leans on is weaker than it reads.** `required_conversation_resolution` does not establish that a *human* judged a point settled: on [#44](https://github.com/sleepy-panda-works/portulan/pull/44) the Copilot review bot — login *copilot-pull-request-reviewer* — raised a thread, and the account named `Copilot` resolved it once a reply addressed it, so the party that made the objection cleared the gate on it, unasked. Read `resolvedBy` before reading a resolved thread as anyone's judgement. Two things this is not: the comment's author is typed `Bot` and the resolver `User`, so it does not contradict the App refusal above; and the platform does **not** auto-resolve a thread for going outdated — that was inferred here from a resolution landing beside an outdated flag, and `resolvedBy` is the field that disproved it. |
| Everything Gated above — settings, releases, merges | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval | The agent identity's token cannot do these at all — that half is a platform refusal and is the load-bearing one. The other half is a *prohibition*: an agent running with the maintainer's credentials can call most of these, so what stops it is the Gated tier's header, not the platform. This cell read "**The maintainer**, by hand", which stated impossibility where the truth is authorization — corrected 2026-07-27, the same conflation proposal [`0006`](proposals/0006-dependabot-security-updates.md) shipped and had to fix, here in the file that defines the tier. |

Note the asymmetry, because it looks inconsistent until you say it out loud: the commit record must stay
*his* and the conversation must stop being his. Attribution is not one principle applied uniformly — it is
*who actually did this*, and the honest answer differs by artifact.

What made the commit half honest rather than the same convention-reliance rejected for comments **used to
be** that every merge was Gated: the maintainer approved each one, so his name on a commit that reached
`main` recorded a decision he actually took, with the agent's hand marked by the `Co-Authored-By` trailer.

**That stopped being true on 2026-07-27, when this workspace declared `auto`, and the loss is recorded as
a loss rather than restated in a confident tone.** A merge nobody approved cannot record a decision
anybody took, and what the floor leaves behind is smaller than it looks —

- where a pull request carries an unresolved thread, resolution is required, but that establishes *"this
  review point is settled"* rather than *"this change should land"*, and a reviewer can resolve its own
  thread ([#44](https://github.com/sleepy-panda-works/portulan/pull/44));
- where it carries no thread at all, nothing on the floor requires a human act, since required approving
  reviews are 0.

So, replacing the sentence above: **his authorship on a `main` commit no longer records his decision that
the change should land.** It records that he owns the repository and that the change cleared the floor;
for pull requests that carried threads, it additionally records that he settled them. Provenance
reasoning from these commits should read them that way and not the older way. The paragraph was rewritten
in the same change that removed the property, rather than left defending it — which is the drift this
file has now been corrected for twice.

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
| Conversation resolution | required before merge — every thread *resolved*, which is not *adjudicated*; see below | classic branch protection |
| Branch up to date with `main` before merging | **required** since 2026-07-27 — `strict: true`; a behind pull request reports `BEHIND` and cannot merge | classic branch protection, `required_status_checks.strict` |
| Force-pushes and branch deletion | blocked | classic branch protection **and**, separately, the organisation ruleset below |
| SHA-pinned Actions | **required, and enforced by the platform** — `sha_pinning_required: true` | organisation *and* repository Actions policy |

Verified rather than asserted: a direct push to `main` was attempted after the change and rejected with
*"Changes must be made through a pull request."* This is the first gate in the repository that holds
against the agent, the maintainer, and any future collaborator equally — the difference between a rule
and a rail.

**One row is weaker than it reads, and it is the one another section leans on.** Conversation resolution
requires every thread **resolved**; it does not require that anyone holding the merge gate agrees with it.
A thread can be resolved by the very reviewer that raised it — measured 2026-07-27 on
[#44](https://github.com/sleepy-panda-works/portulan/pull/44), where Copilot cleared its own objection once
a reply addressed it, unasked. So the row stops a comment being *ignored* and establishes nothing about
whether it was *answered*; `resolvedBy` is the field that tells them apart. This matters beyond the floor,
because "Which identity acts" argues that resolving belongs to the merge gate on the strength of this
setting — that argument survives, since it rests on who *should* judge, but it may not be read as the
platform guaranteeing a judgement happened.

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

**The up-to-date row, added 2026-07-27 — the day the rule and the setting arrived together.** The
maintainer ruled that a pull request may not merge while it is behind `main`, and then instructed that it
be set in GitHub rather than left as a rule documents ask for. What made the ruling concrete was the state
of the repository that morning: **three open pull requests, each exactly one commit behind**, one of them
reported `CLEAN` and `MERGEABLE` with a green required check describing a merge against a `main` that had
already moved. `strict` was `false`, so the platform had nothing to say about it.

`required_status_checks.strict = true` is now the fourth thing this floor refuses. It matters here more
than the setting's name suggests, because CI runs on `pull_request` against `refs/pull/N/merge` — a test
merge against `main` *as it stood when the run happened* — and nothing re-runs it when the base moves.
`strict` forces the branch forward, which forces the check to re-run against the merge that will actually
land. The reasoning, the one-command condition and the cost are in
[`memory/a-branch-syncs-with-main-before-it-merges.md`](memory/a-branch-syncs-with-main-before-it-merges.md)
and [`proposals/0011-no-merge-from-behind-main.md`](proposals/0011-no-merge-from-behind-main.md).

**Verified at the settings layer and then demonstrated.** The protection was read back immediately after
the change: `strict: true`, the required check still `workspace-verify` pinned to app 15368,
`enforce_admins`, conversation resolution and the force-push and deletion blocks all intact — a `PATCH` to
one sub-resource left the rest alone. The demonstration came from the pull request carrying this
paragraph, when `main` moved two commits under it: **`mergeStateStatus: BEHIND`, `mergeable: MERGEABLE`,
`behind_by: 2`.** No textual conflict — git would merge it cleanly — and the platform refuses anyway,
which is the refusal this row buys. Before the setting, that same state read `CLEAN`. The limit worth
naming: what was observed is GitHub reporting the refusal, not a merge attempted and rejected, because a
merge attempt that is *not* refused lands the change — the reasoning that also leaves the ruleset-bypass
interaction untested above.

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
maintainer re-pointed branch protection himself (Gated — the one step no agent may take on its own),
and only then was the transitional job deleted. See
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
