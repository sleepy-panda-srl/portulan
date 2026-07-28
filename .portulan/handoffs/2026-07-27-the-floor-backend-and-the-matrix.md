# Handoff — the floor backend, the matrix, and the report that found its first defect on its first run

**Date:** 2026-07-27 · **Milestone 4 (Enforcement compiler), session 1 of 1–2** · Branch
`m4-the-floor-backend-and-the-matrix`

Session 0 landed the policy-to-host half: `gates.json` → permissions and hooks, the Stop-gate runner,
both demo clauses. This session lands the rest of the row — the **GitHub repository-ruleset export**,
the **per-host backend matrix**, `doctor`'s **degradation report** — and the rider ruled after session 0
merged, [`../tasks/0007-per-reason-stop-gate-counters.md`](../tasks/0007-per-reason-stop-gate-counters.md).

## What was built, and the one thing that had to move first

**The floor backend.** `githubRuleset()` in [`../../cli/compile.mjs`](../../cli/compile.mjs) compiles the
same `gates.json` into [`../compile/github-ruleset.json`](../compile/github-ruleset.json): a
`pull_request` rule, `required_status_checks` (strict, unconditionally), `non_fast_forward`, `deletion`.
It **generates and never applies** — importing is a settings change, Gated, the maintainer's — and its
shape was read from two live rulesets rather than from documentation, so only GitHub's *input* fields are
emitted.

**And the tier partition had to move into the backends before any of that could work.** For one session
it lived in the shared stage: `auto` and `propose` were refused before any backend ran, with a sentence
saying `propose` *"is enforced by the platform floor"*. Correct sentence, wrong file — it names the
backend that did not exist yet, and left where it was, the floor backend would have found the rules it
exists to compile already discarded, and would have emitted a ruleset with no `pull_request` rule in it:
importable, valid, named for a floor, enforcing something nobody asked for.

The part worth keeping is **why the suite would not have caught it.** The accounting invariant — every
rule ends as compiled or refused, and the counts sum to the input — would have stayed true throughout,
because refusing everything adds up perfectly. *An accounting invariant proves nothing was dropped; it
cannot notice that everything was dropped for the same wrong reason.* The invariant is now asserted per
backend, which is necessary and still not sufficient. Recorded as
[`../memory/a-shared-stage-must-not-hold-one-backends-opinion.md`](../memory/a-shared-stage-must-not-hold-one-backends-opinion.md).
Found at the **session-open checkpoint**, by a supervisor reading the plan against the existing code
before anything was written — which is the second milestone running where that checkpoint changed the
design rather than the wording.

**The matrix** is `compile --matrix`: every rule against every backend, derived from the backends rather
than maintained beside them, because a matrix written by hand is a claim about compilers and a coverage
claim that drifts does not look wrong — it looks like enforcement that quietly stopped covering
something. It positions the ruleset as the floor backend in the criterion's own words.

**The degradation report** is `doctor`'s new `enforcement` check: per-backend coverage, the gates **no**
backend compiles, the floor's declared status checks against the tree's workflow jobs, and a cross-check
between the policy's `floor` and the gate map's prose row. Reported, never failed — nothing legislates a
coverage floor — with exactly one exception, below.

## The report fired on its first run — and the story I first wrote about it was false

The new cross-check compares two in-tree carriers of one fact: the gate map's platform-floor row and the
policy's `floor`. Its first run on this branch reported that the row named one required status check
where the policy declared two. The draft of this handoff called that a live defect found in the record,
and said the row had been stale for a day.

**It was not.** [#50](https://github.com/sleepy-panda-works/portulan/pull/50) — merged 21 minutes after
this branch's base commit — added `pr-labeled` to the live floor *and corrected that row in the same
change*. What was stale was this branch's checkout. Caught at the pre-commit checkpoint, by a supervisor
that fetched `origin/main` instead of trusting the working copy.

What survives is smaller and still worth having. The check does catch this class, and it caught it without
an API call, which is the property that matters: `doctor`'s existing claims lint reads that row and
compares it against the **tree**, where both jobs exist, so a row naming one of two contexts passes. The
cross-check is what closes that. It just did not find a defect anybody had left lying around.

**And the mistake is the one the workspace's own record warns about most specifically:** parallel sessions
collide on prose, `main` moved three times under this session, and no check here reads GitHub. The rule is
fetch before *writing*, not only before pushing — and this session fetched before writing, then wrote a
claim about a file it had read forty minutes earlier.

## The one enforcement finding that is a failure rather than a note

A `floor.checks` context that no workflow job in the tree reports **fails**. That severity is deliberate
and it is the highest-priced typo this tree can catch: a required context that never reports blocks every
pull request, and `enforce_admins` leaves nobody able to force past it. That is proposal `0004`'s lesson,
which cost a three-step rename to work around after the fact.

## What the floor backend refuses, and why the refusals are the deliverable's honest half

Seven of twenty-four rules compile; seventeen refuse, each by name with its own sentence. The reasons are
scoped to **this export** rather than to GitHub, because the convenient blanket version — *"the platform
gates a ref, not a path"* — is false: `CODEOWNERS` gates owned paths and `autonomy.md` names it as part
of the floor, push rulesets gate file paths, tag rulesets gate `refs/tags/*`.
[`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
binds every sentence containing *cannot*, and it bound this one.

The refusal worth reading twice is `merge-a-pull-request`. The floor **constrains** it — required checks
green, and with strict checks a head not behind the base — but with 0 required reviews it does not
require anyone's yes, which is what the Gated tier means. Reported as not compiled rather than as
covered: overstating a guarantee inside the artifact whose subject is guarantees is the worst available
place to do it.

And the coarseness runs **both** ways, which the compiler prints rather than leaving to the README. On
`refs/heads/main`, `non_fast_forward` is *stricter* than the policy — it blocks `--force-with-lease`,
which is Auto here. Off that ref it enforces nothing.

## Three gates neither backend compiles

`rename-or-transfer-a-repository`, `spend-money-or-register-a-domain`,
`send-something-outside-this-repository`. Each is a prompt-level habit and the Gated tier's header, and
nothing else. Both the matrix and `doctor` name them, and both deliberately **exclude** the five `auto`
rules that also compile to nothing — an unattended rule enforced by nothing is the system working, and
reporting eight where three are real is how a report gets skimmed.

## Per-reason Stop-gate counters (task 0007)

`{consecutive, total}` → `{counts: {recipe, handoff}, total}`. Each reason caps at 3 and clears only on
its own condition; the non-resetting ceiling of 9 stays as the backstop. That removes the asymmetry the
maintainer's own ruling named — a missing five-line handoff riding to nine on the strength of a green
recipe, while a failing suite got three.

**A correction to the incoming state, since it changed this session's scope.** The build's session memory
recorded these counters as *merged* in #40. They were not: #40 recorded the **ruling** as task 0007. The
session-open supervisor verified that against `stop.mjs` and git rather than taking the claim on trust,
which is what the fresh-context checkpoint is for.

Re-run live end-to-end on the real tree: one dead link planted, blocked at `recipe 1/3`, `2/3`, `3/3`,
then released naming *"the cap of 3 consecutive refusals for `recipe`"* — the reason, not just the
number. A green tree allowed the stop in one attempt, as the positive control. **The handoff branch was
not re-run live**, and [`../compile/README.md`](../compile/README.md)'s observation table says so in the
row rather than in a footnote: on a day when any session has written a dated handoff the branch cannot
fire in this tree, and the fixture that forces it must first be made green against the `record` check.
Its arithmetic — including the two-reason interaction and the handoff capping at three with the recipe
green throughout — is pinned by the suite.

## Spec 2.1 → 2.2

Suite 255 → **309**, both measured (at `9e5f285` and at head) rather than derived — the base is not 244 because six commits landed on `main` mid-session and this branch was rebased onto them.

Additive: the optional `floor` object in the gate policy — `branch`, `checks`, `reviews`,
`resolve_conversations`. All four exist because they vary per repository and the export would otherwise
invent them; there are no defaults, because a compiler that invents the ref it gates has stopped
compiling policy and started writing it.

What a policy may **not** declare is `strict`. Proposal `0011` ruled that a pull request may not merge
from behind its base and applied it live; a declarable `strict: false` would be a compiled artifact
undoing a ruling in a diff nobody would read as one. `bypass_actors: []` is unconditional for the same
class of reason.

The bump also fixed a two-version-old lie: `spec/README.md` had said "the current version is **2.0**"
since the 2.1 bump, with the correct version in the `$id` two files away. Left visible in the file rather
than silently corrected — a fact with two carriers and only one of them checked is this project's
signature defect, and here it was in the spec's own README.

## The pre-commit checkpoint, which was worth more than the session's own review

**APPROVE-WITH-ADJUSTMENTS, eight required.** It re-measured rather than read — extracting the base tree
to count the suite there, reproducing the matrix numbers, and reading live protection itself rather than
taking this session's comparison on trust. Three findings changed the artifact rather than the prose:

- **The false story above**, which was the headline of this handoff's first draft.
- **`doctor` crashed on a policy that parses but that a backend refuses** — a declared floor no rule
  reaches, or gate rules that all compile to nothing. `backends()` sat outside the guard the `parse()`
  call was inside, so it threw out of `inspect`, exited 2, and discarded every verdict the run had already
  reached. That is the milestone-2 gates-file defect exactly, three lines under a comment citing it.
- **`--check` reported GREEN over an artifact the policy no longer compiles to.** Delete `floor` from a
  policy that had one and the ruleset stays on disk — importable, valid, and claiming in its own `name`
  field to be generated from the policy that stopped producing it — while the recipe compared nothing and
  said so in green. The **eighth** fail-open of this repository's series, and again in the scaffolding
  around a check rather than in a check. `--check` now reds on present-and-not-owed, and a plain compile
  removes it, so the remedy is the command the message names.

Both were red-tested before being fixed. The rest were record fixes: a stale cap sentence in the glossary,
a count given as nine where the tree says eight across three carriers, a historical demo attributed to the
wrong constant, and the provenance overclaim now split above.

## The Copilot round, which found four and was right about four

All four were about the **floor declaration being believed** — an input accepted here and then used in a
way that produces an artifact GitHub takes and does not enforce. That is the failure this backend is least
able to notice about itself, since nothing here imports anything.

- **`floor.branch` could carry a ref prefix.** `refs/heads/main` passed the branch pattern, and the
  emitter prefixes unconditionally, so the ruleset targeted `refs/heads/refs/heads/main` — importable,
  valid, matching no ref in any repository. In the one field that names what the floor protects.
- **A check context was stored untrimmed.** `" workspace-verify "` was non-empty after `trim()` and was
  emitted with its whitespace, requiring a check no job reports. Refused rather than normalised, matching
  how a rule target is treated four lines away: quietly fixing it hides a policy error in the file a human
  reviews.
- **The ref-rule table was consulted before the tier.** An `auto` rule spelled exactly `git push --force`
  compiled into `non_fast_forward` — a ruleset rule emitted for an action the policy calls unattended,
  with `floorRefusal`'s own `auto` branch unreachable for it. The table is only how this backend *spells*
  a gate; whether there is one is the policy's answer, and the order now says so.
- **The prose cross-check read a mutated array.** `claimedChecks` is emptied when there are no workflows
  to compare against, so on such a tree the cross-check reported that the gate map named nothing about a
  gate map that named it plainly. **The second consumer caught reading that array after the mutation** —
  the first fix added a separate flag for one consumer instead of making the array safe to read, so the
  next consumer inherited the trap. Fixed with a snapshot this time, so a third consumer inherits
  something true rather than something to remember.

All four red-tested first. Both emitted artifacts are byte-identical afterwards, which is the expected
result and worth stating: every fix was a refusal or an ordering, and none of them changed what *this*
policy compiles to.

**A second round found two more, both real.** The floor/prose cross-check was gated on the prose having
named at least one check — which exempted **the worst divergence there is**: a policy declaring required
checks beside a gate-map row that is missing or unrecognised. The generic "names no required status check"
note fires there and reports something else entirely, so the extreme case was the one case that went
unreported. A check that quietly skips its own worst input is `a-checker-must-refuse-what-it-cannot-check`
once more. And the plan's `289 at head` was read as contradicting `244 → 295` — it meant the head at the
pre-commit checkpoint, and now says so.

**The first attempt at the red test for that fix passed before the fix**, because it asserted on the
context name and an unrelated unpinned-check note in the same check class already mentions it. Tightened
to the cross-check's own sentence. Worth recording: a red test that is green is not a test, and only
running it first showed that.

**A third round found one more, and it is the sharpest of the seven.** The `pull_request` +
`required_status_checks` pair was emitted whenever `floor.checks` was non-empty — whether or not any rule
said changes go by pull request. That is the compiler **inventing policy**, which is the one thing this
backend must not do; and it broke the accounting silently, because those two ruleset rules would have sat
in the artifact with no policy rule credited for compiling them. The matrix and `doctor` would have
described a floor missing two of its own rules, in the reporting layer built to prevent exactly that. The
pair is now emitted only when a `propose` rule exists, every emitted rule is asserted to be credited to a
policy rule, and a `floor.checks` declaration with no `propose` rule is **reported** rather than dropped.
Suite 289 → 309.

**And the second rebase produced this session's third false claim — this one entirely mine, and the worst
of the three, because I asserted a mechanism that had not happened and then generalised a lesson from it.**

What actually happened: `main` moved six commits mid-session, one of which added path-escape validation to
`parse()`, the function this branch had rewritten. The rebase brought its tests too, and nine of them went
red. I read that as the auto-merge having silently dropped the validation, "restored" the block, and wrote
a handoff paragraph, a plan entry and a commit message about *a clean auto-merge being where a guard
disappears*.

**None of it was true.** The block came through the rebase untouched. The nine reds were entirely the
`compile()` → `parse()` rename: main's tests called the old name. `git show <commit>:cli/compile.mjs`
would have settled it in one command, and I did not run it. What my "restore" actually produced was a
**second copy of a load-bearing validator** — the outcome that comment warned against, created by the
comment's own author — which a later Copilot round caught. Duplicate removed; the surviving block is
main's, unedited.

The lesson that survives is smaller and less flattering than the one I invented: **diagnose a red before
narrating it.** A failing test tells you something is wrong, not what. And the generalisation I reached for
was appealing precisely because it made a merge, rather than a misreading, responsible.

_(The commit message carries the false version and cannot be amended without rewriting a pushed commit
others may have fetched. It stands, corrected here and in the plan — which is the same choice this
repository has made before about a merged record. On `main` the sha is **`1d4e9fb`**: the rebase-merge
replayed `ca872e8`, so the original is unreachable from `main` and citing it sends a reader nowhere.)_

**A fourth round found one more, and it arrived in the half nobody reads.** Copilot's *suppressed*
low-confidence section — no Resolve control, no effect on the merge gate, visible only to someone who opens
the review body — pointed out that `readCount()` rehydrated only the reasons `REASONS` declares and dropped
any other stored key. A reason this file emits without the constant declaring it would have reset to 0 on
every read: never reaching its own cap, released only by the ceiling of nine. That is exactly the asymmetry
task 0007 removed, reintroduced through a drifted list and silent in the direction of *more* patience — in
the file whose own comment says the constant exists so the pieces cannot disagree about what a reason is.

Fixed in two places rather than one, because making the runtime survive drift is not the same as preventing
it: every stored key is carried forward and then the known reasons are defaulted, so an undeclared reason is
still counted and still capped; and the suite now binds every `reason:` literal in this file to `REASONS`,
so a new reason added without declaring it is red in CI. Suite 307 → 309.

## What is left

- **Milestone 4 does not close in this session.** Its remaining clauses are all in this pull request, but
  a close needs the work merged and a fresh-context milestone-close checkpoint against the row. On
  Marius's instruction the close runs after his merge.
- **Exported-versus-live drift is checked by nobody automatically**, by the row's own ruling: `doctor`
  cannot fetch settings and a recipe here may not make a network call. It was compared by hand this
  session, field by field, and every value in the export matches the floor in force.
- **No import has been attempted**, and the inference behind "importable" is thinner than the first
  draft of this handoff said. The **envelope** and the list of server-only fields to omit were read from
  two live rulesets; neither of those carries a `pull_request` or a `required_status_checks` rule, so
  those two parameter blocks — the load-bearing ones — come from GitHub's documented schema and were
  checked against it at the pre-commit checkpoint. Observed values, observed envelope, documented
  parameters, no import. Importing is Gated.
- **The matrix has two columns**, and two is not many. A host with neither backend has no column, and the
  matrix says nothing about it rather than implying coverage.
- **Three pull requests merged under this session** — #48, #50 and one more — and the rebase onto
  `fab592d` took a conflict in `.portulan/gate-map.md` (resolved in favour of `main`, whose wording is
  better and already correct) and in `docs/plan.md` (two sessions appending the Session log; both entries
  kept). All six recipes re-run green afterwards. **Six further pull requests are open** — #49, #51–#56 —
  and two of them, #53 and #55, touch `gates.json` semantics and `cli/compile.mjs`. Whoever lands second
  reconciles; `strict` refuses a merge from behind regardless.
- **This handoff was written across midnight** and is dated for the session that produced it, 2026-07-27,
  which is also when every measurement in it was taken. The commit lands on the 28th.
