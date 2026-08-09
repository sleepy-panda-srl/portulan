# Gate map — what an agent may do in this repository

> The **policy** half of [`../core/operating/autonomy.md`](../core/operating/autonomy.md). Core defines
> the tiers — Auto, Propose, Gated, Prohibited — as universal mechanism; this file binds *this repository's* concrete
> actions to them, because which action is dangerous is a property of the team, not of the engine.

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
  refuses anyway. See below for why this stopped being Gated. Force-pushing a working branch is included,
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
pushes, force-pushes and deletions on `main` are blocked, `workspace-verify` and `pr-labeled` are both
required, conversation resolution is required, and `enforce_admins` leaves nobody an exemption. A working-branch push cannot reach
any of that. Every commit still carries `Co-Authored-By` marking the agent's hand.

**The one real cost, named rather than waved past:** a push is the moment content leaves this machine for
GitHub, and it was the last human checkpoint before that happened. The confidentiality seam does not depend
on it — the seam scan is a **commit**-time obligation, and commits were already Auto — so nothing moves
from checked to unchecked. But the honest statement is that an unreviewed push now publishes to a private
remote where it is visible to anyone with access and may be cached or indexed. That is judged acceptable on a
one-collaborator private repository and is the thing to revisit first if either of those facts changes.

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
  App's name, per the measurement recorded in *Which identity acts* below — and
  the label is what makes it filterable. The librarian applies it mechanically to the pull request
  nobody is present to open; a session applies it in its `gh pr create`.
- `change-doctrine` — [`../core/`](../core/), a template, a persona, or a skill.
- `change-this-workspace` — anything here, including this file and [`gates.json`](gates.json).
- `change-the-plan` — the Status column or the Session log in [`../docs/plan.md`](../docs/plan.md).
- `change-a-verify-recipe` — and *relaxing* a check is the case to scrutinise hardest, because it is the
  one change that makes every future "green" mean less.

**An idea that adds an axis, a mode, or a surface starts as a proposal.** It is written into
[`proposals/`](proposals/) and ruled on there — never opened as an implementation pull request with
tests. _Why, measured on two arcs that both reached a maintainer's ruling and paid very different
prices for it: [#53](https://github.com/sleepy-panda-works/portulan/pull/53) and
[#55](https://github.com/sleepy-panda-works/portulan/pull/55) **built** a three-mode autonomy axis over
the four tiers and hardened it through seven review rounds, with regression tests for each finding,
before the ruling that declined it — "the single posture `main` already runs is sufficient", declined as
unnecessary rather than rejected as wrong — so the entire build was waste, and what survived is the
reasoning, which a proposal carries at a fraction of the cost. Against that, proposals
[`0012`](proposals/0012-a-desktop-app-is-a-host-not-a-surface.md)–[`0014`](proposals/0014-a-feedback-pipe-points-out-of-the-seam.md)
put the desktop surface's constitutional questions to the maintainer at **zero build waste**, and
`0012` still gates milestone 11. Both routes ended at the same place — a ruling — and only one of them
paid for it in code._

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
  measurement is in [`cli/gate.mjs`](../cli/gate.mjs)'s own header.
- `force-push-without-a-lease` — bare `--force`. `--force-with-lease` is Auto above; the lease is the
  whole difference, and it is why these are two rules rather than one with a caveat.
- `change-repository-settings` — **visibility above all**. `gh repo edit` and nothing beside it now:
  branch protection, collaborators and rulesets are changed through `gh api`, which is **no longer
  gated** — see the amendment below. So this rule's matcher is narrower than the settings surface its
  name suggests, which is said here rather than left to be inferred, because a sentence broader than its
  matcher is exactly the defect this section refuses elsewhere.

  **What stands where that gate stood is the platform, and it was measured rather than assumed.**
  [`tools/gh-bot`](tools/gh-bot) runs `gh` on the agent identity's token and reaches every endpoint
  `gh api` does. That App holds `contents: read`, `metadata: read` and `pull_requests: write`, and no
  `administration`: measured 2026-07-28, a ruleset `PATCH` and a branch-protection read both answered
  `403 Resource not accessible by integration`, while a ruleset *read* rode on `metadata` and answered
  `200`. **`contents: read` was added 2026-07-29** — proposal [`0015`](proposals/0015-the-librarian-files-as-the-agent.md),
  the maintainer's ruling, applied and accepted on the installation so the scheduled librarian can open
  a pull request at all. It changes nothing in the paragraph around it: the refusals above turn on
  `administration`, which is still absent, and **read is read** — the scope grants seeing what any
  stranger can already see in a public repository. Write is still refused, so *the permission set is the
  enforcement, not the wrapper* is unchanged.

  _This line and the two below it are re-measured at each supervised checkpoint and never written from
  memory: **the permission set is a live setting no file here can pin**, and it went stale in all three
  carriers within an hour of the grant. Raised by the reviewing session of 2026-07-29 against `main`;
  the read-back is `gh api /orgs/sleepy-panda-works/installations --jq '.installations[] |
  select(.app_id==4390104) | .permissions'`._

  So for the agent identity a settings **change** is refused by GitHub — the half
  [`../core/operating/autonomy.md`](../core/operating/autonomy.md) calls the floor, demonstrated here
  rather than repeated, and the evidence the amendment below leans on when it says the floor is what is
  left holding. The wrapper carries an endpoint allowlist besides; hole 6 describes it, and describes
  what it is not.
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

**Reaching repository settings through `gh api` was Gated until 2026-07-28, and a measurement removed
the rule rather than a change of mind.** (Named by its action here, not by its id: the rule is gone, and
citing an id no policy declares is the dangling pointer this document's own rail refuses.) It gated
`gh api` whole, reads included, and its own reason accepted the cost:
*"a gated read is a small cost against a settings change nobody approved"*. Measured against a working
session the cost was not small — branch-protection and ruleset reads are ordinary traffic, and every one
of them stopped for a dialog the maintainer had not asked for.

The narrower rule was never available while the gate stood. Both matchers open to it were **prefix**
matchers — `matchesRule` in [`cli/gate.mjs`](../cli/gate.mjs), and on the host a `Bash(<prefix>:*)`
rule, the shape this policy compiles every shell gate into — and neither language has negation, so
*"`gh api` except when it writes"* cannot be said in either. (The entry that shape produced here,
`Bash(gh api:*)`, is the one this change removes; it is named in the past tense on purpose, since a
reader arriving after the merge will not find it in [`../.claude/settings.json`](../.claude/settings.json).) The two are not
separable by prefix in any case: `gh api` switches to `POST` on its own the moment a request parameter
is added, so `gh api repos/x/y -f name=z` is a write with no `-X` in it. A rule spelled `gh api -X`
would have read as a gate and missed the ordinary write — the failure
[`../cli/compile.mjs`](../cli/compile.mjs) already names, where a matcher clever enough to generalise is
clever enough to be wrong quietly.

**What holds now is the floor, and only the floor.** For the agent identity the App's permission set
refuses these calls outright, which is the load-bearing half and is unchanged. What is gone is the
local, per-action stop on *the maintainer's own credentials*: a session running as him can now call
`gh api -X PATCH` against repository settings with no prompt. That is a real loosening, taken
deliberately on 2026-07-28, and it is recorded here rather than left to be found in a diff. If it is
ever to be bought back, the place is the token's scopes — see [The platform floor](#the-platform-floor)
— not a cleverer matcher.

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

### The shell half, and why the strongest rule here had the weakest layer

**A `write:` rule names a path, not a tool** — and for one milestone it reached only the tools that carry a
`file_path`. `Edit`, `Write` and `NotebookEdit` were denied; `echo x >> docs/vision.md` through `Bash` was
denied by **neither** layer, because the permission rule rejects the tool and the shared matcher fell
through to *false*. The rule's own sentence is what that cost: an agent that can edit the constitution can
launder any other change past its own grader, and within a session nothing local stopped it. The platform
floor still refused it at the merge — but the floor is a rail for what *lands*, not for what an agent does
to the file it is graded against while it works.

Closed by giving the `write:` action a shell half in the matcher both halves of the compiler share,
[`../cli/compile.mjs`](../cli/compile.mjs). It recognises two things and no more:

- a `>` or `>>` **redirection** into the path, and
- a **named table** of file-writing commands naming it — `cp`, `mv`, `ln`, `rm`, `tee`, `dd`, `install`,
  `truncate`, `shred`, `patch`, plus `sed`, `gsed`, `perl` and `ruby` under an in-place flag — or naming a
  **directory the path lives in**, because `rm -rf docs` destroys the constitution as thoroughly as
  `rm -rf docs/vision.md` does, and a gate decided by a trailing slash is not a gate.

Both halves read the line the way a shell does, which took a second pass to get right: commands are
separated by `;`, `&&`, `|`, a subshell, **and a newline**, and a writer hiding behind `{`, `then` or `do`
is still a writer. The first version treated a newline as ordinary whitespace, so the plainest spelling
there is — two lines, the write on the second — folded into one command whose head was `git status` and
reached nothing. A **heredoc body** is skipped, because it is text being written rather than commands being
run; the line that opens it still gates, and so does anything after the terminator.

A table rather than a parser, for the reason the floor backend's own recognition is a table: a limit a
reader can measure beats a matcher clever enough to be wrong quietly. **`git` is deliberately not in it**,
though `git checkout -- docs/vision.md` and `git restore` both overwrite the file — the head of those
commands is `git`, so admitting it would gate `git diff docs/vision.md` and `git log` alongside them, and a
gate on reading the constitution is a rule this policy does not declare. It is the likeliest uncovered
writer in this repository, so it is named here rather than left inside "any writer outside the table".

**Reading the file through a shell is untouched** — `cat`, `grep`, `sed -n` and `git diff` all pass — because reading it is Auto here, and a
matcher that contradicts a declared tier is worse than one that admits a gap. In the other direction the
matcher is deliberately coarse: it fires on *any* argument of a writing command, so `cp docs/vision.md
/tmp/backup` is refused although it only reads. Argument grammars differ per command, so "the last word is
the destination" is true of a subset only, and being wrong about it is a false green on the one file that
must not change.

**This half is the hook's alone, and so it fails open with the hook.** No permission rule stands beside it,
and that is not an omission: `Bash(prefix:*)` matches a literal command *prefix* while the path sits at an
arbitrary position in the command, so that DSL cannot express *any command writing this file*. The patterns
that would fit — `Bash(cp:*)` — gate the utility rather than the path, which is a far larger rule than this
policy declares. So the strongest tier in this file has, in its shell half, the weaker of the two layers.
`compile` prints that on every run rather than leaving it to be discovered.

## What the compiler refuses

[`../cli/compile.mjs`](../cli/compile.mjs) turns [`gates.json`](gates.json) into
[`../.claude/settings.json`](../.claude/settings.json) — permission rules and hooks. Every rule ends in
exactly one of **compiled** or **refused with a stated reason**, and the counts are asserted by the suite,
because the distinctive failure of a compiler that emits gate machinery is a rule that goes in and nothing
comes out: the map reads as configured and the machine enforces nothing.

**Two backends read this policy, and what each refuses is different.** The refusals below are the
**Claude Code** backend's — the host on this machine. Since milestone 4 session 1 there is a second, the
**GitHub repository ruleset** in [`compile/github-ruleset.json`](compile/github-ruleset.json), which is
the platform floor compiled from this same file, and its partition is close to the inverse: `propose` is
exactly what it enforces. `node cli/compile.mjs --matrix` prints every rule against both, and
[`compile/README.md`](compile/README.md) argues each refusal.

Three kinds of refusal from the Claude Code backend, all printed on every run:

| Refusal | Why |
|---|---|
| tier `auto` | Unattended by **policy**, not by the host — and the difference is the cost. There is nothing for *this compiler* to enforce, but Claude Code prompts for any command it has not been told about, so every Auto action is answered by hand, and the answers land in a per-machine settings file: unseen by review, absent from every diff, and thrown away with the worktree that earned them. Measured on one host, 2026-07-28: **404 hand-added allow entries, exactly one** of them matching an Auto rule here. The maintainer's ruling of 2026-07-27 stands — the compiler only ever adds restriction — but on a narrower reason than the one this row used to give. *"An `allow` would loosen a check"* is not established: `git push` is Auto and `git push --force` is Gated, and whether a narrower `ask` outranks a broader `allow` is host precedence **this repository has never measured**. What holds without that answer is that an allow prefix reaches every spelling beneath it, including ones no rule names — `git push --mirror` is destructive and sits in no tier. |
| tier `propose` | Enforced by the platform floor — pull request, required check, review — not by a permission rule on one machine. **The floor backend compiles exactly these**, which is what makes that sentence a hand-off rather than a shrug. |
| action `none` | No tool-level surface exists. Spending money and sending something outward are the two here. |

**Three gates neither backend compiles**, printed by `--matrix` and by `doctor` because a policy stating
a gate nothing enforces should never read as configured: `rename-or-transfer-a-repository`,
`spend-money-or-register-a-domain`, `send-something-outside-this-repository`. Each is a
prompt-level habit and the Gated tier's header, and nothing else, until something reaches it.

**Two layers are emitted for every gate, and only one of them is the gate.** The permission rule holds;
the hook supplies the sentence. That split is forced by a measurement rather than chosen: on CLI 2.1.220 a
hook that *crashes* fails **open** — the tool proceeds — on the identical wiring that blocks when the hook
is healthy. A permission rule does not fail open. So [`cli/gate.mjs`](../cli/gate.mjs) is written to
step aside silently on any internal error, handing the decision back to the layer that cannot be removed by
a syntax error.

**The honest holes, named because they are the ones to know.** Six of them, and the first is smaller than
an earlier draft of this paragraph claimed — that draft said the wrapper spelling "falls through to the
host's default mode", which was true *before* the hook existed and false of the shipped configuration. A
pre-commit supervisor measured it and found the hook's `ask` governing and its sentence reaching the agent.
Corrected here rather than left, because a gate map that overstates a hole is as wrong as one that hides it.

1. **Spellings neither layer sees.** The permission rule matches a literal prefix; the hook peels **one**
   shell wrapper. Two wrappers, a heredoc *whose target is interpolated*, an interpolated variable, or a
   command assembled at runtime reach neither. For a `write:` rule's shell half the list is its own:
   an interpolated path, a language runtime writing the file itself (`python3 -c "open(…,'w')"`), a
   writer outside the table above, and a program that **invokes** a writer (`find -exec cp`, `xargs cp`)
   — parsing those to find the real command is the ambitious parser this repository keeps refusing.
   Quoting is honoured to one level, so a write-shaped string inside a `node -e` script can produce a
   false **red**; measured on this repository's own tooling while testing this very change. Every entry
   is asserted as a test rather than only written down, so anyone tempted to call this layer a rail
   meets the counterexample.

   One more, added 2026-07-28 and narrower than it was that morning: **a heredoc opener that opens
   nothing, whose delimiter word happens to appear on a later line anyway.** Openers are found on the
   raw line, so `<<EOF` inside a quoted string or after a `#` sets a delimiter on text that opened
   nothing. Until this date the lines that followed were then swallowed whole looking for a terminator
   that never came — a fail-open manufactured by a defensive step, and the plainest bypass yet found
   here, since it hid a gated command on *any* later line. An unterminated opener is now treated as no
   opener, which closes it in the fail-closed direction at the cost of a possible false red. What
   remains is only the coincidence case, and closing that needs a quote-aware parser this repository
   refuses to grow. Found by Copilot review, against a matcher three rounds of review had already
   improved.

   _This list was wrong when first published — four items, five missing, the plainest of them a
   newline. It was corrected by a fresh-context supervisor that tried to defeat the matcher instead of
   reading it. A hole list is a claim like any other, and the only thing that checks it is somebody
   attacking it._
2. **A gated command that was not the first word on the line reached nothing — now closed for
   SEPARATORS, still open for leaders, and still open at the permission layer.** `ls && git push
   --force origin main` matched no gate at all until 2026-07-28: the matcher prefix-matched the whole
   command string, so **every** Gated outward action here was defeated by putting anything in front of
   it. The hook now splits a line on its separators and matches each command.

   What that does not reach is a word sitting in front of a command *inside* a segment, and those
   forms are ordinary rather than exotic. Measured on the runner, 2026-07-28 — each of these steps
   aside where the bare spelling answers `ask`:

   | Still escapes | Spelling |
   |---|---|
   | a leading assignment | `FOO=bar git push --force origin main` |
   | a command prefix | `env git push --force …`, `sudo git push --force …` |
   | a compound-statement keyword | `if true; then git push --force …; fi` |
   | a loop body | `for x in 1; do git push --force …; done` |
   | a brace group | `{ git push --force …; }` |
   | a leading redirection | `2>&1 git push --force …`, `> /tmp/log git push --force …` |

   Stripping a **named table** of leaders would close the common ones the way the writer table does,
   and is deliberately not done: that table has no natural edge — `nice`, `time`, `nohup`, `timeout`,
   `command`, `stdbuf`, `doas` — and one missing entry buys exactly the false confidence this list
   exists to deny. Asserted as tests rather than only written down.

   **The last row is not like the others, and the difference is worth stating rather than hiding
   inside a shared refusal.** A leading redirection has a *closed* grammar — an optional file
   descriptor, one of `<` `>` `>>` `<>` `>&` `&>`, and a word — so unlike the leader table it could be
   stripped completely, with an edge a reader could check. It is left open here only because the same
   change would be a matcher change on the same day this entry stopped overclaiming, and one of those
   at a time is the honest order. Named as a decision rather than a limit, so the next reader knows
   which of these two rows is waiting on judgement and which is waiting on a parser nobody should
   write.

   **This entry said "now closed at the hook" without qualification until 2026-07-28**, which was a
   sentence broader than its matcher — hole 5, one entry down, in the paragraph claiming to have
   closed a hole. Found by Copilot review on the pull request that wrote it.

   The permission rule reaches none of it either — `Bash(git push --force:*)` is a prefix pattern on
   the host, and nothing in that DSL reaches a command in second position — so this stays a gate whose
   reach beyond the first word is the hook's alone.
3. **A gate whose only layer is the hook — and the hook is the one that fails open.** New with the shell
   half of `edit-the-constitution`, above. Everywhere else the permission rule is the gate and the hook
   adds reach; there, the hook *is* the reach, because no `Bash(prefix:*)` pattern can name a path sitting
   anywhere in a command. A syntax error in [`cli/gate.mjs`](../cli/gate.mjs) removes tool-level
   coverage of shell writes to the constitution and leaves the `Edit`/`Write` denials standing, which is a
   partial gate that looks from the outside exactly like a whole one. `compile` names the affected rules in
   a note on every run for that reason.
4. **A local `allow` rule beside the compiled gates is unmeasured.** `.claude/settings.local.json` is
   git-ignored, so an adopter's own allow rules sit invisibly next to these. A compiled `deny`/`ask` beats
   an `allow` for the *same* pattern; what a broad local `Bash` allow does to the *wrapper* spelling has
   not been measured, and is not claimed either way.
5. **A rule whose sentence is broader than its matcher.** Guarded against by splitting rather than by
   trusting prose — `rename-or-transfer-a-repository` compiles to nothing and says so, rather than hiding
   inside a neighbour's matcher.
6. **This repository ships a wrapper of its own, and holes 1 and 4 meet in it.** Added 2026-07-28.
   [`tools/gh-bot`](tools/gh-bot) runs `gh` under the agent identity, so `./.portulan/tools/gh-bot …`
   is a spelling no compiled rule sees: every shell gate here compiles to a `Bash(<prefix>:*)` match
   against the literal command, and [`cli/gate.mjs`](../cli/gate.mjs)'s one level of unwrapping
   knows `sh -c` and nothing about this path. On the maintainer's machine the wrapper is also
   allowlisted by hand, which is hole 4 with the unmeasured part removed — the entries are for
   different spellings, so no precedence question arises and the wrapper simply runs unattended.

   **This was found against the `gh api` gate, and that gate no longer exists.** Reaching repository
   settings through `gh api` stopped being Gated on the same day — see the amendment at the end of
   [Gated](#gated--explicit-human-approval-per-action-before-it-happens) — so the specific bypass that
   prompted this entry is moot. The **class** is not: every Gated rule here is a prefix match on a
   literal command, and this wrapper is a second name for `gh`. What keeps that from mattering today is
   the App's permission set, not the wrapper and not a matcher.

   **What that was worth is a measurement, and the answer is the reason this stayed a documentation
   change rather than becoming a cleverer matcher.** The App is granted `metadata: read` and
   `pull_requests: write`, no `administration`; a ruleset `PATCH` and a branch-protection read both come
   back `403 Resource not accessible by integration`. The settings change was refused by the floor, which
   is [`../core/operating/autonomy.md`](../core/operating/autonomy.md)'s claim about the floor being
   demonstrated rather than repeated, and the measurement the Gated amendment above leans on when it
   says the floor is what is left holding. What was *not* refused is a ruleset **read**, which rides on
   `metadata` and returned `200`. The wrapper refuses any endpoint outside pull-request conversation,
   before it mints a token.

   **That allowlist is stricter than the policy now, deliberately.** Since the `gh api` gate came off, a
   ruleset read through plain `gh api` is unattended, while the same read through this wrapper is
   refused. The two do not contradict each other because they are not the same principal: the
   maintainer's credentials are his to spend, and the agent identity is a token this repository mints,
   whose reach should be the smallest thing that does its job. A wrapper narrower than the policy costs
   an agent one redirection to a spelling that works; a wrapper wider than its job costs a credential
   nobody audited.

   **Three things that guard is not.** It is not a rail: an agent with shell access can mint the token
   and call `gh` directly, exactly as [`tools/README.md`](tools/README.md) has always said of the
   subcommand refusals. It is not complete: `graphql` is one admitted endpoint carrying arbitrary
   queries, bounded by the permission set and by nothing local. And it is not a *rule* — no entry in
   [`gates.json`](gates.json) targets the wrapper, on purpose. Gating `gh-bot api` wholesale would gate
   pull-request conversation, which is the one thing that identity exists for, and an agent meeting a
   dead end there reaches for plain `gh` and posts as the maintainer. Gating only the settings endpoints
   is not expressible: a permission prefix cannot discriminate on a path segment several deep, and the
   compiler refuses `:` in a shell target for reasons of its own. So the boundary is where the doctrine
   already put it — the token's scope — and this row exists so that is stated rather than discovered.

   **The standing risk, since it is the one to watch.** The permission set is a live setting no file here
   pins, and [`tools/README.md`](tools/README.md) already anticipates one reason to revisit it. Widening
   that App converts this from a documented gap into a live bypass, and nothing in this tree would say
   so — the same class as every other live-settings claim on this page, and read by hand at the
   supervised checkpoints.

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

**Three** identities operate on this repository, and which one acts is not a detail — the record of who
did what is the thing the whole gate map exists to keep honest. The third arrived on 2026-07-28 with the
scheduled librarian and is the only one that acts with nobody at a keyboard: the **workflow**, which
commits and pushes as `github-actions[bot]` under the repository's own `GITHUB_TOKEN`. It is listed
because an unattended actor left off this table is exactly the drift the table exists to catch.

| Action | Identity | Why |
|---|---|---|
| Commits and pushes | **The maintainer's** git identity and credentials | The build's provenance discipline requires his authorship on the commit record. An agent co-authoring is fine and already conventional; an agent *replacing* him there is not. |
| Pull-request conversation — comments and review replies | **The agent identity**, via [`tools/gh-bot`](tools/gh-bot) | A reply written by an agent and posted through the maintainer's credentials makes the conversation read as human when it is not, and the reader cannot tell. See [`memory/agent-activity-is-attributable.md`](memory/agent-activity-is-attributable.md). |
| **Opening a pull request** — by a person or a session | **The maintainer's credentials**, with the body carrying an attribution line naming the agent | The practice, not a platform limit any more. It is the one this repository used before the App existed: post under his name and *say so in the artifact*, which serves the rule's actual purpose — a reader can tell. Conversation on the pull request still comes from the bot. |
| **Opening a pull request** — by the scheduled librarian | **The agent identity**, via an App installation token minted inside the workflow | The one artifact nobody is present to open, so *say so in the artifact* has nobody to say it. Creating a pull request needs repository-**contents** read, which this App is refused — GitHub answers `not all refs are readable` (HTTP 422), measured 2026-07-26 opening [#18](https://github.com/sleepy-panda-works/portulan/pull/18). [`proposals/0015`](proposals/0015-the-librarian-files-as-the-agent.md) reverses that on the maintainer's ruling of 2026-07-28; **the ruling is recorded and the setting is his to apply**, so this row describes the design while the live permission set is read back at the supervised checkpoints and never from here and records what the earlier reasoning got wrong: it priced `contents` as *the ability to write code*, which **read** is not, and it was written while this repository was private. Write is still refused, so "the permission set is the enforcement, not the wrapper" is unchanged. The alternative was worse than it looks — `GITHUB_TOKEN` opening the pull request starts no `pull_request` runs at all, so the two required checks never report and the thing can never merge. |
| **Committing and pushing a scheduled pass** | **The workflow**, as `github-actions[bot]` | The identity that actually pushes, named as itself. Committing as the maintainer would be fabricated contemporaneity — he was not there — and committing as `portulan-agent[bot]` would be worse: that App holds no `contents` write and could not have pushed this. The row above it stays true of everything a person or a session commits. What keeps this honest without his authorship is the same thing that keeps the row above honest *with* it: the merge is Gated, so nothing an unattended pass writes reaches `main` without his decision. |
| **Resolving a review thread** | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval of the merge the thread blocks | Not the agent identity's **token** — the App, not the runtime the Identity cell means by *an agent's* — and that half is a platform refusal that still holds: `resolveReviewThread` returns `FORBIDDEN — Resource not accessible by integration` for a GitHub App, whatever its permission set. The maintainer's own credentials **can resolve a review thread** — measured 2026-07-27 on two Copilot threads on [#42](https://github.com/sleepy-panda-works/portulan/pull/42), where resolution was a precondition of a merge he had already approved and the agent ran the command. This cell read "**The maintainer**, by hand" and called that question "untested and deliberately so"; the test arrived the only way it safely could, carried by an approved merge rather than sought for its own sake. The answer is the one row 223 already records: **impossibility stated where the truth is authorization**, and what stops an agent here is this row and the Gated tier's header, not the platform. The split is still right on the merits rather than only on capability — a reply is *what the agent says*, while resolving is *the judgement that a review point is settled*, and this repository requires conversation resolution before merge, which makes it part of the merge gate rather than part of the conversation. So the judgement travels **with** the merge approval, and never ahead of it: absent an approved merge there is nothing for an agent to resolve on. Measured once, with an admin account under `enforce_admins`; it says nothing about a non-admin collaborator's token. **And the requirement this row leans on is weaker than it reads.** `required_conversation_resolution` does not establish that a *human* judged a point settled: on [#44](https://github.com/sleepy-panda-works/portulan/pull/44) the Copilot review bot — login *copilot-pull-request-reviewer* — raised a thread, and the account named `Copilot` resolved it once a reply addressed it, so the party that made the objection cleared the gate on it, unasked. Read `resolvedBy` before reading a resolved thread as anyone's judgement. Two things this is not: the comment's author is typed `Bot` and the resolver `User`, so it does not contradict the App refusal above; and the platform does **not** auto-resolve a thread for going outdated — that was inferred here from a resolution landing beside an outdated flag, and `resolvedBy` is the field that disproved it. |
| **Submitting or dismissing the round's derived verdict** | **The agent identity**, via an App installation token minted inside the workflow | The verdict is computed from Copilot's round by [`copilot-review.yml`](../.github/workflows/copilot-review.yml) — approve, approve with the suppressed notes quoted, or nothing — **derived, never judged**, and the review body says so. Nobody else can carry it: Copilot submits every round as `COMMENTED` by platform design (re-checked against GitHub's documentation 2026-07-29), and `GITHUB_TOKEN` is refused approving reviews outright — `can_approve_pull_request_reviews` is `false` at organisation and repository, read back 2026-07-29 via `gh api repos/{owner}/{repo}/actions/permissions/workflow` — a refusal left standing on purpose, so the identity that runs unattended jobs and the identity that speaks about code stay distinct. Self-approval is platform-refused, so App-authored pull requests carry no derived verdict and the maintainer's review is the verdict there. This is a new act for this identity beyond conversation — the *Merge discipline* section owns the rationale, and the row exists because an act this table does not name is exactly the drift it was built to catch. |
| Everything Gated above — settings, releases, merges | **The maintainer decides**; the command is his or an agent's, on his explicit per-action approval | The agent identity's token cannot **change** any of these — that half is a platform refusal and is the load-bearing one. The other half is a *prohibition*: an agent running with the maintainer's credentials can call most of these, so what stops it is the Gated tier's header, not the platform. This cell read "**The maintainer**, by hand", which stated impossibility where the truth is authorization — corrected 2026-07-27, the same conflation proposal [`0006`](proposals/0006-dependabot-security-updates.md) shipped and had to fix, here in the file that defines the tier. **And the correction did not go far enough, in the direction it was already about.** It then read "cannot do these *at all*", which is false of reading: the App's `metadata: read` carries repository **ruleset reads**, and `GET repos/{owner}/{repo}/rulesets` through [`tools/gh-bot`](tools/gh-bot) returned `200` on 2026-07-28 — while `branches/main/protection` returned `403`, so the surface is narrower than `gh api` and is not empty. The `gh api` gate covered reads on purpose while it stood, so this was a gap and not a technicality — and it is the read half that outlived the gate, since the wrapper still refuses it. Corrected 2026-07-28 by measuring rather than by re-reading: the permission set was recorded accurately below all along and the *inference* drawn from it here was too strong, which is the one drift a claims lint over this tree can never catch. |

Note the asymmetry, because it looks inconsistent until you say it out loud: the commit record must stay
*his* and the conversation must stop being his. Attribution is not one principle applied uniformly — it is
*who actually did this*, and the honest answer differs by artifact.

**Pull-request ownership is authorship, not assignment — and the assignee field cannot say otherwise.**
Measured 2026-07-29: only `marius-cetanas` is assignable on this repository. `portulan-agent[bot]` and
`Copilot` both answer 404 on the assignability check, and the assignee list has exactly one entry —
read-back `gh api repos/sleepy-panda-works/portulan/assignees`, per-login check
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
route is declined — and the [`agent-driven`](labels.json) label from that file's ownership vocabulary
is the filterable mark; the Propose tier above carries who applies it, and when.

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
is true of what this identity can change and false of what it can see, and hole 6 above is where the
difference cost something._

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

## Merge discipline — the review is awaited, not just resolved

**A pull request may not merge until Copilot's feedback has been *awaited* and *resolved*.** The
maintainer's ruling, 2026-07-27, and the occasion is the useful part: browsing closed pull requests, he
found merges that had landed **before** Copilot's round on the final push arrived. The review was
requested, the review happened, and its feedback reached a pull request that was already closed — so it
was disregarded by nobody in particular, which is the worst way for it to happen.

The two halves need different mechanisms, and only one of them existed:

| Half | What it means | What enforces it |
|---|---|---|
| **Resolved** | No Copilot thread is left unaddressed | `required_conversation_resolution` on `main` — already in the floor below |
| **Awaited** | The round on the **current head** has landed | [`../.github/workflows/copilot-review.yml`](../.github/workflows/copilot-review.yml) — new |

**Awaited was the gap.** The Copilot ruleset *requests* a review on every pull request; nothing made a
merge wait for one. So a merge could land in the window between the final push and the review arriving,
and did. That is
[`memory/a-mandate-nothing-checks-is-already-broken.md`](memory/a-mandate-nothing-checks-is-already-broken.md)
again — a reviewer everyone relied on, with nothing making the reliance real.

**The head SHA is the whole design.** A review of an *earlier* commit does not satisfy the check, because
that is precisely the defect: the review existed and described a different tree than the one merging. The
check matches every review's `commit_id` against the pull request's current head and re-runs on
`synchronize`, so pushing puts it back to pending. It also **fails closed** — an unreadable API is
`could not look`, never `nothing wrong`.

**Awaiting is pending, not failing — amended 2026-07-28.** The first cut had two outcomes for a question
with three answers, so *the round has not arrived yet* was reported in the same colour as *the round is
never coming*. Since Copilot cannot have reviewed a commit that did not exist when the run started, **every
push produced a red check by construction**, and rounds on this repository land 1m53s–3m47s later (#49,
#54, #57). A red that is expected on every push is how a gate becomes background weather. The check now
waits inside its own run: the job stays *in progress* while the round is outstanding, which blocks a merge
exactly as hard and says the true thing. Red is reserved for the round never arriving — a 20-minute budget,
five times the slowest round measured — and for an API that stays unreadable, which is still `could not
look`, never `nothing wrong`.

The same amendment closed a red that could never clear. The Copilot ruleset carries
`review_draft_pull_requests: false`, so on a **draft** no round is owed and none was ever coming; the check
now reports success there, naming the reason, which opens nothing because GitHub refuses to merge a draft
at all and `ready_for_review` re-runs the real check. The window it leaves is named in the workflow.

**Three limits, named rather than found later.** The reviewer's login is a platform fact the workflow
hard-codes, and a rename would show up as a permanent red rather than a silent pass — the failure
direction to prefer, but a fragility to know about. Resolution still does not mean *adjudication*:
a reviewer can resolve its own thread, as recorded in the floor section below. This rule makes the round
**happen before the merge**; it does not make anyone agree with it.

And the third is what the wait costs when it is not enough. **This used to be a click on every pull
request**: the `pull_request_review` re-trigger fired when the review landed, but the triggering actor was
the bot, so GitHub held the run as `action_required` awaiting a maintainer's *Approve and run*. Waiting
inside the `pull_request` run — which is not bot-triggered — removed that trigger and that click. What is
left is the tail: if the budget expires before the round lands, **nothing re-triggers the check** and a
maintainer re-runs the job. The same click as before, now only in the case that is already a fault.

**The guarantee is bounded; the process on top of it is now bounded too — 2026-07-28.** Answering
Copilot was made mandatory and unbounded on the same day, and the unbounded half did not survive
contact: **110 rounds across the 30 most recently merged pull requests, 3.7 each, 29% of them finding
nothing at all, twelve needing four or more.** The length was driven by *pushes* rather than findings —
`review_on_push: true` means every push spawns a round, including documentation-only ones. The bound is
[`memory/a-review-loop-needs-a-bound.md`](memory/a-review-loop-needs-a-bound.md): one push per round,
records land last, threads block but low-confidence notes do not, and after two fix-rounds the remainder
becomes an issue rather than another push. **None of that touches the row in the table above** — the
merge still waits for the round on the merging head, and threads still resolve.

**The round's outcome is now displayed as a review — a derived verdict, 2026-07-29, on the
maintainer's directive.** Copilot cannot say it: the platform submits every Copilot round as a
`COMMENTED` review — never an approval, never a request for changes — by GitHub's deliberate design,
re-checked against its documentation the day this shipped. So
[`../.github/workflows/copilot-review.yml`](../.github/workflows/copilot-review.yml) gained a second
step that computes the verdict from the round and has the **agent identity** submit it as a real
review: a clean round is an APPROVE; a round whose only content is suppressed low-confidence notes is
an APPROVE with the notes quoted — *approve with suggestions*, and the body says the approval is not
their disposal, since each note still owes an address-or-refuse reply under the loop rule above; a
round with any inline comment submits nothing, because threads and conversation resolution already
carry findings and a second gate on a gated thing would be machinery pretending to be policy; a notes
channel that could not be read yields no verdict, loudly. Stale approvals are swept before any verdict
branch, on every run that computes one — an approval naming a commit that is no longer the head is
dismissed, and a same-head approval is withdrawn when the newest round stops supporting it (findings,
or a notes channel the step could not read). What this is **not**:
not the merge gate (required approving reviews stay 0 and every merge is the maintainer's), not
required, and not a judgement — *derived, never judged*, the sentence the identity table binds.
App-authored pull requests get no derived verdict, because the platform refuses self-approval; the
weekly librarian pull request's verdict is the maintainer's own review, which it already required. The
observation procedures for each branch, per proposal
[`0007`](proposals/0007-every-watcher-ships-with-its-observation-procedure.md), live in the step's own
header comment; which branch its shipping pull request exercised live is recorded in that pull
request's body.

**Raising the required count is an option this creates, and it is deliberately not taken here.** "Why
zero required reviews" below records the solo-maintainer arithmetic; a derived approval on
maintainer-authored pull requests plus the maintainer's own review on App-authored ones would cover
both authors *on paper*. Three limits keep that a proposal rather than a setting: whether an
App-submitted approval satisfies the required count is unmeasured on this repository — and not
measurable short of the Gated flip; a round answered by refusal with no further push earns no approval
under the branches above, so a required count would deadlock on exactly the ending the review-loop
bound legitimizes; and the carrier check is itself not yet required (the paragraph below). If the flip
is ever taken it arrives as its own proposal, the
[`0009`](proposals/0009-a-gate-policy-beside-the-gate-map.md)–[`0011`](proposals/0011-no-merge-from-behind-main.md)
and [`0015`](proposals/0015-the-librarian-files-as-the-agent.md) precedent — a settings change with no
proposal behind it is a floor nobody can audit.

**It composes with the autonomy mode; it does not substitute for one.** A mode governs whether the
*agent* raises a ship-step prompt. This is a status check — a floor row once it joins the floor, per the
paragraph below — and floor rows hold at every mode. So under `gated` a merge waits for both the
maintainer's approval and this check; under `auto` the approval prompt is gone and **this check still
holds**. Anyone reading `auto` as *"nothing waits"* should read this row again.

**Not yet required, deliberately** — the same reason as `pr-labeled` before it, from
[`proposals/0004-ci-runs-every-declared-recipe.md`](proposals/0004-ci-runs-every-declared-recipe.md): a
required context that has never reported blocks every open pull request that does not carry the workflow,
and `enforce_admins` leaves nobody able to force past it. The workflow merges first; it joins the floor
after, by one command that is a repository-settings change and therefore **Gated**.

**A head that never draws a round: merging past this check is an explicit, recorded maintainer act —
ruled 2026-08-09, exit (2) of
[`proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md`](proposals/0023-a-head-that-never-draws-a-round-needs-an-answer.md).**
The check can be left holding a state that never clears: on
[#157](https://github.com/sleepy-panda-works/portulan/pull/157) a rebase force-push drew no round at all
— the re-request was accepted and abandoned — and the pull request merged past the red check on the
maintainer's explicit override. That exception is now the procedure, unchanged in substance: **the check
stays red**, because a gate that opens itself on an unexplained absence is not a gate, and the maintainer
may merge past it **per occurrence, never as standing permission**, with the act recorded on the pull
request *before* the merge — his own comment, or an agent's via [`tools/gh-bot`](tools/gh-bot) quoting
his instruction verbatim. **The recording is the difference between an override and a habit.**

The cause is unestablished — authorship is the surviving lead
([#161](https://github.com/sleepy-panda-works/portulan/issues/161)) — and while it stands the weekly
librarian pass meets this whenever it needs a rebase, so the expected price is **one recorded override
per stranded pass**. Measured 2026-08-09: the scheduled pass has run **once**, and it stranded. This is
doctrine standing where a rail should eventually stand, and [`../docs/vision.md`](../docs/vision.md)'s
*rails, not prose* is conceded rather than contradicted — the rail is the required-context flip above,
declined for now **precisely because** it would make a known strand class unmergeable at 06:00 on a
Monday with nobody at a keyboard. Retire this paragraph when a scheduled pass that needed a rebase draws
its round and merges with no override, when `copilot-reviewed` joins the required contexts, or when
Copilot review leaves the review path.

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

Three gates from [`../docs/plan.md`](../docs/plan.md), each requiring a supervisor in a **fresh context**
that has not seen the implementer's window:

| Checkpoint | When | What it grades |
|---|---|---|
| Session-open | before implementation starts | the session plan, against the constitution and the plan |
| Pre-commit | before any commit | the diff, against the milestone's exit criterion |
| Milestone-close | before a milestone is marked done | that the criterion was *demonstrated*, not asserted |

If supervision is unavailable in a session, that is stated plainly and the maintainer reviews the diff.
A milestone is never self-certified.

**Doctrine, tier and floor work takes a checkpoint even when no row moves.** Work that touches
**doctrine, the autonomy tiers, or the platform floor** takes a **fresh-context pre-commit
checkpoint**, even when no milestone row moves. [`dod.md`](dod.md) condition 7 carries the obligation
and cites this sentence for the trigger. _Why: the triage threshold above already classes this work as
full-lane, but until this sentence nothing said that a full-lane change **off** the milestone row needed
the supervisor a milestone-moving one gets — so the trigger was milestone status, while this gate map
holds blast radius to be the real measure. Priced on the arc that ran without it: the Dependabot work
took **no checkpoint at any of the three**, and **two of its three defects were found by Copilot rather
than by the implementer**._

**Session-open runs `clarify` against the milestone row itself.** When a row's criterion reads two ways,
the criterion is an **input** to the ritual, not merely its context. _Why: milestone 4's row said
"Copilot ruleset export", which an implementer could read as a GitHub-Copilot integration or as a GitHub
repository-ruleset export — two unrelated deliverables, one of which would have been built by guessing.
The ambiguity cost a **session-blocking question** to the maintainer, and the `clarify` skill that exists
to catch exactly this went unused, because nothing pointed it at the criterion._

_Both sentences are the maintainer's, taken 2026-07-28 on the two-day review's R3. Neither is enforced by
machinery today: like the checkpoint table above them, they are read and honoured rather than compiled,
and the audit behind the first is the Dependabot arc named in it rather than a sweep of every past
session._

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
| Required approving reviews | 0 — see below | classic branch protection |
| Conversation resolution | required before merge — every thread *resolved*, which is not *adjudicated*; see below | classic branch protection |
| Branch up to date with `main` before merging | **required** since 2026-07-27 — `strict: true`; a behind pull request reports `BEHIND` and cannot merge | classic branch protection, `required_status_checks.strict` |
| Force-pushes and branch deletion | blocked | classic branch protection **and**, separately, the organisation ruleset below |
| SHA-pinned Actions | **required, and enforced by the platform** — `sha_pinning_required: true` | organisation *and* repository Actions policy |

Verified rather than asserted: a direct push to `main` was attempted after the change and rejected with
*"Changes must be made through a pull request."* This is the first gate in the repository that holds
against the agent, the maintainer, and any future collaborator equally — the difference between a rule
and a rail.

**This row now has a second in-tree carrier, and they are checked against each other.**
[`gates.json`](gates.json)'s `floor` declares the same required contexts as machine-readable policy, because
the floor backend has to emit them. Two files stating one fact is this repository's signature defect, so
`doctor` compares them and reports any divergence — the same containment already applied to the rule ids
above. It is worth knowing exactly how narrow the older check was: `doctor`'s claims lint reads this row and
compares it against the **tree**, where both jobs exist, so a row naming one of two contexts passed. The
cross-check is what closes that, and it closed it on its first run — against a branch whose checkout
predated [#50](https://github.com/sleepy-panda-works/portulan/pull/50), where this row still named one
context and `main` had already fixed it. A fair demonstration of the class, and not a defect found in the
record.

Neither carrier is the live setting, and that gap is real: whether branch protection *actually* requires
these contexts is an API fact no check here fetches. It is read by hand at the supervised checkpoints.

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

**This floor now has a compiled form, and it is not the one in force.**
[`compile/github-ruleset.json`](compile/github-ruleset.json) is what [`gates.json`](gates.json) compiles to
for the platform-floor backend: an importable GitHub repository ruleset carrying a pull-request
requirement, these required checks (strict), a force-push block and a deletion block. It is **generated,
never applied** — importing it is a settings change, Gated, and nobody has — so the table above still
describes the live configuration and that file describes what the policy *says* the floor should be. They
agree today, checked by hand at this session's checkpoints. Nothing checks them automatically, and nothing
here can: `doctor` does not fetch settings and no verify recipe may make a network call.

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
_Since 2026-07-29 the round's outcome is also displayed as an approval — submitted by the agent
identity, not by Copilot, so the sentence above stays true; see *Merge discipline* for the derived
verdict and why the approving-review count still does not move._

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
up: the workflows under [`../.github/workflows/`](../.github/workflows/) are the tree's only manifests,
`actions/checkout` — one SHA, pinned in each of the four — their only entry. **Corrected at milestone 7:**
this said there is no `package.json`. There is one now, at the root, carrying the CLI's `bin` — but it
declares **no dependencies** and there is still **no lockfile**, so it adds nothing for a scanner to
watch and the count above is unchanged. The mechanism is the point and not the count — but a floor described as
broader than it is would be the same drift this rule was added to catch. _(Until 2026-07-29 this sentence
named `verify.yml` as the only manifest, which had been false since the label and librarian workflows
arrived carrying the same pin — the stale-count class again, corrected in the change that made
`copilot-review.yml` the fourth.)_

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
