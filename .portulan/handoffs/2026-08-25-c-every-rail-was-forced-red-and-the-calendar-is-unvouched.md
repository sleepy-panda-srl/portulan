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

## CI found what the local sweep could not, on the first run

**The `pull_request` trigger earned its place immediately: 20 of 21 rails fired on `ubuntu-latest` and
`tests` came back UNJUDGED, because its CONTROL was red there.** Two cases in `cli/compile.test.mjs`
failed inside a drill worktree and pass in an ordinary checkout —

```
not ok 2 - a runner OUTSIDE the project falls back to absolute AND says so
```

— and the control refused to report a fire it could not attribute, which is the guard doing exactly its
job on the first occasion it mattered.

**The cause is a premise, not a flake.** That case compiled with `root: os.tmpdir()` as a stand-in for
*a root the runner is not under*. A drill worktree lives under `os.tmpdir()`, so for that caller the
runner **is** under the root and the emission is project-relative — the assertion's opposite.

**And it failed in CI while passing locally, which is the sharper half.** On macOS `/var` is a symlink to
`/private/var`, so the containment test misses and the case passes **by accident of the platform's
layout**; on `ubuntu-latest` the paths agree and it fails. A test whose verdict turns on a symlink is
testing the host. So the local sweep could not have found this, and the run that did is the one the
`pull_request` trigger exists for.

**Repaired at the intent rather than routed around.** Moving the drill worktree out of the temp directory
would have hidden it; naming the root directly — a subdirectory of the temp directory, which cannot
contain a sibling of itself — makes the case hold wherever the checkout sits. Both sites in that describe
block are swept, not the one that failed. Verified by running that suite inside a drill-shaped worktree
under `os.tmpdir()`, where it now passes.

**And the repaired sweep then ran green on `ubuntu-latest`.** Three runs, and the two that failed are the
more useful entries:

| Run | Head | Result |
|---|---|---|
| [`32868326592`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32868326592) | `a444025` | failure — 20 of 21 fired, `tests` UNJUDGED, its control red on the runner |
| [`32868624501`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32868624501) | `82c2f28` | failure — the same cause, one commit later, before the repair landed |
| [`32869280031`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32869280031) | `967e056` | success — 21 of 21 |

_The second row was missing from the first draft of this paragraph and from the register: I named the
first failing run and the success and skipped the failure between them, which reads as though one run
found it and the next fixed it. Two runs failed for that cause. Added at the final checkpoint's
prompting, which caught the omission while re-deriving the table against `gh`._

So the sweep is demonstrated on a runner as well as at a desk. The **schedule** is still answered by
nothing: a pull-request run says the sweep works on `ubuntu-latest` and says nothing about Thursdays.

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
one. That is a clause's worth of work inside a one-clause budget, so it is **filed rather than built**:
[#344](https://github.com/sleepy-panda-srl/portulan/issues/344), on the board at *Next*, carrying the
three candidate repairs with the reason none is presumed — one of them changes what the calendar is
allowed to write, and one is a decision to live with the gap, so the choice is a policy question. It
also carries the leaked-temp-file siblings the pre-commit checkpoint found beside #340.

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
claimed a transcript this handoff did not carry; the State line named a branch that did not exist —
**repaired by renaming the branch to the name the record already carried, so the State line above is true
rather than corrected downwards**; `verify/README.md` still said *"like the thirty-four beside it"*
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

## Copilot round 1 — seven findings, six real, and the seventh was wrong about this tree

Two of the six are **fail-opens in the harness itself**, which is the round earning its keep:

1. **A drill's own `cwd` overrode the enforced one.** The payload was spread as
   `{ cwd: worktree, ...payload }`, and `stop-gate` resolves the session tree from that field — so drill
   data could have pointed a control or a fire at another repository while the transcript said the
   worktree. The enforced fields come last now: the harness owns the execution tree, never the
   declaration.
2. **A recipe named `gate` or `stop-gate` would be silently shadowed.** The sweep's lookup map spreads
   the hooks after the recipes and `check` counted the id as drilled, so the real yielded recipe would
   never run behind a green. Nothing in the schema reserves those slugs, so the collision is refused
   here.

Two are **paths that would not resolve where the sweep runs**, and one of them measured worse than
reported: with a pack root **outside** the repository, `recipe-set` relativises `${PACK_ROOT}` against
the repo root and produced `bash ../../../../../../../private/tmp/…/actions-pinned.sh` — a path with
`..` hops, executed from a throwaway worktree, landing somewhere nobody chose. Refused now, with
`--check` left permissive because it runs no rail. The sibling: `PORTULAN_WORKSPACE` was **inherited**
rather than set, so `--workspace` — or that variable merely sitting in the environment — enumerated one
workspace's recipes while the hooks read another workspace's policy.

One is a **reserved exit code admitted as a fire.** A drill could declare `exit: 2`, which is
could-not-run everywhere here, and the harness would have counted a rail that could not be judged as a
rail that fired. Restricted to 0 and 1 — and the `workflow-filters` drill was drafted with exactly that
mistake earlier in this session, which is why the refusal carries the argument rather than just the
check.

One is the **`pull_request` path filter, which was wrong rather than incomplete.** It named the harness
and the recipes and missed most of what the table actually perturbs — settings, labels, the plugin
manifest, `evals/`, two READMEs, the memory index, two workflows, and the three sibling runners.
**Replaced with a catch-all rather than completed**: the roster it would need is the perturbation set,
derivable from `cli/drills.mjs` and from nowhere a YAML `paths:` list can read, and a hand-maintained
roster whose subject grows is the carrier this milestone keeps deleting. The cost is about ninety
seconds per pull request, stated rather than hidden.

**And the seventh was wrong about this tree, which is worth recording as carefully as the six.** It
reported that `check.toString().includes("only")` was already true — the body's comments being part of
`toString()` — so the assertion was false and the suite failed. Measured: `includes("only")` is
**false**, and the suite was passing. But the finding underneath it holds: an assertion over source
*text* passes or fails on a comment somebody writes later, and it tests a spelling rather than a
behaviour. It is behavioural now, through the `drills` seam.

_A first rewrite of that case then invoked the real sweep and asserted its status — and failed, because
a working tree is dirty while a session is in progress. **A test whose verdict moves with whether
somebody has uncommitted work is testing the desk**, which is this module's own subject and the second
time in this change that a check inherited an assumption about where it was run._

### The suppressed channel carried five more, and it carried the sharper ones

Eight notes, two of them already fixed by the time the review arrived (the `#344` wording, at both its
carriers) and one a prose contradiction of mine — the State line naming a branch the checkpoint section
said did not exist. That one is repaired by **renaming the branch to the name the record already
carried**, so the State line is true rather than corrected downwards.

The other five are mechanism, and three are could-not-run inversions:

- **A rail exiting 2, or killed by a signal, was reported as *did not fire as recorded*.** `spawnSync`
  gives `status: null` for a signal-killed child and 2 is could-not-run everywhere here; both mean no
  verdict was formed. Session 1's round 3 found this exact shape in the guard added to prevent it, one
  module over. Both are could-not-run now, each with its own sentence.
- **A malformed roster became a could-not-run in sweep mode.** `check` had recorded the finding, and
  the loop then threw on the same condition — turning a documented exit-1 roster failure into an exit 2
  and abandoning the transcript. Roster findings are reported before any rail is drilled.
- **The recipe's preflight covered the runner and not its imports.** `drills.mjs` reaches `goldens.mjs`,
  `compile.mjs`, `discover.mjs` and `inside.mjs`; with any missing, node exits 1 and the passthrough
  called that a red about a roster nothing had read. **Repaired by loading the module rather than listing
  its dependencies** — a hand-written import roster is one more carrier that goes stale, and loading
  cannot be wrong about its own graph.

  _And the first cut of that check ran the whole sweep._ Passing the path as an argument set
  `process.argv[1]` to the module, so the entry guard fired, the sweep refused the dirty tree, and the
  preflight reported *could not be loaded*. The path arrives in the environment now, where `argv[1]` is
  unset and `isMain()` is false by construction. **A check written alongside a change inheriting that
  change's blind spot — inside the check added to stop a could-not-run reading as a red.** Drilled by
  hiding `cli/inside.mjs`: exit 2, naming the module.

- **`inputDiffers` was three kinds of weak.** It asked whether `stdinControl` was *present*, not whether
  it *differs*; `stdinControl: null` falls back to the fire's input through `??`; and a **recipe** rail is
  handed no stdin at all, so a recipe drill with no perturbation satisfied it and could never change a
  thing. Now: a perturbation, or — for a hook rail only — a control input that is structurally different.
  Three shapes asserted, two of which the old test admitted.
- **`cli/drills.mjs` was a new reader of the recipe set and was not on that set's reader roster.** The
  roster is pinned two ways and neither could see it: the exact assertion reads a constant, and the live
  sweep looks for an undeclared *enumeration* of `verify.recipes` — which this module does not do,
  because it calls `recipeSet()`. So the roster went stale in the one way the pair was arranged not to
  allow. Added, and the test's own name — *"the four readers this change re-pointed"* — lost its count in
  the same stroke, that being the same class one altitude up.

## Copilot round 2 — two findings, and the second is this repository's own rule turned on me

**The isolation guarantee was a promise, not a check.** `perturb` formed its target with `path.join`
and wrote it, so a `..` in a declaration — or a symlinked parent in the checkout — could have reached
outside the throwaway worktree and into the caller's own repository, which is the one tree this harness
promises never to touch. The whole argument for a drill being safe to run at all rests on that
containment and nothing asserted it. Refused now **before anything is written**, resolving the nearest
existing ancestor for a path that does not exist yet, since that is what a write actually follows. Both
shapes are asserted, and the case checks that no file appeared.

**And my containment predicate was a third copy of a rule this repository keeps in exactly one file.**
I wrote `!path.relative(a, b).startsWith("..")` with a `rel !== ""` guard — which is precisely the
spelling [`cli/inside.mjs`](../../cli/inside.mjs) exists to hold, whose docblock records that two copies
of it drifted into the identical defect before either shipped. Mine had **both** of its defects: a
directory legitimately named `..packs` reads as outside, and a root *equal* to the repository root was
rejected outright, so `--pack-root .` refused a tree that is trivially inside itself. `isInside` is
imported now, with `realpathSync` on both sides for the reason `compile.mjs` had to add it — and which
this session had already met once, in the `/var` symlink that made a test pass on macOS and fail on
Linux.

`0020` again: a rule with one carrier, and I wrote a second one, in the change whose own subject is
carriers that drift.

_The first cut of the containment check then threw a bare `ENOENT` when handed a worktree that does not
exist, and **its own new test caught it** — a raw throw arriving as *could not finish the sweep* with a
stack trace instead of a sentence. Guarded, with a case._

**Two fix-rounds spent. The bound is met**, and going past it is the maintainer's to grant rather than
mine to assume.

## Round 2's notes — nine re-promotions and two live items, both taken

Eleven notes across three review objects, and **nine were findings already fixed** at a head the review
had not read: the path filter, the workspace threading, the roster findings before the sweep, and the
`gate`/`stop-gate` collision. Two were live and both are correctness:

- **A count in a comment, in the file whose own subject is carriers that go stale.** My section header
  read *"the eighteen yielded recipes"* over a section that includes the composed pack's rail — so it was
  both a count in prose and wrong. Deleted rather than corrected: the number has one carrier and it is
  the runner. **Fifth instance of this class across the three sessions of this milestone**, and the first
  one I wrote inside the change that deletes four others.
- **An empty relative path is the repository root, and the hooks read it as absent.** `workspaceRel` was
  `path.relative(repoRoot, workspaceDir)`, which is `""` when the workspace *is* the root — and
  `PORTULAN_WORKSPACE=""` falls through `process.env.PORTULAN_WORKSPACE || ".portulan"` in both runners.
  So a workspace at the repository root would have silently drilled `.portulan` instead: a rail graded
  against a policy the run did not choose, which is the exact defect the threading was added to close,
  surviving in its own edge case. `.` is the spelling that says *here*.

**Both are past the two-round bound and both are flagged rather than assumed.** The first is rule 2 —
*records land last*, a false sentence in this change's own file. The second is a mechanism defect and the
unaddressed half of a finding I had answered, which is the ground session 0 took its rounds 3, 5 and 9
on: a sibling of a defect this change introduced. The maintainer can overrule either; what would have
been wrong is triaging a silent wrong-workspace drill out to an issue to protect a round count.

## The last checkpoint before the merge, and it found a live escape

**Fable 5, fresh context, APPROVE-WITH-ADJUSTMENTS — two adjustments, neither blocking, both folded.**
The maintainer granted one more review round and the merge; this pass exists because **four commits had
landed since the last checkpoint and no fresh context had graded any of them**, which this file recorded
as a gap rather than hiding it. It re-ran all nineteen recipes and the whole sweep itself, and it
confirmed the printed sha was the tree under review by diffing it against the working copy.

**Its first adjustment is a containment escape it produced rather than argued.** A `create` whose target
is a **dangling** symlink pointing outside the worktree passed both of my checks — the resolve loop skips
a broken leaf up to its parent, and `path.resolve` does not follow links — and `writeFileSync` then
followed it. It measured a file at `outside/ghost.txt` holding `PWNED`.

**The enumerated vectors were closed and this was not one of them.** My docblock named `..`, an absolute
path, and a symlinked *parent*, and the supervisor verified all three refuse. The one spelling it did not
name is the one that escaped — `0020` at its most literal, and the third time in this change that a fix
held exactly as wide as the list beside it. Refused now by `lstat` at the target, which catches a live
link and a dangling one with the same test, because the question is whether *this name* is a link rather
than what it points at. Both shapes are asserted, and the case checks that neither file outside the
worktree was created or modified.

**Its exposure was nil and that is not why it is fixed.** The harness only ever runs the author-controlled
`DRILLS` table against a `git worktree` of this repository, which commits no symlinks. It is fixed
because deferring a containment escape to an issue in order to protect a round count would be protecting
the count with the thing the count exists to buy.

**Its second adjustment was two malformed bold spans in this file** — `****And` and a dangling
`around.**`, produced when an earlier append split a bolded sentence in half. Repaired, and the file
swept: no `***` sequence anywhere and the `**` markers balance. It also caught an omission at two
carriers: the CI table named the first failing run and the success and skipped **the second failure**,
which reads as though one run found the defect and the next fixed it. Two runs failed for that cause, and
both tables now say so.
