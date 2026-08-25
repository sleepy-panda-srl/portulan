# Handoff — every rail was forced red and fired, and the calendar that does it next week is unvouched

**Date:** 2026-08-25 · **M8 (Evals & telemetry), session 2** · Implementer: Opus 5.

## What landed

**Milestone 8 clause (d) — scheduled forced-red drills: every rail forced red on a calendar and
required to fire — end to end.** One clause of nine. Sessions 0 and 1 landed (a) and (b); **six
remain**, and the change says which in every carrier rather than in one.

- `cli/drills.mjs` + `.portulan/verify/drills.sh` — the drill harness, and the `drills` recipe, which
  runs the **correspondence** half rather than the sweep.
- `.github/workflows/drills.yml` — the calendar. Weekly, plus `workflow_dispatch`, plus pull requests
  that touch a rail or the harness.
- `cli/drills.test.mjs` — every refusal exercised positively, and the pair oracle asserted against a
  fake rail whose output the suite controls.
- `.portulan/verify/README.md`'s forced-red register **rewritten**: the hand-maintained
  seen-to-fire / not-yet table is deleted, because a register of which rails have been watched is
  exactly the growing subject a prose figure fails at silently.

**Every figure here is a dated measurement of one run, and the shipped totals are printed by
`node cli/drills.mjs --pack-root packs`, which is their one carrier.** That convention is session 1's
and it is not decoration: a count of rails written into prose is false the day a nineteenth recipe is
declared, and this milestone has now repaired that class at recipe counts, corpus sizes, operator
totals, workflow counts and the plan's own budget column.

## The result, as the runner printed it

**The transcript, not a summary of it.** Three carriers said *"that transcript is in this session's
handoff"* while this file carried the narrative and no per-rail lines and no sha — a claim broader than
the thing it described, found at the pre-commit checkpoint, in the change whose subject is that class.
The synthesized sha is here because this module's own doctrine is that a verdict about a commit which
does not name the commit is not auditable:

```
drills: forcing every rail red on 7926d94 — a commit synthesized from the working copy
drills: 21 of 21 drill(s), one throwaway git worktree each
  not drilled  the platform floor — branch protection, the required checks, `enforce_admins`
  not drilled  the `permissions` layer the compiler emits
  not drilled  the CI seam — a non-zero recipe becoming a failed check becoming `BLOCKED`
  not drilled  the pre-commit seam scan (`../.portulan/dod.md` condition 5)
  not drilled  `claude plugin validate --strict`
  not drilled  Dependabot, the `copilot auto-review` ruleset, and `pr-labels`
  not drilled  the librarian's scheduled pass
  fired  docs                         exit 1 · said "link(s) that do not resolve in the repository"
  fired  json                         exit 1 · said "Expected double-quoted property name"
  fired  doctor                       exit 1 · said "slots.identity points at"
  fired  tests                        exit 1 · said "forced-red drill: the tests recipe reports a failing assertion"
  fired  plugin                       exit 1 · said "plugin/skills-the-drill-moved"
  fired  compile                      exit 1 · said "has drifted from"
  fired  workflow-filters             exit 1 · said "fixture(s) failed"
  fired  index                        exit 1 · said "is out of date against the store"
  fired  control-chars                exit 1 · said "control character(s) — first at line"
  fired  rule-carriers                exit 1 · said "recipe the manifest declares"
  fired  pack-version                 exit 1 · said "without moving `portulan.version`"
  fired  pack-identity                exit 1 · said "the package would not install the tree's bytes"
  fired  eval-bundle                  exit 1 · said "drill-top-level-path"
  fired  goldens                      exit 1 · said "the-bare-spelling"
  fired  mutants                      exit 1 · said "is recorded SURVIVES and was KILLED"
  fired  fuzz-shell                   exit 1 · said "disagree with the recorded grammar"
  fired  version-carriers             exit 1 · said "but package.json declares"
  fired  tools/github:actions-pinned  exit 1 · said "is a tag or branch, not a commit"
  fired  drills                       exit 1 · said "a-rail-this-workspace-does-not-yield"
  fired  stop-gate                    exit 0 · said "PORTULAN STOP-GATE (recipe"
  fired  gate                         exit 0 · said "PORTULAN GATE `force-push-without-a-lease`"
GREEN — every drilled rail was forced red and fired, on 7926d94
drills: a rail fires here on ONE known-bad input. That it fires is not that it catches everything
```

**The sha above names the synthesized commit of the run that printed those lines, and it cannot name the
commit this handoff lands in** — pasting a transcript changes the tree, which changes the next
synthesized sha. That is the self-reference and not a discrepancy: the transcript is a dated measurement
of one run, exactly as this milestone's other first-run figures are. The sweep was re-run after every
checkpoint adjustment was folded and stayed **GREEN at 21 of 21**.

**Twenty-one rails were forced red on 2026-08-25 and every one fired**, with its recorded exit and a
substring of its own output required to appear. Eighteen are the recipes this workspace yields, the
nineteenth is the new coverage rail itself, and the last two are the **Stop-gate** and the
**PreToolUse gate runner** — the amendment's *"from watchers to every rail"*, which a suite over
recipes alone would have quietly narrowed. The sweep takes about a minute and a half.

**What "every rail" excludes is printed on every run, with the reason**, because a scope claim with no
carrier is what the deleted register was: the platform floor, the host's own permission layer, the CI
seam, the pre-commit seam scan, `claude plugin validate --strict`, the platform watchers, and the
librarian's pass. Two of those were added at the session-open checkpoint, which found the list short.

## The three guards, and why each exists

**A drill is a pair.** A control on a pristine tree, then the perturbation. Drill 1 of 2026-07-30
recorded the reason — *a rail that only ever reds proves nothing about its green* — and the control
earns a second keep: a rail red for a reason unrelated to the drill makes it **could-not-run** rather
than a fire it did not cause.

**A `tell` is mandatory.** A perturbation can red a rail for the wrong reason. So each drill names a
substring the rail's own output must carry when it fires and must **not** carry before — and four
drills failed that second half on the first full run, because a recipe's banner already named the file
the drill perturbs. Each was narrowed to a sentence only the finding says. Without the both-directions
test those four would have counted a banner as a fire.

**A perturbation may not no-op.** Anchored, exactly once, *and* hashed before and after. Both hand
sessions had a drill that did not fire — one substitution missed by four spaces of indentation, one
patch script's quoting broke — and both reported on nothing.

## What measurement refuted, and the refusals are the substance

**Three of my expectations were wrong and the harness told me so on its own first runs.**

1. **The census does not pin its operator ids.** I drilled `mutants` by renaming an operator, on the
   assumption that a lost operator must refuse. Measured: it stayed **GREEN**. What actually reds it is
   a recorded outcome that stops being true, so the drill flips a `killed` to `survives` and requires
   *"is recorded SURVIVES and was KILLED"* — the good-news direction, which is the one a reader is
   least likely to expect a rail to hold.
2. **`version-carriers` reads the INDEX, not the working tree.** An unstaged perturbation was invisible
   and the rail reported its ordinary green — which would have read exactly like a rail that had
   stopped firing. That drill stages. Its sibling `pack-identity` deliberately does **not**, because
   an unstaged edit is precisely the drift that rail owns.
3. **`workflow-filters` has two non-green arms and my first perturbation hit the wrong one.** Dropping
   a character from a jq program made the fixture's anchor match nothing, so the rail exited **2** — a
   legitimate refusal, not the red the drill claimed. Appending a suffix to the program's output keeps
   the anchor findable and makes the bytes diverge, which is the exit-1 arm. Measured both ways before
   the line was written.

**And a fourth refutation was structural: a drill that perturbs its own module meets two traps, and
the first draft met both.** Renaming an existing declaration in `cli/drills.mjs` destroys the anchor
some drill depends on — measured, the child `--check` then exited 2 saying the drill no longer places,
instead of 1 reporting the coverage hole it was meant to expose. And an anchor written as one literal
places **twice**, once at its target and once in the line that searches for it, so `--check` refuses
the whole roster as ambiguous. The perturbation is additive and its anchor is concatenated, both with
the reason beside them.

## Two defects the tool shipped and its own suite or sweep caught

- **A could-not-run in one drill aborted the whole sweep and discarded the findings already
  collected.** The first full run reported on one rail and said nothing about the twenty behind it.
  That is the argument `verify.yml` settles with `set +e` — *a red recipe does not abort the loop* —
  and a sweep whose subject is rails nobody has watched fire is the last place to stop looking at the
  first obstacle. Findings and could-not-runs are now collected separately, both printed, and a single
  could-not-run makes the run exit 2: a set that was not fully judged has not been judged.
- **A typo'd `--only` on a dirty tree reported the dirty tree.** The argument was validated after the
  tree was chosen, so the refusal named a cause it had not established and sent the reader to look at
  their working copy when what was wrong was what they typed. Caught by the suite, not by me.
- **The finding diagnostic printed the last twelve lines**, and this repository's recipes end with a
  long list of `ok` lines — so the one `FAIL` that explained everything scrolled off the top of the
  diagnostic written to explain it. Finding-shaped lines come first now.

## Which tree a sweep reports on, and why the recipe is not the sweep

A drill runs its rail in a throwaway `git worktree`, and **a worktree is a commit**. So the sweep
prints the sha it drilled on every run and **refuses a dirty tree**, with no override: reporting on
`HEAD` while a reader is looking at uncommitted work is the wrong-tree green the gate map already
records. `--working-copy` synthesizes a commit with `git stash create` and refuses while
untracked-and-unstaged files exist, naming them — `stash create` does not carry them, so a synthesized
tree would be missing the very file under review.

That is also why the declared `drills` recipe runs `--check` and not the sweep: `dod.md` condition 1
asks whether every recipe is green **in this working copy**, and a sweep-shaped recipe would answer
about a different tree. What `--check` owns is the half that drifts silently on any commit — a drill
whose anchor has moved — so the commit that moves an anchored line is the commit that learns it.

**The ordering conflict this created was the session-open checkpoint's second binding finding, and it
is real:** the sweep cannot run mid-session on uncommitted work, the pre-commit verdict is owed before
the commit, and committing first is the breach the last session recorded. `--working-copy` is how both
hold at once — the checkpoint can re-run the sweep on the exact state under review, and the printed
sha says which state that was.

## What is demonstrated, and what is unvouched

**The sweep is demonstrated.** Twenty-one rails, by hand, on a synthesized commit from this session's
own working copy, every one fired.

**The calendar is not, and the two must not be read as one.** `workflow_dispatch` is unavailable for a
workflow that exists only on a branch, so its first observation is a manual dispatch after merge —
the maintainer's, since it is his Actions tab — and the run id belongs in the register. The
**schedule** is answered by its first weekly run and by nothing earlier. Until then, in `0007`'s own
words, **its silence is not evidence**. Both halves are written down in the workflow, in the gate map's
watcher table and in `evals/README.md` before either answer exists, which is the only order in which
that is a procedure rather than a description of something that already happened.

**The cadence is the maintainer's.** Weekly, on a different day from the librarian's Monday, is the
value this shipped with — not a policy an implementer settled, and it says so where it sits.

## The gap I did not close, deliberately

**A *missing* scheduled run is still undetectable.** GitHub delays schedules under load and disables
them after 60 days of inactivity, so *no sweep* and *no failure* look identical — `0007`'s silence
problem one altitude up, in the change that is `0007` generalised. Closing it needs a second
mechanism: a committed dated register with a staleness rail over it, or a librarian threshold reading
one. That is a clause's worth of work inside a one-clause budget, so it is **filed with this session's
pull request rather than built**, and named in the artifact rather than left to be discovered.

_The first draft of all four carriers of that sentence said the gap **was** filed, while no such issue
existed — a capability claimed in the past tense inside the change whose subject is claims broader than
the thing they describe. The pre-commit checkpoint read the issue list and found nothing. Reworded to
what is true at the moment of writing, with the number added to this file once the issue exists._

## State

`main` @ `2054740`; branch `agent/m8-scheduled-forced-red-drills`. One recipe was added, so the
yielded set grew by one; **every recipe the manifest yields is green** in this working copy, and
`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs` is the carrier of what
that set is. Seam scan clean over **every path the diff touches**, generated files included, plus the
commit message and the branch name, with a planted-term control reddening.

**Meta-drills — the harness forced red four ways**, exit codes read directly rather than through a
pipe, because a drill harness that cannot be shown to fail is the false green this whole milestone is
about: an anchor that no longer places (2), a drill whose tell never appears (1), a control that is
already red (2), and a yielded rail with no drill at all (1 from `--check`). Each is a case in
`cli/drills.test.mjs` as well as a hand run.

_The third of those exited 2 on its first attempt **for the wrong reason**, and the honest record of it
is worth more than the drill. I reddened the control by breaking the same link the `docs` drill anchors
on — so the roster check fired first, saying the anchor no longer places, and I would have written down
a control-already-red demonstration that never ran. Redone against a different file, leaving every
anchor standing, it produced the sentence it was meant to. Same shape as the `workflow-filters` lesson
one section up: a rail with more than one non-green arm needs the drill to say which arm it forced, and
a matching exit code is not that._

## Checkpoints

**Session-open — Fable 5, fresh context, APPROVE-WITH-ADJUSTMENTS, seven adjustments, every one folded
including the two marked optional** (the maintainer's standing instruction of 2026-08-25, restated in
this session). Five were binding and three of them changed the design rather than the prose:

1. **The Stop-gate's control is date-dependent, and it measured that rather than arguing it.** In a
   worktree whose HEAD is not on a remote, the identical tree **allowed** on 2026-08-25 and **blocked**
   under `TZ=Pacific/Kiritimati` — the gate also refuses a session with no handoff dated that day. A
   drill demanding *no block at all* would have been green or red by the day of the week. The tell is
   scoped to the recipe reason, the control tolerates a handoff-reason block, and nothing asserts how
   many reasons there are. It also measured what I had not: **a block exits 0**, so that rail's exit
   codes are 0/0 and the tell does all the work.
2. **The ordering conflict above**, with `git stash create`'s treatment of untracked files measured on
   the machine rather than assumed — which is why that mode refuses instead of silently drilling a
   tree missing the file under review.
3. **The exclusion list was short by two** — the pre-commit seam scan, whose term list lives outside
   this repository by design, and `claude plugin validate --strict`, which `identity.md` records as
   deliberately outside the recipe line. Both are rails on no calendar, and the clause's whole subject
   is the honesty of *every*. The librarian's pass is named too, with the reason it is not a rail in
   this sense.
4. **A stale count in the gate map**: *"pinned in each of the four"* against five workflows, false
   since `publish-github-packages.yml` landed on 2026-08-20 and about to be false by two. Deleted
   rather than corrected a third time, with `actions-pinned` left as the one carrier.
5. **`0007`'s procedure stated in advance**, split into the dispatch half and the schedule half, so the
   deferred issue owns only the recurring silence.

Its two optionals were both real and both folded: the register rewrite must keep drill 1's #118
narrative — it is the only evidence the CI-seam exclusion leans on — and say where per-run results
live; and the host-shaped mechanics it had measured, including that `stop-gate` leaks git's own
diagnostics to stderr in a detached worktree, which is why the hook rails read their tell from
**stdout alone**.

**Pre-commit — Fable 5, fresh context, APPROVE-WITH-ADJUSTMENTS, seven adjustments, every one folded;
then a second pass over the fold, three more, all folded.** It ran before the commit, which is the
ordering the last session got wrong. It re-ran every recipe and the whole sweep itself rather than
reading my report of them, and proved the synthesized sha really carried the staged work by diffing it
against the working tree.

**Its first finding is the one that justifies the checkpoint on its own: the workflow's entire
diagnostic path was dead code on a red.** GitHub runs `shell: bash` as `bash --noprofile --norc -eo
pipefail`, and `set -uo pipefail` does **not** clear that `-e` — so a non-zero sweep aborted the step
at the `node` call: no transcript, no job summary, no 1-versus-2 translation. The job would still have
failed, so the rail fires; what was lost is the whole diagnostic, exactly when it is needed.
`verify.yml` carries `set +e` with a comment naming this precise trap, and I copied that file's
capture-then-print shape without the line that makes it work. Reproduced independently under the same
invocation before it was fixed, for rc 0, 1, 2 and an undocumented code.

Its other six: four carriers claimed the staleness gap **was filed** when no such issue existed; three
claimed a transcript this handoff did not carry; the State line named a branch that did not exist (the
branch is renamed, not the record); `verify/README.md` still said *"like the thirty-four beside it"*
against a store of 134; and the stop-gate drill's `session_id` was a constant, whose counter file each
sweep left behind in the OS temp directory — the leak #340 names in a sibling module, caught here
before it could become the same issue.

**The second pass found two more record defects and one latent trap, and the first of the three is the
sharper lesson.** A **fifth** carrier of the *"filed"* claim sat in `evals/README.md` — the checkpoint's
own first-pass enumeration had listed four, my repair fixed those four, and the sweep stopped at the
sites that had been quoted. `0020` again, in the fix for `0020`, with the checkpoint re-deriving the
carrier set rather than reading the list it had been handed. Second: this Checkpoints section recorded
session-open and not pre-commit, and the plan entry said *"all seven folded"* while both checkpoints had
returned seven — the paragraph you are reading is that repair. Third: the counter cleanup keyed on a
prefix constant and **nothing refused a hook drill that declared its own id**, which would have got
neither the per-run completion nor the retirement. `check` refuses it now, and the guard is exercised
positively — with `check` taking the table through a seam so a tampered drill can be passed to it,
because a guard nothing can exercise is a guard nobody has seen work.

**What no fresh context graded, said rather than left to be noticed.** The second pass's three
adjustments were folded after its verdict, and one of them is a **mechanism** change — the `check` guard
refusing a hook drill with its own id, plus the `drills` seam that makes it testable. Two checkpoints
graded this diff and neither graded that guard; what stands behind it is its own positively-exercised
case in `cli/drills.test.mjs`, the full recipe set, and the sweep, all green after it. A third pass was
not dispatched because the gate map's table asks for the verdict before the commit and it has two, and
because a fold that only ever grades its own previous fold does not terminate — but the honest position
is that the pull-request review is this guard's first outside reader.

It also corrected a measurement of mine. I reported the temp-directory counter count as *1731 before a
sweep and 1731 after*; its own census went **1843 → 1871**. Both readings are right about different
sets: mine was the drill-prefixed subset, which is what the fix owns and which really is zero-growth,
and its +28 is `stop-gate.test.mjs`'s own fixture counters — 14 ids × the two suite runs a sweep
triggers — a pre-existing leak this change neither caused nor fixes. **The figure I gave was narrower
than the sentence I wrapped it in**, which is this repository's signature defect arriving in my own
report of a fix for a leak. It reached no tracked file; it is recorded here because the near-miss is
the interesting half.
