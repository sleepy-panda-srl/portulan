# Handoff — a fix is not done where it was found

**Milestone 7, session 4.** The maintainer's ruling of 2026-08-07: the lesson of
[#164](https://github.com/sleepy-panda-works/portulan/pull/164) becomes a proposal, and the proposal must
decide **what a rail for the class would be** rather than only that the class exists. **M7 still open** —
this session touches none of its outstanding deliverables.

## State

Two commits on `m7-a-fix-is-not-done-where-it-was-found`: the rail (`cli/collisions.test.mjs`) and the
doctrine (`core/operating/evolution.md`, `packs/rituals/checkpoints/skills/pre-commit/SKILL.md`,
`.portulan/memory/a-review-loop-needs-a-bound.md`, `core/templates/persona.md`, and the checkpoints pack
bumped `0.1.0` → `0.2.0` because an install is cached by that version). Suite: `main` **1033** → branch
**1055**, both measured in throwaway worktrees, a delta of exactly the 22 the new suite adds;
**all NINE recipes green** — `main` moved twice under this branch and the second move shipped a ninth
recipe (`control-chars`), so *"eight recipes"* was true when written and false an hour later. Re-measured
rather than adjusted, which is the third time in this session a figure moved under a record; seam scan
clean on diff, message, branch and paths at every commit.

**Proposal `0020` is written (293 lines) and deliberately held OUT of the tree**, in this session's
scratchpad, until the pull request exists. `docs.sh` check 5c fails a proposal naming no pull-request
URL, so the file cannot be valid before the URL it must name — the ordering is forced by the rail, not
chosen. The same constraint moved `evolution.md`'s provenance pointer and the CHANGELOG entry out of the
doctrine commit and into the proposal commit, so that **every intermediate commit is green on its own**
rather than one of them carrying a known red.

_This handoff is written before the loop rather than after it, which is a deliberate reading of rule 2 of
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md): that rule governs
the **push**, and nothing has been pushed, so there are no rounds to land between. What it forbids is a
record asserting a total that can still move — so the round count, the fidelity verdicts and the pull
request number are named as in-flight below rather than stated, and are filled in the final push._

## Decisions + why

- **The claim is an identity, not two classes** — a rule with two prose carriers is obeyed at the
  narrower one, a rule with two enforcement sites is repaired at fewer than all of them, and these are
  one defect in two materials with one repair (one carrier, the others reach it: citing in prose, calling
  in code). Because the tree already uses one word for both: `spec/README.md` says *carrier* of code and
  twelve milestone headers say *carrier* of prose, each calling its own **"the defect this repository
  names most often"** — two superlatives that cannot both be true unless they are the same defect. This
  **supersedes #164 round 2's merged ranking** of them as first and second most common, which is named in
  the proposal rather than left to disagree quietly.
- **"Never stated" is false, and the true version is the more useful one** — the class has a maintainer's
  ruling of **2026-07-27** (*"never ship a change that corrects one wrong claim while knowingly leaving
  its neighbours"*), quoted verbatim in exactly one place in the tree: a **test comment**,
  `cli/doctor.test.mjs:1851`, with `cli/compile.mjs:852` and #91's comments referring to it as a standing
  ruling. So this repairs a **missing carrier, not a missing rule** — which is
  [`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
  and is a stronger provenance than minting something new.
- **No rail is possible for the class as a class, and the proposal says so first** — a rule has no token,
  so nothing can grep for *this patch's rule's other carriers*, and no gate can observe that a fix has
  unswept siblings, the sibling set being exactly what nobody enumerated. The maintainer preferred that
  answer to prose dressed as a rail. What ships is labelled: earned prose (leave one site), one real rail
  (pin what cannot be merged), one procedure step, one bound amendment, one refusal.
- **The doctrine extends `evolution.md`'s existing section rather than opening one, and `dod.md` gets
  nothing** — because conditions 6 and 7 already cite rather than restate, and a ninth condition would be
  the third carrier of a rule whose whole content is *do not do that*. `verification.md` was considered
  and rejected: it governs done-claims and certifiers, not how repairs compound.
- **`core/templates/persona.md` is re-pointed and the twelve milestone headers are not** — because the
  template stated the rule inline as its own reason, which with core now stating it once would leave core
  carrying it twice on merge day; whereas the headers *use* the rule to justify a decision rather than
  stating it as binding. **That use-versus-carrier distinction is load-bearing and is the thing to attack
  first**: if it does not hold, this change ships the defect it names. Alternative considered and rejected:
  sweeping all fifteen, which would make the proposal unreviewable and contradicts this repository's
  forward-only treatment of records written before a rule existed.
- **The `existsSync` grep is refused, priced rather than hand-waved** — a waiver check would catch **1 of
  the 8** at a cost of 18 annotations, and a grep finds a *primitive* where the rule is about a predicate
  no grep reads: of the 17 live calls some are guards where ENOENT-versus-EACCES decides the answer and
  some are not. The count-ratchet variant is refused too — a baseline bumping on every legitimate
  addition is waiver noise wearing a number. Precedent for the false-red cost is in
  [`../../docs/milestones/m07.md`](../../docs/milestones/m07.md), where a matcher could not tell a persona
  disclaiming *Prohibited* from one claiming it.
- **The bound is amended in place, and both precedents are named rather than smoothed** — #85 read rule 4
  strictly, triaged the same finding through rounds three to seven, and the product of that triage is #91,
  which then stayed open **nine days** and was closed by #166 an hour after #164 merged — in a change
  that recurred the same class inside its own fix; #164 ran eleven rounds past on the
  maintainer's grant and every round found a real defect. Triage is a deferral whose measured half-life
  here is indefinite. The grant stays his; the **taper** stays judgement and stays outside the countable
  bound; *sibling* is defined operationally so the count remains re-derivable from the diffs.

## What the measurements changed, which is the part reading would not have given

- **The class is eight of #164's thirteen rounds, not five.** The five was inherited and unre-derivable:
  membership had never been defined, and #164's own records say *"fourth"*, *"fifth"*, *"fifth"*,
  *"five"* at four separate points — three consecutive instances each recorded as the fifth, across two
  different scopes (the milestone, the pull request). **The count drifted inside the change whose subject
  is drift.** The proposal states a test — *a finding whose governing rule already existed elsewhere when
  the defect was written* — and derives the set from the round commits so a later reader can re-derive it.
- **`existsSync` is 17 live calls, not 27** (18 until `main` moved). The first figure counted the ten comment lines *warning
  against* it as violations — the same defect one layer up, corrected in the open.
- **The rail lands GREEN, and the session-open checkpoint predicted otherwise.** It reasoned from the
  source that a `continue`/`break` divergence in `new.mjs`'s ENOENT branch would red the contract. Probed
  against a real filesystem across seven states, **all three `collisions()` return the same answer to
  every one** — the divergences are in their sentences and internal shape, not in the observable answer.
  The checkpoint read the code; the contract is the behaviour, which is this repository's own hierarchy
  applied to its supervisor. **That makes the rail's claim sharper rather than weaker:** it establishes
  nothing new about the tree, and converts an agreement held by three independent accidents into one that
  reds when it stops being held.
- **The instance this was drafted against was closed while it was being written.** Until
  2026-08-07T15:07Z, `cli/index.mjs:256` stated the rule — *"Present and unreadable is not 'absent'"* —
  and `cli/index.mjs:781`, **525 lines below in the same file**, was `} catch { /* absent */ }`. That was
  #91, live **nine days** in the file that argues against it. #166 closed it mid-session; what replaced
  it as evidence is stronger, and is in the proposal.

## Found and deliberately not fixed

- **#164's merged pull-request body still reads `Suite 907 → 966`** where the merged figure is **983** —
  a record written mid-loop and never caught up, which is the exact shape rule 2 of the review-loop bound
  exists to prevent and which that file already documents costing three disagreeing carriers on #105.
  Editing a merged pull-request body is an outward action and it is not this change's, so it is **routed
  to the maintainer** rather than repaired quietly.
- **The superlative has drifted.** *"The defect this repository names most often"* appears **at least 37
  times across 31 files** and attaches to **at least three different defects**. Named in `0020`'s limits;
  repairing it is a 37-site prose sweep and belongs in its own change.
- ~~**`cli/index.mjs:781`** — #91's original defect, left live on purpose.~~ **Overtaken:** #166 fixed
  it mid-session, so there is nothing here to leave. The reasoning stands for the next case — fixing one
  instance inside the change that generalises its class would make the diff argue two things at once.

## Open questions

- **The rule itself, the reflexive `persona.md` edit, and the `collisions()` unification issue** — all
  three are the maintainer's, and all three were put to him. On 2026-08-07 he approved opening the pull
  request ([#168](https://github.com/sleepy-panda-works/portulan/pull/168)), keeping the `persona.md`
  edit, and filing the issue (now [#169](https://github.com/sleepy-panda-works/portulan/issues/169)).
  **What remains open for him is the rule itself**, plus the four things listed under *Found and
  deliberately not fixed*.
- **Whether the *use*-versus-*carrier* distinction survives review.** Named above as the first thing to
  attack.
- ~~**`0.2.0` or `0.1.1` for the checkpoints pack.**~~ **Settled 2026-08-07: `0.2.0`.** Put to the
  maintainer, who ruled PATCH and then returned it on the argument. The argument is that the precedent
  does not govern — it bumped PATCH for a *rail fix*, a bug, where this adds a step a consumer receives,
  which is a feature under SemVer. **Swept to `0.1.1` and back**, which cost almost nothing precisely
  because the carriers had been enumerated first: five carriers of that version claim moved together — and the enumeration is why the sweep was safe: **`0.2.0` is also the PRODUCT's release
  version**, in `.claude-plugin/marketplace.json`, `plugin.json`, `README.md`, `product.md` and the
  CHANGELOG's own `## 0.2.0` heading, on a different train entirely. A blind replace would have moved
  five carriers of an unrelated fact.

## Next action

Fold the pre-commit checkpoint's adjustments (in flight at the time of writing), push, open the pull
request labelled `doctrine` + `agent-driven` (`pr-labeled` is a required check), then write `0020` into
`.portulan/proposals/` with the live URL **together with** `evolution.md`'s provenance pointer and the
CHANGELOG entry — those three land in one commit because none of them can resolve before the pull request
exists. File the `collisions()` unification issue. Answer every Copilot round on **both** channels.
Records — the Session-log entry and this handoff's in-flight fields — in the final push.

## Fidelity

- **Session-open: APPROVE-WITH-ADJUSTMENTS (12, all folded).** It refuted the plan's headline count, its
  `existsSync` figure and its "never stated" framing, and it named the buildable rail the plan had
  hidden behind its own four-part framing. **One of its adjustments was refuted by measurement rather
  than folded:** it predicted the contract suite would land red on a `continue`/`break` divergence; the
  behaviour is identical across the seven probed states and the suite lands green. **And one of its
  "verified clean" items was wrong** — it cleared the pack version bump on the ground that the manifest
  had never bumped on a content edit, where that manifest has exactly one commit, so the absence of
  precedent was an absence of prior edits. The real precedent goes the other way and the bump is made.
- **Pre-commit: APPROVE-WITH-ADJUSTMENTS (11, all folded).** Two were defects in the shipped artifact and
  neither was reachable by reading: an **eighth filesystem state on which the three carriers genuinely
  disagree** (a symlinked destination root — `init` permits, `new` and `vendor` refuse), which falsified
  the suite header's unscoped claim that they agree; and **three spellings that got past the roster
  matcher** (`export const`, a bare declaration re-exported, and a module in a subdirectory), each
  measured against the check rather than imagined. It also caught step 4 restating `evolution.md`'s
  sentence without citing it — the change's own defect, at the one site the change created. **Both
  findings came from the step this change ships**, which is the only evidence in the record that the step
  catches anything, and it graded a pre-rebase tree, so its own #91 claim was stale by the time it
  landed and was not adopted.
- **Seam scan clean** on diff, message, branch and paths at every commit.

## The loop, and the grant that is not standing

**The maintainer granted the extension past rule 4's bound on 2026-08-07**, after round 2, in the same
form as #160, #163 and #164 — asked for and given, never assumed. Recorded because the rule this session
amends says the grant is his each time, and a session that took it silently would be the defect.

**Every round so far found a defect this pull request introduced, and every one was its own subject** —
a rule that already had a carrier in the tree, missing from the new site:

| Round | Finding, and where the rule already was |
|---|---|
| 1 | *never a call that resolves a link* — broken in the teardown of the suite that pins it, reaching **outside the tree** to chmod the system temp directory |
| 2 | *not `mkfifo`, it needs a shell-out* — ruled at `cli/vendor.test.mjs:393`, contradicted by the only shell-out in `cli/` |
| 3 | 15 bytes of socket-path headroom, and a run-on aside. Neither a defect in anything the change asserts |
| 4 | **Nothing — no inline comment, no suppressed note** |
| 5 | Five notes on the RECORDS push: three stale `#91` claims in this handoff, and two implied antecedents in the Session-log entry |

Plus two the pre-commit checkpoint found with the sibling-sweep step this change ships: an eighth
filesystem state where the carriers genuinely disagree, and three spellings past the roster matcher.
**Four instances of the class inside the change that generalises it**, each landing where the rule had a
carrier the session had already read. That is the argument, demonstrated on itself, and it is the reason
the proposal's answer is a reviewer plus a pin rather than a rule anybody is expected to remember.

**The taper is legible in that table for rounds 1–4** — outside-the-tree defect, then a contradicted
decision, then a line break, then silence — and then **round 5 broke it, which is the most useful thing
in this record.**

**Read what happened there, because it is rule 2's actual argument and this session walked into it.**
Round 4 was empty, so the records were written saying *the loop ended on the taper* — and that record
went out in a push, `review_on_push` spawned a round on it, and the round found **five notes, three of
them real**: this handoff still asserted #91 was live at `cli/index.mjs:781` in three places, having been
corrected in the proposal and the memory entry and **not here**. A fix that missed its siblings, in the
change about fixes that miss their siblings, inside the record claiming the loop was over.

Two lessons, both cheap to state and neither derivable from the diff:

- **A record that claims the loop is finished cannot ride the push that draws the next round.** Rule 2
  says records land in the final push; what this shows is that *"final"* is not knowable at the time,
  because the records push is itself input. The honest form is what the table above now does — state the
  rounds and their shape, and let the maintainer read the taper — never *"the loop ended"*.
- **The records were swept for #91 and the handoff was not**, because the sweep was done file by file
  from the proposal outward and this file was written last. The sibling set for a fact includes the
  record you are writing while you sweep.

**Rounds 3, 4 and 5 each gave the merge gate what it requires** — a Copilot submission on the head being
merged ([`a-review-is-awaited-not-just-resolved.md`](../memory/a-review-is-awaited-not-just-resolved.md)).

**One thing the exemption should not be credited with.** Under this change's own sibling exemption
neither round 1 nor round 2 would have spent the bound — but that is the amendment arguing for its own
author, so it was surfaced to the maintainer rather than applied, and the extension came from him.

## A workflow hazard this session hit three times, so the next one need not

**Holding the records back from a commit and *unstaging* them reds `docs`** — `links` resolves against
the git index, so the moment `docs/plan.md` and `handoffs-index.md` are staged while the handoff they
link to is not, two links stop resolving and the Stop-gate refuses. Rule 2 governs the **commit**, not
the index, so the records should stay **staged** throughout and be excluded from a commit by pathspec
(`git commit <paths…>` or `-o`) rather than by `git restore --staged`. Three refusals here were this and
nothing else, and each cost a full verify sweep to diagnose.

## Recoverability

Nothing is in a partial state. `0020` is committed and pushed;
[#168](https://github.com/sleepy-panda-works/portulan/pull/168) is open and labelled, and
[#169](https://github.com/sleepy-panda-works/portulan/issues/169) is filed. The records — this file, the
handoff index and the Session-log entry — are deliberately **uncommitted** until the loop settles, per
rule 2 of the file this change amends, so a lost session would need to re-write only them. **`main` moved
under this branch once mid-session** (three commits, two of them closing #91 and #92) and the branch was
rebased; if it moves again, rebase rather than merge and re-measure every figure that touches the issues,
because that is exactly what moved last time. Temporary worktrees used to measure the suite at `c00f242`
and at `origin/main` were removed and `git worktree list` was checked after.
