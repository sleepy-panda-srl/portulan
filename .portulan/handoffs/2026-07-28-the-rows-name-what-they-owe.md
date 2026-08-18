# Handoff — the rows name what they owe

**Date:** 2026-07-28 · **Full lane, no milestone row moved in Status** · Branch
`the-rows-name-what-they-owe` · [#80](https://github.com/sleepy-panda-srl/portulan/pull/80)

The amendments half of the 2026-07-28 two-day review — R9, R4+R11, R10, R3. Scope was exactly those
four and exactly prose: five milestone-row criteria and three doctrine sentences. R1/R2/R7/R8 shipped
as [#73](https://github.com/sleepy-panda-srl/portulan/pull/73) and are untouched here.

## State

Amendments committed and pushed; #80 open, carrying every amendment verbatim in its body so the
maintainer's merge ratifies the exact text he read. Records land in the follow-up push. Eight recipes
green, suite **499** measured and unchanged — which is the right result for a change that adds no code.
Seam scan clean across files, commit message, and branch name. **Merge is the maintainer's.**

## The finding worth carrying: a residual is re-derived against the tree, never inherited from the brief

The review's R9 asked for three things. Two had already shipped between the review and this session:
#72 built the store's generated index and its budgets, #73 built the log-entry budget. Had the amendment
been written from the review's text, it would have named two delivered things as future deliverables —
the stale-carrier defect this repository mints rules about, minted **into the file that grades every
other change**. The residual was re-derived by reading `cli/index.mjs` (it walks `slots.memory` and
nothing else), `doctor` (type-checks `handoffs` as a bare directory), and `docs.sh` (counts dates,
audits strays) — leaving exactly one gap, the handoff series, which is what the row now names.

The measurement was re-run for the same reason. The review's 674 KB / 60 KB / 13% were true at its
snapshot and stale by two merges at this one. Both sets are in the row, **each pinned to the snapshot it
was taken at**, because a single unpinned number is precisely how a fact becomes a stale carrier.

## Decisions + why

- **A handoff *index* is named; a handoff *budget* is refused, in the row, out loud** — because every
  remedy such a budget could have is barred. Consolidation (merge, compress, retire) would either red
  `docs.sh`'s count-based correspondence check or destroy the record that check exists to keep, and
  raising the budget in the change that breached it is the one repair the M5 row rules out. A budget
  whose every remedy is forbidden is a rail designed to be broken. The refusal is written **inside** the
  amendment rather than left as a silent omission, because one review later a silent omission reads as
  an oversight to "fix" by extending the rail. Precedent: the M4 amendment held this same line for the
  session-end gate — it checks that a dated handoff exists and *"nothing about its length, shape or
  contents"*. The budget question went to Marius instead.
- **R9's stronger ground is doctrine, not the review.** `core/operating/loop.md` has said since the
  cadence rule that *"the librarian that mines the series is milestone 5"* — a doctrine promise naming
  this row and pointing at a layer the row never named. That makes this the reconciliation
  `a-doctrine-promise-belongs-in-the-row-it-names` mandates, in the direction it permits, with the M4
  amendment as its type specimen. Found by the session-open supervisor; the draft had cited
  `memory.md`, which never mentions handoffs at all.
- **M6's amendment was argued rather than asserted**, because it is the only one where the direction is
  not obvious: a row requiring *a* resolving pack now requires a **specific** one. As sets of
  obligations, every tree satisfying the amended row satisfies the original and the converse fails — a
  stub pack no longer closes the milestone. Strictly stronger. If fixing a deliverable's subject counted
  as narrowing, R10 would be void entirely and take M7 and M10 with it.
- **All three R3 sentences landed in the gate map, on the supervisor's altitude ruling**, with `dod.md`
  condition 7 amended to **cite** the trigger. The DoD grades a finished change, so it structurally
  cannot reach the sentence about how an idea *enters* work or the one about session-open. And (a)'s
  whole vocabulary is defined in the gate map, so writing the trigger into the DoD would mint a second
  carrier in the act of writing it — the shape condition 6 was repaired out of one change earlier.
- **The review's §IX move (2) — amendments as one-line pointers — was not taken.** It changes the
  amendment form in the change that writes five amendments, it is record compression rather than a
  memory-lifecycle deliverable, and unlike everything else here it is not plainly an expansion.

## What the session-open checkpoint cost, and what it bought

**APPROVE-WITH-ADJUSTMENTS (9)**, taken before any file was written — the brief required waiting for the
verdict, and #73's handoff records what running ahead of it cost. Four of the nine were drafted
sentences that **contradicted the record they cited**, and the pattern is the one to carry: *every error
leaned in the direction that flattered the argument.* "#60's write-gate shipped done" (all eight holes
closed before merge — "was called done"); an inverted hole-list attribution; "all of them grammar edge
cases" when seven of eight are; and the #53 ruling **misquoted inside quotation marks** — the recorded
words are *"the single posture `main` already runs is sufficient."* A doctrine sentence does not
misquote the maintainer, and the misquote had been carried in this build's own session memory as if it
were the ruling. Every correction was verified at source before folding — including fetching #53's
closure comment from GitHub — rather than taken on the supervisor's word.

## What the pre-commit checkpoint found

**APPROVE-WITH-ADJUSTMENTS (2)**, a second fresh Fable 5 context that fetched `origin/main` itself, ran
all eight recipes itself, and re-derived every number from `git ls-tree` rather than replaying the
implementer's. Both adjustments were on **these records** — the Session log entry still carried a
`PENDING-VERDICT` placeholder, and this handoff recorded session-open fidelity only. Neither touched an
amendment. What it independently confirmed is worth more than the two fixes: the five row edits are
**mechanically pure appends** — pre-existing criterion text surviving character-for-character, Status
cells byte-identical, untouched rows untouched — and the PR body's quoted amendments **byte-match** the
file, so the merge ratifies exactly what was read. It also re-checked all six quotations at source,
including fetching #53's closure comment from GitHub, and re-ran the expansion check on all six items
from scratch. Suite **499**, measured; eight recipes, each exit code read.

One thing it noticed in passing, worth carrying out of this repository: the #53 ruling as recorded in
**this build's own session memory** is a paraphrase, not the words. The shipped sentence matches GitHub.

## Open questions — all three the maintainer's

1. **Does the handoff series get a size budget, and what would its remedy be?** If yes, the honest
   remedy space is an archive-or-rollup mechanism the `record` check understands. Design work for a
   ruling, not for an amendment.
2. **Should milestone-row amendments become dated one-line pointers?** (Review §IX move 2.) Wants its
   own change and probably its own ruling.
3. **Per-agent memory** — first instance at M5, or an explicit deferral in `core/operating/memory.md`.
   Core doctrine promises it; nothing anywhere implements it.

Also his: R5 (close #65, schedule #66/#68/#70/#71, #67 stays pre-M9), and #78, which is fixed on `main`
and can be closed — commenting on an issue needs `issues: write`, which the App does not hold.

## Next action

Await the Copilot round on #80's head, answer every comment including the collapsed low-confidence
block, and hand the merge to Marius. **M5 session 1 should start from the amended M5 row** — the
librarian is built to it rather than retrofitted, which is why this landed first.

## Recoverability

Nothing partial. The amendments are one commit; the records are the second. No outward action was taken
beyond the branch push and opening #80, both of which are the declared tiers for them. `docs/vision.md`
untouched, and no Status column moved.
