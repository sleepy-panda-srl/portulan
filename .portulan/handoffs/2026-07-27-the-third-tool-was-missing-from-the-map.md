# Handoff — the third tool was missing from the map

**State.** Doc-only, **five files**. Three carry the fix — [`../../cli/README.md`](../../cli/README.md),
[`../repos/portulan.md`](../repos/portulan.md) and
[`../tasks/0004-a-harness-for-the-verify-recipes.md`](../tasks/0004-a-harness-for-the-verify-recipes.md)
— and two are the record this file is half of: itself, and the `docs/plan.md` Session log entry.
_(Counted this way after a reviewer pointed out that "three files" understated the change, in the
handoff of a pull request about understatement. The record is part of the diff, not commentary beside
it.)_ All six verify recipes green in this working copy, each read for its **exit code** rather than its
banner. Branch synced onto `9e449ad` and merged on the maintainer's explicit instruction.

**What this session was asked to do, and why almost none of it shipped.** The brief was the `tests`
recipe's understatement — the row in `../verify/README.md` and the header of `../verify/tests.sh` naming
two suites where the glob runs four. Two parallel sessions were fixing the same drift at the same time.
[#42](https://github.com/sleepy-panda-srl/portulan/pull/42) had already done the brief and merged
mid-session; [#43](https://github.com/sleepy-panda-srl/portulan/pull/43) then did the `identity.md` and
`affordances.md` siblings — work this session had also written and had reviewed — and merged too. That
work was discarded rather than rebased into a competing pull request: it was superseded, and #43's
version is the better text on the affordances bullet, which states the recipes gap at six without the
overstatement this session's draft had introduced.

What survived the collision is the part neither pull request touched, and it is a different sentence:
not *how many suites are there* but **`compile` is missing from the map altogether**.

**Decisions + why.**

- **`cli/README.md` was the real find.** Its *What is here today* table listed `doctor`, `plugin-lint`
  and their suites and stopped — while the prose forty lines below already discussed `compile` twice,
  under *What it does not do*. The file described a tool it did not list, so an agent asking "is there a
  compiler, and is it tested" got *no such tool* from the inventory and a caveat about its limits later.
  Three rows were missing: `compile.mjs`, `compile.test.mjs`, `stop-gate.test.mjs`.
- **The exit-code sentence was tightened because it was being touched anyway.** It read "Exit `0` every
  workspace validates" above a block containing `plugin-lint`, which validates plugin roots, not
  workspaces. Adding `compile` — whose codes mean *wrote / drifted / could not run* — would have widened
  an already-loose sentence, so the two verdict vocabularies are now stated separately.
- **`repos/portulan.md`'s layout line said `doctor`, `plugin-lint` and their tests.** The card's
  build/test/run block, ten lines above, already names all six recipes — so the omission was local to
  that one line rather than a stale card. This is the card `doctor`'s claims lint reads, which makes an
  incomplete layout line the more expensive kind.
- **Task `0004` was corrected, not rescoped.** It opened on "the five verify recipes" and "`doctor` and
  `plugin-lint` each have a suite", and its known-difficulty paragraph proposed "a sixth recipe that runs
  the other five" — a design note that silently shrinks as the tree grows. Counts corrected to six and
  seven, and the goal now states the direction of travel: a sixth recipe and two more suites added since
  it was written, and the number testing a recipe is still zero. The five it was born with was **right at
  the time** — checked against `workspace.json` as of the task's own commit rather than assumed stale,
  which is how the first draft of this sentence came to say "two recipes" and had to be corrected. Its
  acceptance criteria are untouched: already written against `workspace.json` rather than against a
  count, which is exactly why they did not rot when the counts around them did.
- **The rule behind all three** is [`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md):
  understating a checker is the same defect as overstating it, and it is the harder one to notice because
  it reads as modesty rather than as a claim.

**Open questions.** None left. Merge order resolved itself by attrition: #44, #45, #46 and finally #47
all merged while this branch waited, and #46 is the pull request that made `main` refuse a merge from
behind it — so this branch became an early subject of that rule rather than an exception to it, twelve
commits behind at the first sync and two more by the second. **Rebased twice, onto `8dcfa22` and then
`9e449ad`**, each time hitting exactly the conflict the rule predicts — two sessions appending the
Session log — and each time resolved by keeping both entries with this one last, so the `record` check
still reads a newest entry that attests the seam. #47's overlap on
[`../repos/portulan.md`](../repos/portulan.md) turned out shallower than it looked: it rewrote the
public-flip sentences at the top and bottom of that card and never touched the layout line this one
edits, so the second rebase conflicted only in the log.

**Next action.** None for this branch — merged and deleted. Nothing here blocked milestone 4, and
nothing here starts it.

**Recoverability.** Nothing partial. No code path, no gate and no manifest changed — `gates.json` and the
compiled artifact are untouched, confirmed by running `compile.sh` rather than by reading the diff.

**Worth carrying forward.** `main` moved under this branch **three times** in one session: #42 and #43
took the commissioned work, #45 landed, and the repository went public — and each time the records
written minutes earlier became false in a way no verify recipe checks, because none of them reads
GitHub. The duplicated work was caught only by re-reading `origin/main` before pushing, and the stale
merge-order paragraph only by a supervisor who did the same. The cheap habit both times: `gh pr list`
plus a fresh fetch *before* writing the record, not just before pushing it. This repository already
knows proposal numbers collide when sessions run parallel; prose fixes collide the same way, with no
filename to warn anyone. The mechanical version of this lesson landed the same evening as
[`0011-no-merge-from-behind-main.md`](../proposals/0011-no-merge-from-behind-main.md) — in flight while
this handoff was first drafted, merged before it was committed, and applied to this very branch.
