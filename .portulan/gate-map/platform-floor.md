# The platform floor — verification, layers and watchers

> The rest of the gate map's [platform floor](../gate-map.md#the-platform-floor), after its table of what `main` enforces.

Verified rather than asserted: a direct push to `main` was attempted after the change and rejected with
*"Changes must be made through a pull request."* This is the first gate in the repository that holds
against the agent, the maintainer, and any future collaborator equally — the difference between a rule
and a rail.

**The [*Required status checks* row](../gate-map.md#the-platform-floor) now has a second in-tree carrier, and they are checked against each other.**
[`gates.json`](../gates.json)'s `floor` declares the same required contexts as machine-readable policy, because
the floor backend has to emit them. Two files stating one fact is this repository's signature defect, so
`doctor` compares them and reports any divergence — the same containment already applied to the rule ids
[in the index](../gate-map.md#where-the-policy-actually-lives-since-milestone-4). It is worth knowing exactly how narrow the older check was: `doctor`'s claims lint reads this row and
compares it against the **tree**, where both jobs exist, so a row naming one of two contexts passed. The
cross-check is what closes that, and it closed it on its first run — against a branch whose checkout
predated [#50](https://github.com/sleepy-panda-srl/portulan/pull/50), where this row still named one
context and `main` had already fixed it. A fair demonstration of the class, and not a defect found in the
record.

Neither carrier is the live setting, and that gap is real: whether branch protection *actually* requires
these contexts is an API fact no check here fetches. It is read by hand at the supervised checkpoints.

**One row is weaker than it reads, and it is the one another section leans on.** Conversation resolution
requires every thread **resolved**; it does not require that anyone holding the merge gate agrees with it.
A thread can be resolved by the very reviewer that raised it — measured 2026-07-27 on
[#44](https://github.com/sleepy-panda-srl/portulan/pull/44), where Copilot cleared its own objection once
a reply addressed it, unasked. So the row stops a comment being *ignored* and establishes nothing about
whether it was *answered*; `resolvedBy` is the field that tells them apart. This matters beyond the floor,
because "Which identity acts" argues that resolving belongs to the merge gate on the strength of this
setting — that argument survives, since it rests on who *should* judge, but it may not be read as the
platform guaranteeing a judgement happened.

**The floor is three layers, and this section used to describe only one.** Recorded 2026-07-27, after an
audit prompted by an unrelated question found the table claiming to say what `main` enforces while omitting
two mechanisms that also enforce it. The errors ran in *both* directions, which is why the audit was worth
more than the patch:

1. **Classic branch protection** — every row of [the table](../gate-map.md#the-platform-floor) attributed to it. Read at
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
[`compile/github-ruleset.json`](../compile/github-ruleset.json) is what [`gates.json`](../gates.json) compiles to
for the platform-floor backend: an importable GitHub repository ruleset carrying a pull-request
requirement, these required checks (strict), a force-push block and a deletion block. It is **generated,
never applied** — importing it is a settings change, Gated, and nobody has — so [the table](../gate-map.md#the-platform-floor) still
describes the live configuration and that file describes what the policy *says* the floor should be. They
agree today, checked by hand at this session's checkpoints. Nothing checks them automatically, and nothing
here can: `doctor` does not fetch settings and no verify recipe may make a network call.

**A second ruleset exists and is deliberately not part of the floor.** `copilot auto-review on pull
requests` — id `19805871`, repository-sourced, added 2026-07-27 — targets the same `~DEFAULT_BRANCH` and
carries the single rule `copilot_code_review`, so every pull request a person opens gets a Copilot review
requested without anyone remembering to ask; a bot's is
[`copilot-request.yml`](../../.github/workflows/copilot-request.yml)'s, see *Which identity acts*. It is recorded
here because anyone auditing `repos/{owner}/{repo}/rulesets` will now find two and needs to know which is which.

It gates nothing directly: required approving reviews remain 0, and a Copilot review arrives as `COMMENTED`
rather than as an approval. The honest qualification is that it can still decide whether a change lands —
conversation resolution is required on `main`, so a Copilot review that leaves an inline comment opens a
thread that blocks merge until the maintainer resolves it, which is exactly what happened on
[#25](https://github.com/sleepy-panda-srl/portulan/pull/25). Not a gate, then, but upstream of one.
_From 2026-07-29 to 2026-09-23 the round's outcome was also displayed as an approval, submitted by the
agent identity rather than by Copilot; that derived verdict left with `copilot-review.yml`, and
[*Merge discipline*](merge-discipline.md) says what carries the round now._

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
[`memory/a-branch-syncs-with-main-before-it-merges.md`](../memory/a-branch-syncs-with-main-before-it-merges.md)
and [`proposals/0011-no-merge-from-behind-main.md`](../proposals/0011-no-merge-from-behind-main.md).

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
[`proposals/0004-ci-runs-every-declared-recipe.md`](../proposals/0004-ci-runs-every-declared-recipe.md).

The check is also **pinned to app 15368** (GitHub Actions). Without an app id, any GitHub App reporting a
check of that name would satisfy the gate — a distinction the branch-protection UI does not surface, and
one the API does.

**`CODEOWNERS` exists as of milestone 3 — and it is not yet part of the floor.**
[`../../CODEOWNERS`](../../CODEOWNERS) records who owns which paths and routes review requests. Every path is
owned by the org team **`@sleepy-panda-srl/maintainers`** rather than by a person: the team was created
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

So the honest position is unchanged where it counts: [`../../docs/vision.md`](../../docs/vision.md) is still
protected by [the prohibition](../gate-map.md#prohibited--what-no-yes-makes-acceptable) and **not** by the platform. What the file adds today is that
ownership is written down; what it adds later is a rail, on the day a second reviewer exists and the
setting can be switched on. That switch is a repository-settings change — Gated.

**The floor now watches what the repository pins**, as of 2026-07-27, per
[`proposals/0006-dependabot-security-updates.md`](../proposals/0006-dependabot-security-updates.md):

> Every dependency the repository pins is watched for published advisories by the platform, not by
> whoever remembers to look. Dependabot alerts and security updates are on, and the dependency graph that
> feeds them is on. A pin that cannot move on its own requires something that can tell you when it should.

The occasion was a SHA-pinned `actions/checkout` that declared a deprecated runtime for as long as GitHub
had been deprecating it, with the warning in a green run's log as the entire notification mechanism. SHA
pinning is the organisation's policy and the policy is right; **a SHA pin is also by construction a pin
that never moves**, so what closes the tag-hijacking hole opens a staleness one in its place, and the
mandate was adopted with nothing paired to it that could answer for the drift
([`memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)).

Three settings, and they chain — the graph feeds alerts, alerts feed security updates, so enabling only the
last does nothing. Each is a repository-settings change and therefore **Gated**. Worth stating precisely,
because the short version of that sentence drifts into a stronger claim than it can carry: the *agent
identity's* token cannot touch repository settings at all, but of the three only the dependency graph has
no repository-level REST endpoint. Alerts and security updates are both reachable by any admin-scoped
token — including the maintainer's own credentials, which this repository already routes every commit
through. Two of the three are withheld by the gate rather than refused by the platform, and a gate map
that blurs those two has mislaid the distinction it exists to record.

**What it buys today is one watched dependency**, and the count belongs in the record rather than rounded
up: the workflows under [`../../.github/workflows/`](../../.github/workflows/) are the tree's only manifests,
`actions/checkout` — one SHA, pinned in every one that uses an action — their only entry. **Corrected at milestone 7:**
this said there is no `package.json`. There is one now, at the root, carrying the CLI's `bin` — but it
declares **no dependencies** and there is still **no lockfile**, so it adds nothing for a scanner to
watch and what is watched is unchanged. The mechanism is the point and not the count — but a floor described as
broader than it is would be the same drift this rule was added to catch. _(Until 2026-07-29 this sentence
named `verify.yml` as the only manifest, which had been false since the label and librarian workflows
arrived carrying the same pin — the stale-count class again, corrected in the change that made
`copilot-review.yml` the fourth. **It then read "each of the four" and went stale a second time**, when
`publish-github-packages.yml` landed on 2026-08-20 and again when `drills.yml` landed on 2026-08-25 —
so the figure is **deleted** rather than corrected a third time, which is this milestone's standing
repair: state the scope, and let [`../../packs/tools/github/verify/actions-pinned.sh`](../../packs/tools/github/verify/actions-pinned.sh)
be the one carrier of how many there are, since it is the thing that cannot be wrong about it.)_

**A watcher earns its place by being watched**, as of 2026-07-27, per
[`proposals/0007-every-watcher-ships-with-its-observation-procedure.md`](../proposals/0007-every-watcher-ships-with-its-observation-procedure.md):

> A watcher earns its place by being watched. Anything added here whose job is to notice something — a bot,
> a scheduled job, a required check, an alert, a review request — ships with the procedure that would
> demonstrate it works, and that procedure is run once and its result recorded. Where no such procedure
> exists, the artifact says so in as many words, and says that its own silence is not evidence.

The occasion was a watcher adopted because nothing was watching, which nothing then watched.
[`../../.github/dependabot.yml`](../../.github/dependabot.yml) landed to catch drift in the Actions pins and for
five days had no evidence behind it at all: version-update jobs have no REST endpoint, no `dependabot` check
run appeared, and the pin already sat on the newest release, so the correct behaviour was to open nothing.
**Success and failure produced the same silence** — the same shape as the incident that prompted the watcher.
Third instance of
[`memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
in one subject area, and the first where the unchecked mandate was itself a checker.

Three watchers were made to produce a positive signal on the day the rule was adopted, and those are the
worked examples of what the rule asks for:

| Watcher | The procedure that was actually run |
|---|---|
| Dependabot version updates | the pin was deliberately regressed one patch to v7.0.0; Dependabot opened the bump back to v7.0.1, and merging that was simultaneously the proof and the revert |
| Dependency graph, alerts, security updates | the SBOM went `404` → `200`, and then tracked a pin *through a change* — which the first reading alone could not have shown |
| Copilot auto-review ruleset | recorded as unvouched-for with its test stated in advance — the first pull request opened after `09:30:38Z` — and Copilot was then requested on that pull request at open, unasked |
| The forced-red drill calendar — [`../../.github/workflows/drills.yml`](../../.github/workflows/drills.yml), 2026-08-25 | **Split, because its two halves are answerable at different times, and the procedure is written before either answer exists.** The **sweep** is demonstrated: `node cli/drills.mjs` forced all twenty-one rails red by hand on 2026-08-25 and every one fired, transcript in that session's handoff. The **`workflow_dispatch`** half is **observed**: run [`32883413709`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32883413709), dispatched on `da9c06e` immediately after the merge put the file on the default branch, 21 of 21 forced red and fired — recorded in [`drills.yml`](../../.github/workflows/drills.yml)'s header. The **`schedule`** half was answered by the first Thursday run and by nothing earlier; **it has now answered twice**, and both runs — with the dispatch above them — are in [`drills.yml`](../../.github/workflows/drills.yml)'s header, which is the **one carrier** of that answer and the place to read it from rather than this row. What is unchanged is that **a silence is still not evidence**: a scheduled run that never starts stays undetectable from inside ([#344](https://github.com/sleepy-panda-srl/portulan/issues/344)), so *the schedule is vouched* and *a missing run would be noticed* are two claims and only the first is true. _(This clause read *"until then this calendar is unvouched"* after the dispatch was recorded one sentence above it, which contradicted the split the same row establishes and the wording the two other carriers had already taken. A row that observes one half and then calls the whole thing unvouched is the carrier disagreement this file's own header warns about, inside the row whose subject is halves answered at different times. Copilot, round 1 on #349.)_ |

**The honest limits, because the rule is weaker than it sounds.** Nothing here checks it: whether a watcher
works is a fact about live services, and `doctor` already reports live settings as something it does not
fetch. What makes it more than taste is that it asks for an *artifact* visible in a diff — either a stated
procedure or a sentence admitting there is none — so a reviewer can require it where no script can. And not
every watcher can be forced red safely: this one could, at a cost of one patch and a few minutes of a
required check running an older action, while a watcher for something destructive, rate-limited, or
irreversible may have no safe red test at all. The rule prefers evidence and settles for an admission, and
it should not pretend those are equal.

One corollary learned the same day, and left in
[`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml) where it will be tripped over:
**a mechanical revert is not a narrative revert.** Dependabot rewrote the pin and could not rewrite the
paragraph describing the pin, so `main` briefly carried a deliberate-regression notice above a line that no
longer matched it — a false claim produced by the fix working exactly as designed. When a bot rewrites a
value, the prose around it is the half nothing checks.
