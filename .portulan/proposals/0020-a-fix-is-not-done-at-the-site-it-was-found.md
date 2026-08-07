# 0020 — A fix is not done at the site it was found

**Status.** Proposed — the maintainer ruled on 2026-08-07 that this lesson becomes a proposal rather
than staying in thirteen commit messages. He has not ruled on its content; that is what this asks for.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/168

**Companion:** [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md) establishes
that the grader must not be the context that did the work. This proposal is about a defect that survives
even when it is — because on the incident below the fresh grader was blind to it too, and the reviewer
that found it needed eleven rounds past a bound designed to stop at two.

## The incident

[#164](https://github.com/sleepy-panda-works/portulan/pull/164) drew **thirteen Copilot rounds**, and
every round found at least one defect that pull request had introduced. Rounds 1→2 registered an undo
before the first write at the destination and left the retire step one function down. Round 4 found a
directory sitting where a file was planned, in a `collisions()` copied from `cli/new.mjs`, so the fix had
to land twice. Round 12 found the same collision reached from the **source** side, eight rounds later, in
a rule the same change had written two rounds earlier. Round 13 found the allow-list exempting a FIFO
where `walk()` already refused one.

The sharpest is round 5. `carveOut()` read a destination manifest through a symlink, because the read ran
ahead of the symlink guard. `cli/init.mjs`'s `residenceAt` had **already shipped that exact defect, fixed
it, and written the general lesson into a comment**:

> A guarantee that depends on which check runs first is not a guarantee.

That comment sits in the function the implementing session read closely enough to copy three separate
rules out of — the collision walk, the `chain` boundary, and the only-`ENOENT` rule. It copied the tool
and not the lesson.

**And the class is older than this pull request.** The maintainer ruled on it on **2026-07-27**, on
[#43](https://github.com/sleepy-panda-works/portulan/pull/43): *"never ship a change that corrects one
wrong claim while knowingly leaving its neighbours."* Since then: [#60](https://github.com/sleepy-panda-works/portulan/pull/60),
between two branches of one function five commits apart; [#117](https://github.com/sleepy-panda-works/portulan/pull/117),
where `--pack-root`'s check landed in one tool of three and the persona-scope hardening left
`compareOrWrite` with the same hole six hundred lines up the same file;
[#91](https://github.com/sleepy-panda-works/portulan/issues/91) and
[#92](https://github.com/sleepy-panda-works/portulan/issues/92), two arms of one function disagreeing
about whether a filesystem fact is a verdict.

## The claim

**A rule with two prose carriers is obeyed at the narrower one. A rule with two enforcement sites is
repaired at fewer than all of them. These are one defect in two materials, and they have one repair.**

The identity is not a rhetorical join; the tree already uses one word for both. `spec/README.md` says a
fix that repairs one **carrier** *"and knowingly leaves its sibling is the defect this repository names
most often"* — of code. And of prose, in **13 occurrences across 13 files** (the twelve milestone-file
headers and proposal [`0017`](0017-one-repository-one-governing-workspace.md)), the exact clause *"a rule
with two carriers is obeyed at the narrower one, which is the defect this repository names more often
than any other"*, with `docs/plan.md` carrying it of a *mandate* and `.portulan/dod.md` twice more as
*"a second, narrower carrier"*. Two superlatives that cannot both be true unless they are the same defect.

_Those are **occurrence** counts over whitespace-normalised text with blockquote and comment leaders
stripped, which is not the same as a count of **carriers** — most are the rule being used to justify a
decision, and this proposal's own argument is that a use is not a carrier. A figure without its unit is
what this file's neighbour [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md)
was amended to prevent. `core/templates/persona.md` was a fourteenth and is re-pointed by this change._

The mechanism is the same in both: a rule is carried where it is enforced, several carriers exist with
none designated authoritative, they drift, and a repair or a copy reaches a subset. The **symptoms**
differ by material and the proposal states them separately for that reason — prose is *obeyed* at the
narrower carrier by a reader, code is *repaired* at fewer than all sites by an author. The repair is
identical: one carrier, and the others reach it. In prose that is citing, which
[`../dod.md`](../dod.md) conditions 6 and 7 were repaired **into**. In code it is calling, which
`cli/doctor.mjs` and seven other cross-tool imports already do.

**This supersedes a merged ranking of them as two classes.** #164's round-2 commit calls the code defect
*"the class this repository names second-most often"* — first and second, not one. That sentence is
overturned here rather than left to disagree quietly with the doctrine.

**And "never stated" would be false, which is the more useful fact.** The rule has been stated
repeatedly. What it has never had is a **carrier governance reads**: the 2026-07-27 ruling is quoted
verbatim in exactly one place in the tree — a test comment, `cli/doctor.test.mjs:1851` — and referred to
as *"a standing ruling"* in `cli/compile.mjs:852` and in #91's own comments. An eleven-day-old maintainer
ruling living in a test comment did not prevent five-to-eight recurrences on one pull request. That is
[`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
exactly, and it is what this proposal repairs: not a missing rule, a missing carrier.

## What is measurably true on `main` at `d2d8f2a`

Every figure below was re-measured for this proposal. Units are named because this file's neighbour
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) records what
happens when they are not.

| Rule | Independent enforcement sites |
|---|---|
| *refuse a collision before the first byte* | **3** exported `collisions()` — `cli/init.mjs:952`, `cli/new.mjs:172`, `cli/vendor.mjs:390` — three signatures, three return shapes, three refusal vocabularies |
| *only `ENOENT` means absent* | **35 lines** mentioning `ENOENT` across 7 of the 11 non-test CLI modules (a line count spanning code and comment, not a count of guards) |
| *refuse a symlink rather than resolve through it* | **5** non-test modules |
| *never `existsSync` — it follows links and answers false on EACCES* | warned about in comments in **6** modules; **18 live `fs.existsSync(` calls** remain |

_The `existsSync` figure was **27** in this session's first draft, which counted every line mentioning
the identifier — including the ten comment lines warning against it. A census that counts the warnings as
violations is the same defect one layer up, and it is corrected here rather than quietly._

**A live instance, reproducible in two commands.** `cli/index.mjs:256` states the rule —

> Present and unreadable is not "absent". Skipping it would drop a record from the index silently, which
> is precisely the shape a generated file must never have.

— and `cli/index.mjs:781`, **525 lines below it in the same file**, is `} catch { /* absent … */ }`.
That is #91, open since it was filed, in the file that argues against it.

## The class's own count drifted, inside the change whose subject is drift

#164's records claim the class **four** times and disagree three ways: round 5 says *"Fourth appearance
of #91's class this milestone"*, round 10 says *"the fifth appearance in this pull request"*, round 12
says *"#91's class for the fifth time"*, round 13 says *"five separate times"*. Three consecutive
instances each recorded as the fifth. Two different scopes — the milestone, the pull request — used
interchangeably. **Membership was never defined**, so no figure was re-derivable, which is precisely the
gap `a-review-loop-needs-a-bound.md` closed for round counts on 2026-07-30 and nobody closed for this.

**The test this proposal uses**, chosen so the count survives its author: *a finding whose governing rule
already existed elsewhere — in the same change or in the tree — when the defect was written.* It is
re-derivable from the diffs, which is the whole requirement.

Under it, **eight of #164's thirteen rounds** are this class:

| Round | The rule, and where it already was |
|---|---|
| 1 | only-`ENOENT`, stated three times in `cli/vendor.mjs`'s own header; three fail-opens below it |
| 2 | round 1's undo-before-first-write, missed in the retire step one function down |
| 4 | the collision preflight, copied from `cli/new.mjs` — fixed in both |
| 5 | the read-before-guard ordering, shipped, fixed and explained in `cli/init.mjs` |
| 9 | the containment rule the same file states three times, missed on the one path the check could not see |
| 10 | only-`ENOENT` again, broken in the one call written as a convenience |
| 12 | round 4's rule, half-carried — refused at the destination, not at the source |
| 13 | `walk()`'s not-a-file refusal, missing from the destination's allow-list |

Round 6 is the honest borderline and is excluded: `init`'s partial write is an analogy, not the same
rule. Rounds 3, 8 and 11 are other classes. So the number is **eight, not five** — and the five was this
session's own inherited figure, corrected by the test rather than by recounting.

## Why both of this repository's checkers were blind

**The suite caught 0 of 13.** Measured, not quoted: 966 tests at `c00f242`, the commit immediately before
round 1, and 983 at `d2d8f2a`, each run in a throwaway worktree. **+17 tests, every one written after
Copilot named the defect it covers.** The harness could express all thirteen and contained none of them.
This is [`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
and is cited rather than restated; what this incident adds is the narrower observation that a harness
written *to check a change* inherits that change's blind spot by construction.

**The fresh-context pre-commit checkpoint caught none of them either.** It graded the diff and returned
five findings — four blockers and one adjustment — and, per #164's own record, *"every blocker was a
record out of agreement with the tree"*. It was not asleep; it was **never asked**. `pre-commit`'s pass
had a step for attacking coverage claims and a step for forcing new rails red, and no step that asked
where else the rule being repaired was carried. _(One correction the record is owed: the checkpoint
cannot be charged with all thirteen. Round 12's defect was born in round 10's fix and was not in the diff
it graded.)_

**So the only thing that found this class was an outside reviewer, run past its bound.** That is a
narrow base to stand a rule on, and it is the reason for the bound amendment below.

## What a rail would be — and what no rail can do

The maintainer's bar is that a rule enforces itself, measures itself, or earns its context-window tokens.
Answering it honestly means saying the discouraging half first.

**For the class as a class, no rail is possible.** A rule has no token. Nothing can grep for *this
patch's rule's other carriers*, and no hook, gate or eval can observe that a fix has unswept siblings —
the sibling set is exactly the thing nobody has enumerated, or the defect would not exist. A proposal
claiming otherwise would be a capability claim, which
[`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
forbids. What follows is therefore one rail, one procedure step, one bound amendment, one piece of earned
prose, and one refusal — labelled as what each is.

### 1. Earned prose: leave one site (`core/operating/evolution.md`)

Not a rail, and it does not pretend to be. Its claim on tokens is that it **removes what would otherwise
need enforcing**, which `evolution.md` already ranks above catching and never explains how to reach. The
mechanism is carrier count: a rule with one site cannot be missed at a second.

It is codification, not invention. The repository reaches for this repair already and has never named it:
`cli/doctor.mjs` importing one frontmatter parser *"because a second implementation here would be a
second carrier of one contract"*; the same file importing `isInside` because *"the copy that used to live
here **drifted into the identical fail-open as the original**"* — two copies, one defect, arrived at
independently, which is the measurement that makes the whole argument; `.portulan/verify/README.md`
deleting a second definition rather than correcting it *"so the two cannot drift apart again"*; #164's
`scan()`; and eight cross-tool imports in `cli/` altogether.

**Its honest limit:** it applies where a rule can be a function. Where a rule is a cross-cutting
convention — only-`ENOENT` holds at 35 sites and cannot be one — the site count is irreducible, and only
the procedure step below reaches it.

### 2. The rail, built here: pin the sites that cannot be merged (`cli/collisions.test.mjs`)

The three `collisions()` cannot share an implementation without a module none of the callers wants: the
signatures differ because `init` writes a drafted map, `new` writes one artifact, and `vendor` copies a
workspace and carries an allow-list the others have no use for. So they are pinned instead — the pattern
`cli/doctor.test.mjs:2081` already states, where two flags are asserted together *"so a future divergence
reds here rather than drifting"*.

**Measured before written, and the measurement changed the plan.** The session-open checkpoint predicted
the contract would land red on a `continue`/`break` divergence in the ENOENT branch. Probed against a
real filesystem across seven states — absent, a file, a directory, a symlink at the leaf, a symlink on
the chain, a FIFO, an unreadable directory — **all three carriers return the same answer to every one**.
The divergences are in their sentences and their internal shape, and the suite pins neither: those
vocabularies are written for three different readers, and freezing them would stop the refusals being
improved. The checkpoint read the source; the contract is the behaviour, which is this repository's own
hierarchy applied to its supervisor.

So it lands **green and establishes nothing new about the tree**. What it converts is an agreement held
today by three independent accidents into one that reds when it stops being held. That is the difference
between a rule that is *true* and a rule that is *carried*, and it is this proposal's whole subject.

**It also pins the roster** — a fourth `collisions()` appearing in `cli/` reds the last test — which is
the half a behavioural contract cannot supply on its own. A copy nothing asserts is invisible to every
other test in the file, and is exactly how the third came to differ from the first.

**Forced red both ways and restored**, because a check nobody has seen fail is a check nobody has seen
work: re-introducing round 4's actual defect in `new.mjs` alone reds that carrier's directory case and
leaves the other two green; adding a fourth exporting module reds the roster.

### 3. The procedure step: the checkpoint is asked (`packs/rituals/checkpoints/.../pre-commit`)

Step 4 of seven: name the rule each fix restores, find that rule's other sites, and either fix each or
record which were knowingly left. **Priced honestly** — this adds a step to a checker measured blind to
the class on this very incident, and the checkpoints pack's own README says it cannot enforce the
freshness that makes it work. Its defence is that it was never asked, and that it is the only mechanism
here that reaches an **unknown** sibling set. It is a ritualised question, not a rail, and is labelled as
one.

### 4. The bound amendment, in place (`.portulan/memory/a-review-loop-needs-a-bound.md`)

This class **generates its own next round** — a sibling of round N's fix cannot surface before round N+1
— so a bound that counts pushes retires the loop exactly where the class is still producing. Six of
#164's eight arrived after the bound. Rule 4 is amended in place, never carried a second time, with
*sibling* defined operationally so the count stays re-derivable.

**The two precedents are named rather than smoothed**, because they contradict. #85 read the bound
strictly, triaged the same finding through rounds three to seven, and the product of that triage is #91 —
still open on 2026-08-07, with the defect still at `cli/index.mjs:781`. #164 ran eleven rounds past on
the maintainer's grant, and every round found a real defect. Triage is not a free disposal; it is a
deferral whose measured half-life here is indefinite. The grant stays his, the taper stays judgement, and
the taper stays outside the countable bound.

### 5. Refused: a grep, with or without waivers

The one sub-rule with a mechanical shape is *never `existsSync`*. A check requiring every call to carry a
stated waiver is buildable and would have caught **round 10 — one of the eight**, at a cost of eighteen
annotations. Refused on the ground that a grep finds a **primitive** while the rule is about a
**predicate no grep reads**: of the eighteen live calls, some are guards where ENOENT-versus-EACCES
decides the answer and some are not, and nothing in the token says which. A check that fires eighteen
times to find one is a check that gets suppressed — and this repository has already paid for the
false-red shape, in `docs/milestones/m07.md`, where a matcher could not tell a persona disclaiming
*Prohibited* from one claiming it. The cheaper variant — ratchet the count and fail on an increase — is
refused too: a baseline that bumps on every legitimate addition is waiver noise wearing a number.

## Where this lands, and what it deliberately does not do

- **The doctrine sentence: `core/operating/evolution.md` only**, extending *Every mistake compiles into a
  rule* rather than opening a section. That section owns *impossible or caught*; this completes it.
- **`.portulan/dod.md` gets nothing.** Conditions 6 and 7 already cite rather than restate, and a ninth
  condition would be the third carrier of a rule whose entire content is *do not do that*.
- **`core/operating/verification.md` gets nothing.** It governs done-claims and certifiers, not how
  repairs compound.
- **`core/templates/persona.md` is re-pointed**, and this is the change's own medicine: it stated the
  two-carrier rule inline as its reason for not restating the persona contract, so with core now stating
  that rule once, the template cites it. One clause. **Flagged as the part to reject** if the reflexive
  edit is unwanted; nothing else depends on it.
- **The twelve milestone headers and `docs/plan.md` are deliberately NOT swept.** They use the rule as a
  justification for a decision, not as a rule anyone must obey — a *use*, not a carrier. If every mention
  were a carrier this proposal could not be written. And a forward-only cutoff is this repository's own
  treatment of records written before a rule existed.
- **No pack is named in core**, and no threshold: which work earns a checkpoint stays the workspace's,
  unchanged from [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md).
- **The checkpoints pack's own version rides its content change**, `0.1.0` → `0.2.0`. This one is worth
  recording because it is the rule catching the change that states it, at the last moment it could have:
  `portulan.version` is what a consumer **pins** on and what an install is cached by —
  `<marketplace>/<plugin>/<version>/` — so editing a `contributes.skills` artifact and leaving the
  version would have shipped **one identifier with two contents**, which is this defect exactly. The
  pre-commit checkpoint reported no bump was owed *because the manifest had never bumped on a content
  edit*; that manifest has exactly one commit in its history, so the absence of precedent was an absence
  of prior edits, not a ruling. The real precedent is in
  [`../handoffs/2026-07-30-a-link-resolves-in-the-repository.md`](../handoffs/2026-07-30-a-link-resolves-in-the-repository.md)
  and goes the other way: a bump rode a pack content change *"because an install is resolved and cached
  by the manifest's version field."* MINOR rather than PATCH because that change was a rail fix and this
  one adds a step a consumer receives. `pack.json` is the only carrier of that version — checked.

## Limits

- **The eight are one pull request.** The longitudinal record (#43, #60, #117, #91/#92, #164) says the
  class is real and recurring; it does not say eight-of-thirteen is a rate. Nothing here is a base rate.
- **Part 1 neither enforces nor measures itself**, by construction — it is a design rule, and the first
  thing forgotten under deadline is a design rule. It is the part most likely to decay, and the pin in
  part 2 exists because of that, not beside it.
- **Part 3 has never been observed catching anything.** The one demonstration available is this pull
  request's own pre-commit checkpoint running the new step against this diff.
- **The eighteen `existsSync` calls stay checked by nothing**, permanently, under part 5's refusal. That
  is a cost of the refusal, not an oversight.
- **The three `collisions()` are pinned, not unified.** Unification is named as part 1's first
  application and is not in this change; the pin is what makes deferring it safe rather than merely
  recorded, which is what
  [`../memory/a-recorded-limit-is-not-a-managed-limit.md`](../memory/a-recorded-limit-is-not-a-managed-limit.md)
  asks. **Filing that issue is the maintainer's to authorise** and is put to him with this proposal.
- **A finding this proposal reports and does not fix.** The superlative *"the defect this repository names
  most often"* appears **at least 37 times across 31 files** and attaches to at least **three different
  defects** — the two-carrier rule, the fail-open, and prose claiming an enforcement that does not exist —
  with no count ever run behind any of them. It is the class committed on the class's own name. Repairing
  it is a 37-site prose sweep and belongs in its own change, not folded into a doctrine diff nobody could
  then review. _The figure is a **floor**: three sweeps returned 27, then 29, then 37, each time because
  the pattern was narrower than the claim it was tested against — first line wraps, then blockquote and
  comment leaders. That is the same failure `a-review-loop-needs-a-bound.md` records for its own census,
  reproduced independently here, and it is why no exact number is asserted._

## Decision

Marius Cetanas — **pending**. He ruled on 2026-08-07 that the lesson becomes a proposal; the rule itself,
the reflexive `persona.md` edit, and the `collisions()` unification issue are the three things this asks
him to decide.
