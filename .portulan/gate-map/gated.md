# Gated — conditions, measurements and amendments

> The rest of the gate map's [Gated tier](../gate-map.md#gated--explicit-human-approval-per-action-before-it-happens), by rule. Read an
> action's section before you prepare it. The tier's rules are in the index; nothing here restates them.

## `commit-without-the-hooks`, composed

**Why it compiles to nothing, which is a decision and not a gap nobody noticed.** The category is
*committing with the local hooks bypassed*, and its spellings are unbounded shell: `--no-verify`; the
`-c core.hooksPath=/dev/null` form that
[`0029`](../proposals/0029-a-constraint-names-a-category-not-a-list.md)'s incident 3 actually used;
`core.hooksPath` set at any config origin beforehand; `HUSKY=0` and its equivalents; a wrapper earlier on
`PATH`. This rule carried `git commit --no-verify` for one milestone, and **in that measured incident the
matcher gave zero protection while reading as coverage** — the act performed was the same category in
another spelling, so the gate *as enumerated* never reached it. A matcher covering one spelling of an
unbounded set is worse than an honest gap, because only the gap is visible. Enforcement here is the
reader's discipline under [`../../core/operating/autonomy.md`](../../core/operating/autonomy.md)'s rule that an
act's absence from a list is not a finding of permission. _On the maintainer's ruling of 2026-08-14,
[`0029`](../proposals/0029-a-constraint-names-a-category-not-a-list.md) Q3; the uncompiled count moving
**4 → 5** is the price that ruling names rather than a regression._

_Listed here as of 2026-08-13: it was composed into this policy and compiled into
[`../../.claude/settings.json`](../../.claude/settings.json) for a milestone before any section of this file
named it, because the three rails checking this document against the policy read
[`gates.json`](../gates.json) alone. Found by milestone 7's close; the rails now read declared **plus**
composed. Its matcher was removed 2026-08-14, and the `ask` entry left `.claude/settings.json` with it._

## Why the header governs every action in this tier

*Which* credentials run it is a separate question, answered in [**Which identity acts**](identity.md): the agent
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

## `merge-a-pull-request` and `delete-a-remote-branch`

**Condition 1 has no mechanical instrument, and must not be given a wrong one.** The obvious candidate
is the pull request's author field, and it is **measurably wrong here**: PRs in this repository are
opened under the maintainer's identity, so `gh pr view 274 --json author --jq .author.login` returns **`marius-cetanas`**
for a branch an agent created. Platform events are ephemeral, and your clone's reflog
(`branch: Created from`) is corroboration where it survives, never proof of absence. So condition 1 is
epistemic with a fail-closed default — *cannot establish it → Gated* — and that is sounder than a proxy
that answers confidently and wrongly. Anyone tempted to "sharpen" this into a check should measure the
candidate against an agent-created branch first. **Condition 1 is not decoration and must not be dropped:** a branch somebody else
pushed stays Gated **however** condition 2 comes out — they may be relying on it, and reliance is wider
than uniqueness. _(A draft of this paragraph collapsed the two into condition 2 alone. That was a
widening past what was delegated — it would have permitted deleting the maintainer's own merged branch,
or any branch whose patches landed independently while its pull request is still open, since deleting a
head branch closes its pull request. Caught by the pre-commit checkpoint.)_

**Condition 2's test, spelled fail-closed** — it is about the **remote** ref, because that is what is
being destroyed, and a local branch can be a stale image of it:

```
git fetch origin <branch>:refs/remotes/origin/<branch> && git cherry origin/main origin/<branch>
```

It must **exit 0** *and* show **zero `+` lines**. **Requiring the exit is the whole guard:** measured,
`git cherry` against an unknown ref exits **128** and prints nothing, so "zero `+` lines" alone is
satisfied by a command that failed — a fail-open written into the sentence meant to close one. An error,
an unresolvable ref, or a view too shallow to answer is **not zero**; it is Gated.

Not `git branch --merged` and not `git merge-base --is-ancestor`, both of which **lie here** in practice:
this repository rebase-merges, so a merged branch's tip is never an ancestor of `main`. Measured on
`a78f077`, merged as #274 — `--is-ancestor` exits 1, `git cherry` reports **zero** `+` lines.

_(The `git cherry` method is **recorded** in the handoffs of 2026-07-27, 2026-08-07 and 2026-08-09, and
**prescribed** in the branch conventions the maintainer keeps outside this repository; **it was not written in this file
before this paragraph** — a draft claimed it was, which is the second dangling citation in two rounds,
the first being recorded in the note that closes this section.)_

**The compiled matcher cannot see any of this, and that is the safe direction.** `Bash(git push
--delete:*)` reads a command string; it cannot read who created a branch, whether it merged, or whether
its commits exist anywhere else. So the host still prompts on every spelling it catches, and this
exclusion narrows the **doctrine** rather than the gate — the answer to the prompt is what changed, not
whether it appears.

**The seam this closes, ruled 2026-08-17 on the maintainer's delegation.** The 2026-08-14 wording said
*created by you, **never merged**, no unique work* — three clauses — and a **post-merge** deletion fails
the middle one while plainly satisfying the purpose. That produced a rule under which the routine
cleanup the branch conventions prescribe read as Gated. The never-merged clause was an **approximation
of the real test**, and it approximates badly in both directions: a merged branch destroys nothing,
while an unmerged branch you created may still be the only copy of something.

**Two facts settled it rather than taste.** `git cherry` on the merged branch reports **zero** unmerged
patches — there is nothing left to destroy. And this repository sets **`delete_branch_on_merge = true`**,
which is the maintainer's standing consent to unattended deletion of **a merged pull request's own head
branch**: the platform already does it, on every merge, with no agent involved. Gating an agent for that
exact act would bind only the agent.

**What the second fact does NOT license, stated because a draft of this paragraph stretched it.** The
setting speaks to the just-merged head branch and nothing else — not a branch somebody restored after the
auto-delete, not somebody else's branch, not one whose patches merely landed by another route. So it
carries the seam and cannot carry a general replacement of condition 1.

The never-merged clause is therefore **replaced by condition 2**, which covers the drill branch and the
post-merge branch alike, while **condition 1 stays exactly as ruled**. No third special case is added.
_(Adding one was the tempting move and the wrong one — a rule with a case per incident is the
discretionary shape this workspace prefers rails to.)_

_(This paragraph exists because the rule's `reason` already said "a shared remote" and **nothing said
what that excluded**, so the matcher was the only readable half — the exact failure the note directly
above records: where a rule and its clarification live apart, only the rule gets read. It took an agent
deleting its own drill branch, calling it a breach, and the maintainer ruling that it was not, for the
missing half to get written. A first draft of this note pointed at a post-merge paragraph "two sections
down" that **did not exist in this file at all** — until this change the practice lived only in the
handoffs and the maintainer's own memory, outside this document — which was a dangling pointer written
into the very paragraph about clarifications that cannot be found. Caught by the pre-commit checkpoint.)_

### The merge precondition

The approval is the maintainer's decision that the
change should land; being in sync is what makes the green check describe the tree it will land *as*,
since CI tests `refs/pull/N/merge` against `main` as it stood when the run happened and nothing re-runs
it when `main` moves. Reasoning and the local spelling:
[`memory/a-branch-syncs-with-main-before-it-merges.md`](../memory/a-branch-syncs-with-main-before-it-merges.md).
**And this one is a rail, since 2026-07-27** — `required_status_checks.strict` is `true` on `main` (see
[the platform floor](../gate-map.md#the-platform-floor)), so a behind pull request reports `BEHIND` and the platform refuses the merge
for the maintainer too. [`gates.json`](../gates.json)'s reason states the precondition as well, which is a
courtesy and not a second layer: on a bare `gh pr merge` the permission rule matches and the host
discards the hook's sentence, so that reason reaches an agent only on the wrapped spelling — the
measurement is in [`cli/gate.mjs`](../../cli/gate.mjs)'s own header.

## `change-repository-settings`

**What stands where that gate stood is the platform, and it was measured rather than assumed.**
[`tools/gh-bot`](../tools/gh-bot) runs `gh` on the agent identity's token and reaches every endpoint
`gh api` does. That App holds `contents: read`, `metadata: read` and `pull_requests: write`, and no
`administration`: measured 2026-07-28, a ruleset `PATCH` and a branch-protection read both answered
`403 Resource not accessible by integration`, while a ruleset *read* rode on `metadata` and answered
`200`. **`contents: read` was added 2026-07-29** — proposal [`0015`](../proposals/0015-the-librarian-files-as-the-agent.md),
the maintainer's ruling, applied and accepted on the installation so the scheduled librarian can open
a pull request at all. It changes nothing in the paragraph around it: the refusals above turn on
`administration`, which is still absent, and **read is read**. Write is still refused, so *the
permission set is the enforcement, not the wrapper* is unchanged.

**What that scope costs has now moved twice, and the entry records the price rather than settling on
one.** It originally read *"the scope grants seeing what any stranger can already see in a public
repository"*. That went false on 2026-08-03: with the repository private there was no such stranger,
so the grant became a real one and the sentence that made it cheap expired. **The second flip to
public restores the cheap reading** — a stranger can see these contents again, so `contents: read`
once more grants no view the world lacks. What must not be taken from that is the comfortable
conclusion. [`proposals/0015`](../proposals/0015-the-librarian-files-as-the-agent.md) priced this exact
case as its own argument-against, **before it happened the first time**: *"Visibility is a live
setting, not a pinned one: if this repository were ever made private again, `contents: read` would
become a real grant that nobody would revisit, because permissions are not re-derived from
visibility."* That is what occurred, and the flip back to public does not refute it — it demonstrates
the other half of the same point, that a permission argued from a setting is re-priced by every move
of that setting and by nothing else. The setting has moved three times. The re-measure mandate
directly below is the operative rail; the trade is the maintainer's, and no change to the permission
set is proposed or implied here.

_This line and the two below it are re-measured at each supervised checkpoint and never written from
memory: **the permission set is a live setting no file here can pin**, and it went stale in all three
carriers within an hour of the grant. Raised by the reviewing session of 2026-07-29 against `main`;
the read-back is `gh api /orgs/sleepy-panda-srl/installations --jq '.installations[] |
select(.app_id==4390104) | .permissions'`._

So for the agent identity a settings **change** is refused by GitHub — the half
[`../../core/operating/autonomy.md`](../../core/operating/autonomy.md) calls the floor, demonstrated here
rather than repeated, and the evidence the amendment below leans on when it says the floor is what is
left holding. The wrapper carries an endpoint allowlist besides; [hole 6](compiler.md#the-honest-holes) describes it, and describes
what it is not.

## Releases

The **rail** reaches the tree, on every commit: the `release-eval` recipe requires every release from
`0.1.3` onward to carry `../../evals/releases/<version>.json` and a register byte-identical to what that
capture renders, with no rail recorded red. It reaches the **tagged tree** once, from
[`../../.github/workflows/publish-github-packages.yml`](../../.github/workflows/publish-github-packages.yml),
which runs `release-eval --tagged` against the tag's own checkout before anything is published.

The **person** owns what no check can read, and it is named rather than left implied: **the release
body cites the version's register**, and the eval result is not restated in it. Nothing enforces that
— a release body is authored on GitHub, outside every tree — so it is a condition on the maintainer's
own act, in the tier where his acts already live. _(The rail also cannot see a tag created from a tree
whose `## Unreleased` accumulator was never renamed; `--tagged` is what catches that, at the publish
rather than before it. Recorded here because a split that names only its strong half reads as
coverage.)_

## Telemetry's standing consent

Three things keep that from widening into the thing the tier exists to stop, and each is a rail rather
than a sentence — the enforcement is **in the tool**, which is where this rule has always put it:
[`../../cli/telemetry.mjs`](../../cli/telemetry.mjs) refuses to export when the config opts out, **and** when the config is
untracked, **tracked but absent from `HEAD`** — staged and never committed — or differs from `HEAD`, so
an agent can manufacture consent neither by editing a working copy nor by staging one;
**`--export` is person-invoked only** — CI does run the module on every pull request, through the
`telemetry` recipe, and never that mode — so wiring the export into a workflow, hook or schedule is a
new consent question rather than a covered one; and it neither queues nor retries, on
[`../../cli/feedback.mjs`](../../cli/feedback.mjs)'s rule that a queue flushing itself later is a silent send
with extra steps. It answers proposal
[`0014`](../proposals/0014-a-feedback-pipe-points-out-of-the-seam.md)'s reservation of telemetry as *"a
separate mechanism with separate consent"*, which had been named there and ruled nowhere. **It grants
no other act standing consent**, and the tier is unchanged for every one of them.

## The `gh api` amendment

**Reaching repository settings through `gh api` was Gated until 2026-07-28, and a measurement removed
the rule rather than a change of mind.** (Named by its action here, not by its id: the rule is gone, and
citing an id no policy declares is the dangling pointer this document's own rail refuses.) It gated
`gh api` whole, reads included, and its own reason accepted the cost:
*"a gated read is a small cost against a settings change nobody approved"*. Measured against a working
session the cost was not small — branch-protection and ruleset reads are ordinary traffic, and every one
of them stopped for a dialog the maintainer had not asked for.

The narrower rule was never available while the gate stood. Both matchers open to it were **prefix**
matchers — `matchesRule` in [`cli/gate.mjs`](../../cli/gate.mjs), and on the host a `Bash(<prefix>:*)`
rule, the shape this policy compiles every shell gate into — and neither language has negation, so
*"`gh api` except when it writes"* cannot be said in either. (The entry that shape produced here,
`Bash(gh api:*)`, is the one this change removes; it is named in the past tense on purpose, since a
reader arriving after the merge will not find it in [`../../.claude/settings.json`](../../.claude/settings.json).) The two are not
separable by prefix in any case: `gh api` switches to `POST` on its own the moment a request parameter
is added, so `gh api repos/x/y -f name=z` is a write with no `-X` in it. A rule spelled `gh api -X`
would have read as a gate and missed the ordinary write — the failure
[`../../cli/compile.mjs`](../../cli/compile.mjs) already names, where a matcher clever enough to generalise is
clever enough to be wrong quietly.

**What holds now is the floor, and only the floor.** For the agent identity the App's permission set
refuses these calls outright, which is the load-bearing half and is unchanged. What is gone is the
local, per-action stop on *the maintainer's own credentials*: a session running as him can now call
`gh api -X PATCH` against repository settings with no prompt. That is a real loosening, taken
deliberately on 2026-07-28, and it is recorded here rather than left to be found in a diff. If it is
ever to be bought back, the place is the token's scopes — see [The platform floor](platform-floor.md)
— not a cleverer matcher.
