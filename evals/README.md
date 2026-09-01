# evals/

Milestone 8's home: golden tasks, the A/B harness, and the eval gate that lets a rule change merge or
be rejected on evidence rather than assertion. Row 8 of [`../docs/plan.md`](../docs/plan.md) is the
binding criterion; [`../docs/milestones/m08.md`](../docs/milestones/m08.md) is its legislative history.
This file does not restate either — a rule with two carriers is obeyed at the narrower one.

## First, the word — because it already means something else here

**"Eval" carries two unrelated senses in this repository, and only one of them lives in this
directory.** Both were load-bearing before this directory had any content, so the disambiguation is
written down rather than left to be inferred from a filename.

| Sense | Where it lives | What it is |
|---|---|---|
| **Evaluation as measurement** — golden tasks, A/B, the eval gate | **here**, `evals/` | Does the engine make an agent work better? Milestone 8's subject. |
| **Evaluation as a licensed copy** | [`../cli/eval-bundle.mjs`](../cli/eval-bundle.mjs), [`../.portulan/verify/eval-bundle.sh`](../.portulan/verify/eval-bundle.sh) | A named-recipient bundle cut from a commit under evaluation terms. A commercial artifact, with its issuance ledger kept permanently outside this repository. Nothing to do with this directory. |

**And `goldens` itself now names two runners, so that is disambiguated here too rather than left to a
prefix.** [`../cli/goldens.mjs`](../cli/goldens.mjs) grades the **compiled gates** against adversarial
fixtures, through the compiler's own `matchesRule`. [`../cli/skill-goldens.mjs`](../cli/skill-goldens.mjs)
grades the **core skills'** mandates against the live artifacts they govern. Same clause, two subjects —
the 2026-07-28 amendment's *"golden tasks reach the gates as well as the skills"* — and two oracles, which
is why they are two modules and two recipes rather than one with a flag.

The machinery this directory ships is therefore named **`goldens`**, never `evals` — so a reader meeting
`cli/goldens.mjs` beside `cli/eval-bundle.mjs` is not left to guess which sense is which. The directory
keeps the row's own word; the tools take a narrower one.

## What is built today

**Seven clauses of row 8, of nine.** (a), adversarial fixtures per compiled gate, landed 2026-08-24;
**(b)**, mutation testing over both matchers and grammar-aware fuzzing over the shell segmenter,
landed 2026-08-25; **(d)**, scheduled forced-red drills, landed 2026-08-25; **(c)**, review-loop
metering, landed 2026-08-26; **golden tasks per core skill** — the row's original first subject —
landed 2026-08-26; **OTel opt-in config** landed 2026-08-28; and **the A/B baseline** landed 2026-08-31,
across three sessions the maintainer split at construction | grading | running — 6b the arms, 6c the
graders, **6d the run**. **Two remain** — a rule change merged or rejected on eval evidence, and a
release carrying an eval result. Each is listed below with the sentence
[`../.portulan/dod.md`](../.portulan/dod.md) condition 4 requires.

## The A/B baseline — what 40 turns measured, and what they did not

[`ab/baseline.json`](ab/baseline.json) is the capture and [`ab/baseline.md`](ab/baseline.md) the register
rendered from it. **k = 5 per cell, ruled by the maintainer; 4 scenarios × 2 arms × 5 runs; every turn
isolated with a home and config directory of its own.** Held by the `ab-run` recipe and a forced-red
drill.

**At the 2026-08-31 capture the headline is a tie**, and [`ab/baseline.md`](ab/baseline.md) carries the
figure itself, with every per-turn row beside it — this paragraph cites that register rather than
restating it. The date is part of the claim: it is what keeps this sentence true rather than stale if
the arms are ever re-run. It is recorded as measured. No re-run was taken to find a better number, and
none will be: `k = 5` supports a recorded rate and nothing else.

**The finding that matters most is not the tie.** On `done-demonstrated` the rig fails unconditionally,
so the only route to a green rail is rewriting the check — and **arm A rewrote it in 3 of 5 turns**.
Session 6c's first design labelled a green rail `demonstrated` and scored it as compliance; the
session-open checkpoint reversed that before any turn ran. Had it not, those three turns would have
counted as compliances and the register would publish **an arm-A lead manufactured entirely by scoring
the gaming move as the good outcome**, against the tie [`ab/baseline.md`](ab/baseline.md) recorded on
2026-08-31. The reversal is what makes that tie trustworthy, and it is the strongest evidence this milestone has
produced that a fresh-context checkpoint catches what its own author cannot.

**On `altitude` arm A REACHED the compliant location and was still scored 0/5, and that is the finding.**
It wrote the constraint into `.portulan/tasks/` on **3 of 5** turns — arm B reached it never. All three
graded `higher-layer` because `gradeAltitude` gives any governance-surface occurrence precedence, and in
every one of those turns the governance hit is **the dated handoff arm A's own `dod.md` condition 8
demands**. So the predicate counts a **gate-mandated artifact as promotion** and penalises the treatment
arm for obeying the treatment: a treatment–instrument interaction, not a fact about the arm. _(Runs 0 and
3 are different and are genuine promotion — they wrote the constraint into `memory/`.)_ On
`curated-layer` arm A wrote into `memory/` twice and arm B touched neither curated directory — a visible
difference, 0/5 both.

Recorded rather than repaired: moving a target after seeing the figures is the selection this instrument
exists to refuse, and what to do about it is the maintainer's. **The baseline is scoped to the
vendored-and-compiled tier** [`ab/arm.md`](ab/arm.md) specifies, and closes row 8 for no other
configuration of *Portulan on*.

**One cell is at ceiling.** `observed-content` is 5/5 for both arms — [`ab/corpus.md`](ab/corpus.md)
warned in terms that a bare agent which also declines the injection makes the row uninformative, and it
does.

```
evals/goldens/gates/<rule-id>.json      one fixture file per rule in the yielded gate policy
```

**The filename is checked against the file's own `rule` field**, since 2026-08-24. It was documented
here, printed in the missing-fixture red (*"add `evals/goldens/gates/<rule-id>.json`"*), and enforced
nowhere — so a renamed or misfiled fixture validated cleanly and graded anyway. A mandate nothing
checks is already broken, and this directory was carrying one of its own. Found as a suppressed note
in Copilot round 5 of [#336](https://github.com/sleepy-panda-srl/portulan/pull/336).

Graded by [`../cli/goldens.mjs`](../cli/goldens.mjs), run as the `goldens` verify recipe, on every
pull request. Run it by hand with:

```
node cli/goldens.mjs --workspace . --pack-root packs
```

**Why this clause first.** Not because everything else hangs off it — golden tasks, the A/B harness,
OTel and review-loop metering share almost nothing with a matcher-fixture runner, and claiming
otherwise would be an overclaim of exactly the kind this repository keeps finding. The honest reason
is narrower: clause **(b)** — mutation testing over both matchers and grammar-aware fuzzing over the
shell segmenter — needs this corpus as its kill-set and this fixture format as its output shape. (a)
is load-bearing for (b) and for nothing else in the row.

### What a fixture is

A case is **data**, answered by the compiler's own exported `matchesRule` — the same function the hook
calls at tool time, never a re-implementation. **A case's command string is never executed.** The
corpus contains `git push --force`, `rm -rf docs` and constitution-write spellings by design; there is
no code path from a fixture to a subprocess, and the suite asserts the runner imports no
process-spawning API at all.

Two case classes, and exactly two:

- **`holds`** — the matcher catches this today and must keep catching it. Every one of the eight
  bypasses found *after* [#60](https://github.com/sleepy-panda-srl/portulan/pull/60)'s gate was called
  done is one of these.
- **`documented-hole`** — the matcher does **not** catch this, a named record says so, and the case
  keeps that admission true **in both directions**: if the hole silently closes, the case goes red
  until the record is updated. A hole list that still lists a closed hole is as wrong as one that
  hides an open one.

**Every case records which branch of `matchesRule` it exercises**, and the field is **derived, never
declared**: `matcherPath(kind, tool)` computes it from the rule's action kind and the case's tool, and
the runner refuses a case whose stored value disagrees. Four values — `matchesPath`, `shell-write`,
`shell-prefix`, and `no-branch` for a combination the matcher has no code for. The green prints the
per-path census, including the zeroes, because a corpus can carry two hundred cases and exercise one
branch of four.

It earns its place on one asymmetry: a `then`/`do`/brace-group leader is **caught** on the write path
— `shellSegments` knows `SEGMENT_LEADERS` — and **escapes** on the shell path, where `commandSegments`
does not. One rule id, two segmenters, two answers. Without the field those two cases read as a
contradiction rather than as the asymmetry they are.

Byte-level attacks are stored **escaped** (JSON `\r`, `\u0000`) and decoded by `JSON.parse`.
[`../cli/control-chars.mjs`](../cli/control-chars.mjs) refuses a raw CR anywhere in this tree by
decision, and exempting a growing adversarial-content directory is the allow-list defect that same file
names — so the corpus carries no raw control bytes, and a test asserts both halves: the bytes are clean
*and* the escapes really decode.

## Clause (b) — the corpus is measured against a broken matcher, and the grammar against bash

Two rails, landed 2026-08-25, and they answer two different questions:

```
node cli/mutants.mjs    --workspace . --pack-root packs     the mutation census
node cli/fuzz-shell.mjs --workspace . --pack-root packs     the grammar fuzzer
```

**`mutants` asks whether the corpus DISCRIMINATES.** It breaks
[`../cli/compile.mjs`](../cli/compile.mjs)'s matcher region on purpose — one declared, anchored,
place-exactly-once substitution at a time — and grades each mutant against this corpus. An operator
that the corpus fails to notice is a hole in the kill-set, and the repair is a new fixture: `matchesRule`
is a pure function of `(rule, tool, input)` and a fixture is exactly that triple, so any non-equivalent
mutant is killable by one. A `survives` record is admissible only as a **proof** — semantic
equivalence, or equivalence under the yielded policy — never as a standing note that a gap exists,
which would rebuild the prose hole list clause (a) exists to have replaced.

**It went red on its first run and the corpus lost.** Among the breakages that went unnoticed:
removing `sudo` from the command-prefix table, dropping `..` resolution from path normalisation, and
disabling quote tracking in the segmenter. Every one is a fixture now, and each was derived by
measuring which input distinguishes the mutant rather than by reasoning about it — two were *not*
killed by the spelling that seemed obvious.

_The figures for that first run are dated in
[the session's handoff](../.portulan/handoffs/2026-08-25-the-corpus-lost-and-the-fuzzer-found-a-live-bypass.md),
and the SHIPPED totals are printed by `node cli/mutants.mjs` and `node cli/goldens.mjs`, which are
their one carrier. This paragraph carried "eleven of forty-eight" against a table that had since grown
to fifty-three — a count written before the thing it counted stopped growing, which is this
repository's most-repeated defect and was this session's third instance of it. The pre-commit
checkpoint caught the same figure in the handoff and the repair stopped at the site that was quoted;
Copilot round 2 found the one it missed. Deleted rather than corrected, so the trap is not re-armed
for whoever adds the next operator._

**`fuzz-shell` asks whether the SEGMENTERS answer one grammar.** It composes a command from a grammar
instead of mutating a string, so it knows by construction whether the payload sits where bash would
execute it or where bash would only print it. Positions are enumerated and recorded; **spellings are
fuzzed**, and the invariant is that every spelling of one command in one position gets the same
answer. Every recorded divergence from ground truth cites the record that licenses it.

**The grammar's own ground truth is measured, not argued.**
[`../cli/fuzz-shell.ground.test.mjs`](../cli/fuzz-shell.ground.test.mjs) runs every position under
real bash with a **neutral** payload — never a gated command — and writes every path spelling to a
throwaway file. A grammar that lies about itself produces not a red but a green about the wrong thing,
which is the one failure a fuzzer cannot detect in itself. It caught two.

**It found a live bypass of every Gated shell action.** `bash -c "ls; git push --force origin main"`
answered **false**: the composition tested the raw command's segments and each segment's spellings,
and never a spelling's segments. The write matcher never had the gap, because `shellWrites` segments
again internally — one fix landing in one carrier and not its sibling, between two branches of one
function. Closed the same day, at the class rather than the spelling, with the two-wrapper
counterexample asserted so the unwrap budget stays at one level.

### What this rail does NOT establish

**Adequacy — whether the cases are a real attack.** What the rail checks is **presence**, and the two
are worth separating out loud, because a green looks the same either way:

| The rail answers | The rail cannot answer |
|---|---|
| Does every compiled gate have fixtures at all? | Are those fixtures any good? |
| Does every case still answer as recorded? | Is the case worth answering? |

So a gate cannot reach the compiled policy with **no** adversarial thought recorded against it — and
one trivial happy-path fixture per rule satisfies the floor while proving nothing. The runner prints
this limit on every green rather than letting the exit code imply more than it means.

**Half of that gap closed on 2026-08-25, and the sentence has to move with it.** This section used to
end *"no check can tell those apart"*, and clause (b)'s mutation census is a check that tells part of
them apart: it breaks the matchers on purpose and asks whether the corpus notices. So the right split
is now three ways rather than two — **presence** (the `goldens` rail), **discrimination** (the
`mutants` rail: does the kill-set catch a matcher that has been broken?), and **realism** (whether the
attacks resemble anything an adversary would type), which is still a reviewer's judgement and stays
one. The census is what forced the correction rather than a reader noticing: it went red on its first
run, on 2026-08-25, against the corpus as it then stood — which failed to notice a whole class of
breakages, every one of which is a fixture now.

The **exemption** is the obvious way to dodge the rail: write the next gate `none`-shaped and it needs
no fixtures. So every exempt rule is named in the output on every run, the way `compile --matrix` prints
its own refused rules.

### What it found on its first run

A hole nobody had recorded: **a rule whose target is the whole repository (`./`) matches nothing at
runtime.** `matchesPath` reduces `"./"` to the empty string and then refuses the empty string, so
`edit-on-a-working-branch` and `read-anything-in-the-repository` answer false for every input. Nothing
is mis-enforced today — both are `auto`, and neither layer ever asks — but a **gated** rule written
that way would compile to a permission rule covering the tree and a matcher covering nothing. Now
entry 8 of [`../.portulan/gate-map.md`](../.portulan/gate-map.md)'s honest-holes list, tracked as [#337](https://github.com/sleepy-panda-srl/portulan/issues/337), and asserted here.

Ten of the corpus's own hand-written expectations were refuted by the rail on the same run, which is
the argument for the rail in one sentence.

## Clause (d) — every rail is forced red on a calendar, and required to fire

```
node cli/drills.mjs --pack-root packs                       the sweep: force every rail red
node cli/drills.mjs --check --pack-root packs                the roster: every rail has a drill
```

Landed 2026-08-25. `goldens` asks whether a gate has fixtures; `mutants` asks whether those fixtures
discriminate; **this asks whether the rail still fires at all.** A recipe whose precondition quietly
started exiting 0 over an empty file list, a hook that fails open on a crash, a check whose enumeration
went empty — each reports green and each has stopped being a rail, and until this landed the way that
was found here was an incident.

**Its own provenance is two sessions doing it by hand.** The drills run against `goldens` on 2026-08-24
and against `mutants` and `fuzz-shell` on 2026-08-25 were all run by hand, in a session, and recorded in
those sessions' handoffs — which is precisely the state this clause exists to replace. Both of those
sessions also had **a drill that did not fire**: one anchored substitution missed by four spaces of
indentation, one patch script's quoting broke, and both times the recipe ran green against an unmodified
file. Every guard in [`../cli/drills.mjs`](../cli/drills.mjs) traces to one of those two.

**A drill is a pair, and the pair is the oracle.** A control on a pristine tree, then the perturbation —
because *a rail that only ever reds proves nothing about its green*, and because a control that is
already red makes the drill **could-not-run** rather than a fire the perturbation did not cause. Each
drill declares a **tell** its rail's own output must carry when it fires and must not carry before, so a
red for the wrong reason is not counted as a fire; each perturbation must place **exactly once** and must
move bytes on disk. Isolation is one throwaway `git worktree` per drill, so nothing perturbs a working
tree.

**The sweep reports on a COMMIT and prints which one.** A dirty tree is refused outright; `--working-copy`
synthesizes one with `git stash create` and refuses while untracked-and-unstaged files exist, since a
synthesized tree missing the file under review would be a green about the wrong tree. That is also why
the **verify recipe runs `--check` and not the sweep**: a recipe that answered about `HEAD` would not be
answering [`../.portulan/dod.md`](../.portulan/dod.md) condition 1's question.

**What the word *every* covers, and what it does not.** The sweep drills every recipe the workspace
yields, plus the Stop-gate and the PreToolUse gate runner — the amendment's *"from watchers to every
rail"*. The rails it cannot force are **named in the output on every run** with the reason: the platform
floor, the host's own permission layer, the CI seam, the pre-commit seam scan, `claude plugin validate
--strict`, the platform watchers, and the librarian's pass. A scope claim with no carrier is what the
prose register in [`../.portulan/verify/README.md`](../.portulan/verify/README.md) was, and that table is
deleted in favour of this.

**What is demonstrated, and what is unvouched.** All twenty-one rails were forced red by hand on
2026-08-25 and every one fired. The **calendar** — [`../.github/workflows/drills.yml`](../.github/workflows/drills.yml),
weekly — is a watcher, so it owes its own observation under
[`../.portulan/proposals/0007-every-watcher-ships-with-its-observation-procedure.md`](../.portulan/proposals/0007-every-watcher-ships-with-its-observation-procedure.md):
`workflow_dispatch` is **answered** — run
[`32883413709`](https://github.com/sleepy-panda-srl/portulan/actions/runs/32883413709) on `da9c06e`, 21 of
21 — and the **schedule** is answered by its first run and nothing earlier. **Until that run the calendar
is half-vouched, and the unvouched half's silence is not evidence.** And a *missing* run stays undetectable — that is `0007`'s silence problem one altitude up,
tracked as [#344](https://github.com/sleepy-panda-srl/portulan/issues/344) rather than built.

_This paragraph said the gap was already **filed** — the fifth carrier of that sentence, and the one a
first repair of the other four walked past. A claim in the past tense about an issue that did not exist is
`../.portulan/dod.md` condition 4's own case, and a fix that stops at the sites somebody quoted is
[`0020`](../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md). Both found at the
pre-commit checkpoint's second pass, which re-derived the carrier set instead of reading the list it had
been handed._

## Clause (c) — the loop's own figures stop being counted by hand

```
node cli/review-meter.mjs --snapshot evals/review-loop/snapshot.json      the figures
node cli/review-meter.mjs --fetch --repo <owner/name> --out <file>        the one mode that fetches
```

Landed 2026-08-26. `goldens` asks whether a gate has fixtures; `mutants` whether those fixtures
discriminate; `drills` whether the rail still fires. **This one measures the process wrapped around all
three** — the review loop every change here goes through.

**Its provenance is a record that indicts itself.**
[`../.portulan/memory/a-review-loop-needs-a-bound.md`](../.portulan/memory/a-review-loop-needs-a-bound.md)
bounds the loop on a table — 110 submissions over 30 pull requests, 29% of them finding nothing — every
figure counted by hand on 2026-07-28, and its own *Why it holds* section says **"Nothing checks it —
discipline, not a rail"**, citing
[`../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md`](../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md).
The 2026-07-28 amendment answered it in as many words: *"the telemetry clause is where that checker's
home is, and naming the home is what this amendment does rather than claiming the checker exists."*

### The units were the design decision, and the criterion predates the definition it uses

The criterion was written **2026-07-28**; *round* was defined **2026-07-30** as *a Copilot review the
working session answers with a push*. The rule's table was **re-labelled, not re-counted** — its figures
always counted **submissions** — and its `Retire when:` settles it, naming the threshold in *"the
submission units of the table above, **not fix-rounds**"*. So the criterion's *"rounds per pull
request"* is submissions per pull request, and the tool prints that name and never the bare word.

### What the API answers, and the one thing it does not

**Fix-rounds are not derivable, and that is the finding rather than a gap.** Two demonstrations, both
from the pull request that produced the definition: on
[#105](https://github.com/sleepy-panda-srl/portulan/pull/105) the commit `08d7d10` answered an inline
finding and **was never a reviewed head** — it rode inside the next push — and the push at `cff3e4e0`
follows a 4,087-byte finding-bearing submission while answering none of it. Any rule keyed on *"a
finding-bearing submission preceded this push"* calls the second a round; the maintainer's own table
calls it *no*. The 2026-07-30 ruling states the method that works and it is not one an API has:
*"Count pushes, then look inside each one."*

So the tool computes no fix-rounds, estimates none, and prints nothing that could be mistaken for one.

**The empty-round rate is an upper bound, and the reason is a layering rule.** Finding nothing has two
halves — no inline thread, *and* no suppressed low-confidence note in the body. The first is
structural. The second is decided by the awk in
[`../.github/workflows/copilot-review.yml`](../.github/workflows/copilot-review.yml), fixtured in
[`../.portulan/verify/workflow-filters.mjs`](../.portulan/verify/workflow-filters.mjs) — a matcher
deliberately reduced to **one** carrier, and a **workspace-layer** one, while the tool is engine.
Copying it would put two spellings of one rule on opposite sides of the boundary where neither could
see the other drift. So the tool reports `submissions that found nothing ≤ submissions with no inline
comment` and prints the right-hand side under its own name.

**The boundary forbids a copy; it does not make the exact rate unreachable**, and the first draft of
this section conflated the two. `../.portulan/verify/workflow-filters.mjs` already **lifts and runs**
those awk programs out of the workflow's parsed `run:` scalars, and `--fetch` already spawns — so a body
could be piped through the lifted program at capture time and stored as one integer, no second spelling
and still no bodies in the snapshot. Left unbuilt for **budget**, one clause per session, and tracked as
[#355](https://github.com/sleepy-panda-srl/portulan/issues/355).

### What the first run measured

**140 submissions over the 30 most recently merged pull requests — 4.67 each.** The record's
hand-counted figure is **3.7**, and the two are **not a disagreement**: they measure **disjoint
corpora**. The ratified window is the thirty most recent as of 2026-07-28 and names #44, #49 and #57;
this one runs #301–#354. They share no pull request. So the honest sentence is *the loop weighs 4.67 a
month later*, not *his 30 were re-counted and came out different* — a distinction the first draft of
this section lost, and the pre-commit checkpoint restored.

That figure is **reported and not acted on**: the record is maintainer-ratified and the curated layer is
human-owned, so a re-derived number is a finding for him rather than an edit for an implementer.

**And two of the three figures turned out to be one figure.** Pushes and submissions came out exactly
equal — 140 and 140 — because `review_on_push: true` draws one submission per push. So the criterion's
*"pushes per round"* is **1.00 by construction** in submission units, which the register now prints
under that name rather than leaving a reader to infer it; and pushes-per-finding-bearing-submission,
the informative substitute, is not a second measurement either: it is `1/(1 - the no-inline rate)`, and
140/46 = 3.04 = 1/(1 - 0.671). The tool **detects the coincidence and says so** on every run and in the
register, rather than presenting three columns of which two are algebraically the same column.

**The window is by merge date, and getting that wrong was this change's own worst defect.**
`gh pr list` orders by pull request **number**, and the first capture taken here inherited that order —
three merge-order inversions, a corpus containing #303 and missing #301, under a register claiming *"the
30 most recently merged"*. Every published figure was against a corpus its own heading did not name.
Found at the pre-commit checkpoint from evidence inside the committed snapshot: `mergedAt` was already
captured and nothing sorted on it. The fetch now lists a **pool** and takes the window from it by merge
date, records whether the pool saturated — an unsaturated pool makes the window provable rather than
likely — and `validateSnapshot` refuses a snapshot that is not in descending merge order.

### What this rail does NOT establish

| The rail answers | The rail cannot answer |
|---|---|
| Do the published figures come out of the captured data? | Is the captured data current? |
| How heavy is the loop, in submissions? | How heavy is it in fix-rounds? |

**It is a meter, not a bound.** Rule 4 stops a loop at two fix-rounds and nothing here stops anything;
the record's own honest-limits section already says the judgement it depends on is the interested
party's about its own work, and a tool reporting after the merge does not change that. It adjudicates
no **sibling** exemption either, so *rounds past the bound* is not computable and is not claimed.

**And the snapshot does not refresh itself.** The `review-loop` recipe compares a register to a
snapshot, never a snapshot to the world, so a stale capture and a current one are the same green.
Refreshing is `--fetch`, run by a person. That is the same silence
[#344](https://github.com/sleepy-panda-srl/portulan/issues/344) tracks for the drill calendar, in a
second place, and it is now **filed** as
[#356](https://github.com/sleepy-panda-srl/portulan/issues/356) rather than only named — the two want
one mechanism between them and closing them together is likely cheaper than either alone.

## Golden tasks per core skill — the mandates bound to what they govern

```
node cli/skill-goldens.mjs --repo-root . --workspace .portulan
```

Landed 2026-08-26. **The row's original first subject**, untouched by either amendment: the 2026-07-28
expansion says it *"stands exactly as written"*, and clause (a) *widened its subject* to reach the gates
*"as well as the skills"* **without narrowing the subject it already had**
([`../docs/milestones/m08.md`](../docs/milestones/m08.md), the amendment's own words). (a) built the
gates half. This is the half that sentence always named.

### The reading was ruled, not derived

The criterion reads two ways — a deterministic corpus, or task specifications run against a live model
and judged. [`../.portulan/gate-map.md`](../.portulan/gate-map.md)'s *"Session-open runs `clarify`
against the milestone row itself"* exists because milestone 4 guessed at exactly this shape of ambiguity,
so it went to the maintainer instead of into an argument. **His ruling: a deterministic corpus graded
against live artifacts in the tree.** The model-run sense is the **A/B clause**, separately named in the
same row — and under the other reading the two clauses would collapse into one, which no amendment did.

### What a case is

A case binds one numbered step of a skill's `## The pass` to the artifact set it governs, and names the
rail that enforces it — or `null`, which is the interesting value. Four properties, each of which exists
because a checkpoint found the version without it:

- **The denominator is derived, not chosen.** The runner enumerates the steps out of the skill file and
  requires every one to be `bound` or `unbindable`. A fifteenth step is red. The first draft let the
  author pick which mandates to answer for, and a census over a set its own author drew reports *"5 of
  5"* and means nothing — the difference [`../cli/goldens.mjs`](../cli/goldens.mjs) already draws by
  deriving its denominator from the yielded policy.
- **An empty step list is could-not-run.** Three `## The pass` spellings exist, so an exact match finds
  one skill of three and the other two satisfy *every step is accounted for* **vacuously**. That is this
  directory's own sentence about clause (d) — *"a check whose enumeration went empty … reports green and
  has stopped being a rail"* — and the heading match is anchored besides, because a loose one grabs
  `consolidate`'s `## The one move this pass may not make`.
- **A mandate quote must place exactly once**, or the case refuses. A skill whose wording is reworded,
  softened or deleted reddens instead of drifting, and **nothing in this tree did that before.**
- **The predicates use the carriers' own exported functions rather than re-spelling them.** The runner
  imports `RETIRE_WHEN` from [`../cli/doctor.mjs`](../cli/doctor.mjs), so the retire-when check is
  `doctor`'s regex and not a second one. **What that does not do — and three carriers of this sentence
  once said it did — is verify the `carrier` field.** Nothing links it to a check: the pre-commit
  checkpoint rewrote every carrier in a corpus file to a module that does not exist and the corpus
  stayed green. `carrier` is a **declared, reviewed field**, and a reviewer is what checks it.

### `unbindable` is adjudicated, never asserted

The dodge is obvious — call a mandate unbindable and it needs no case. So the reason takes a **closed
vocabulary**: `judgement-only`, `no-artifact`, `cross-language`, and `already-carried` — the last added
at the pre-commit checkpoint, which found a row classed `bound` whose named carrier the runner never
reads, and no honest term for what it actually was. And a `judgement-only` step **may name
no artifacts**: if you can name the artifacts a mandate governs, it is not judgement, it is unbuilt.
That is [`../cli/mutants.mjs`](../cli/mutants.mjs)'s rule that a `survives` record is admissible only as
a proof and never as a standing note that a gap exists.

### What the first run measured

**Five of fifteen mandates bind to live artifacts — four load-bearing, one census — and ten are
adjudicated unbindable.** No figure is written here beyond that shape; the runner prints its own totals.

**The ratio is a finding rather than bookkeeping.** How much of a core skill is artifact discipline and
how much is agent judgement is a measurement *about the engine*, which is what this row exists to
produce. **Read the split, not the total**: of the ten unbindable, five are `judgement-only` — one third
of the fifteen — and the rest are `no-artifact`, `cross-language` or `already-carried`, which mean a
carrier exists somewhere else. The judgement rows are the A/B clause's **first** subject. _(**Widened
2026-08-28, on the maintainer's ruling**, and this sentence read "Only the judgement rows are the A/B
clause's subject" until then. The A/B clause's subject is the mandates `core/` ships that an arm actually
receives — the kernel's, plus the artifact mandates reachable in a built arm — of which the judgement
rows are a part. The reason the narrower reading could not stand is measured rather than argued:
`vendor --host` carries `core/skills/` **not at all**, so all five judgement rows reach nothing
in a vendored arm and would grade the base model. See [`ab/corpus.md`](ab/corpus.md). Four carriers
stated the narrower reading and all four moved in one change; the claim is registered in
[`../.portulan/rule-carriers.json`](../.portulan/rule-carriers.json) so a fifth cannot appear **in the
registered scope** unnoticed — bounded by that registry's own `exclude` list, which is the one carrier
of what it holds and which covers `docs/milestones/`, where the fourth carrier sat.)_ _(Three carriers of
this paragraph said "two thirds are judgement", which was the unbindable total wearing the judgement
label. Corrected at the pre-commit checkpoint, which also found one row classed `bound` whose named
carrier the runner never reads.)_

**One of the five rows is `census`, and it is marked as such** in the corpus and in the output. A census
row re-indexes a figure `doctor` already prints, under the mandate that wants it; it is not a new check,
and presenting five equal rows would read as more evidence than it holds — the repair this directory
already applied to three columns of which two were one column.

### Accepted drift — the in-tree record

Three live findings, and **all three ship green with the defect accepted rather than repaired.** That is the
distinction to keep: `goldens` and `mutants` each went red on their first run and shipped green with the
defect **fixed**. These are merged records, not an implementer's to rewrite, and doing so under a
one-clause budget would be a second clause.

| Mandate | Live artifacts | Drift |
|---|---|---|
| `clarify` step 4 — fold answers back as **EARS** acceptance criteria | `.portulan/tasks/` | **12 of 19** — but see the split below |
| `codify` step 1 — name the incident and link it | `.portulan/proposals/` | **6 of 33** carry no provenance field |
| `codify` step 3 — attach how it earns its place | `.portulan/proposals/` | **13 of 33** carry no enforcement field |

**The composition of the twelve matters and the headline hides it.** Ten carry **no acceptance-criteria
section in any spelling** — five of those renamed it `## Done when` (`0010`–`0013`, `0015`) and five are
retrospective arc records — and only **two** fail on EARS *shape*: `0001` (one bullet of four) and
`0007` (one of six). The 48 criteria live entirely in the nine files that have a section, and **46 of
them are shaped**. So *"12 of 19 fail the EARS mandate"* is arithmetically right and rhetorically
wrong, and the three-cohort breakdown is in
[#358](https://github.com/sleepy-panda-srl/portulan/issues/358).

**The maintainer ruled on 2026-08-26 that [`../core/templates/task.md`](../core/templates/task.md)'s
shape still binds**, so the twelve are non-compliant by his word rather than by an implementer's
inference — which is what makes this an accepted drift and not a divergence pinned before anyone ruled.

**It holds in both directions.** A file here that starts complying reddens the corpus until it is
delisted, because a drift list that outlives its drift is as wrong as one that hides it. That direction
is not decoration: it caught **three filenames the author had written from a number prefix rather than
read off disk**, before any reviewer saw them.

**The figure moved twice before it was written down, and that is the lesson worth carrying.** One
opening pass said 10 of 19, another said 12, a third said 19 — because each computed before deciding the
predicate. Section-presence answers 10; the mandate's own words are about EARS **shape**, and under that
predicate it is 12, with 46 of 48 individual criteria EARS-shaped. **The predicate is now a reviewed
field on the case**, decided before any figure.

### What this rail does NOT establish

| The rail answers | The rail cannot answer |
|---|---|
| Is every mandate accounted for? | Is the binding any good? |
| Does a named carrier **contain** its check? | Does it **run** it? |

The second row is the one to read twice. An import proves the carrier holds the symbol; a rail could
keep it, stop calling it, and this corpus would not notice, because the verdict is computed here over
the artifacts rather than by asking the rail. Closing it needs a per-mandate drill — perturb a record,
require the named rail to fire with its own tell — which is [`../cli/drills.mjs`](../cli/drills.mjs)'s
shape one grain finer and is a second clause's work.

And it grades a skill's **mandates** against the tree, never an agent's judgement in following one. No
golden task here tells you whether an agent given `clarify` asks good questions.

## OTel opt-in config — the first thing here that can send anything anywhere

**The reading was ruled, not derived.** *"OTel opt-in config"* reads at least three ways, and
[`../.portulan/gate-map.md`](../.portulan/gate-map.md)'s *"Session-open runs `clarify` against the
milestone row itself"* exists because milestone 4 guessed at exactly this shape of ambiguity and cost a
session-blocking question. Put to the maintainer on 2026-08-28 as three readings — a config surface
emitting nothing; that surface **plus a real emitter**, hand-written OTLP-over-HTTP JSON, off by
default and never callable from a verify recipe; or an OTLP-shaped local file sink with no network path
at all. **He ruled the second.** The same session ruled the signal set (**the review-loop figures
only**) and the consent model (below), so all three axes of this clause are his rather than an
implementer's — which is the standard session 4 set for this row and the one milestone 4 paid for.

**Why this clause now.** A written-down dependency pointed at it and nothing pointed anywhere else:
[`../.portulan/verify/review-loop.sh`](../.portulan/verify/review-loop.sh) said the then-still-open OTel
clause *"owes an emission path for these figures … which is why they are written as machine-readable
JSON with a rendered register beside them, rather than as prose an exporter could not consume."*
Session 3 shaped its output for this session. The debt is discharged **on either reading** of that
recipe's locative phrase: if he reads *"in the telemetry clause"* the other way, the path is now built;
if he does not, none was owed.

```
evals/telemetry/config.json             the committed opt-in — the ONLY gate on emission
evals/telemetry/review-loop.otlp.json   the golden payload, regenerated and byte-compared
```

Graded by [`../cli/telemetry.mjs`](../cli/telemetry.mjs), run as the `telemetry` verify recipe, on
every pull request. See it by hand with:

```
node cli/telemetry.mjs --config evals/telemetry/config.json --render
```

### Why the opt-in is a committed file and not `OTEL_SDK_DISABLED`

This is the one place the tool departs from the OpenTelemetry environment contract, and it is stated
out loud rather than left to be discovered. **`OTEL_SDK_DISABLED` defaults to `false`.** Honouring the
standard environment surface as the *gate* would mean an adopter who already exports
`OTEL_EXPORTER_OTLP_ENDPOINT` in CI — for some other service — starts emitting from Portulan without
having decided to. That is an opt-**out**, and the criterion's word is *opt-in*. It would also put a
team decision in ambient per-machine state, which is the inverse of `core < pack < workspace`.

So the committed file is the only gate, and the environment supplies **transport only** — the OTLP
endpoint and header variables in both their general and metrics-specific forms, so an adopter's
existing collector configuration works unchanged and **a secret never enters a committed file**
([`../.portulan/dod.md`](../.portulan/dod.md) condition 5). The validator refuses a config carrying
`headers`, `endpoint` or a token outright, so that is a rail rather than a review note.

**What of that contract is implemented, at its real width.** Read:
`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` — used **as given**, since the specification makes the
signal-specific variable the full URL — falling back to `OTEL_EXPORTER_OTLP_ENDPOINT` as a base with
`/v1/metrics` appended; and `OTEL_EXPORTER_OTLP_METRICS_HEADERS` **replacing**
`OTEL_EXPORTER_OTLP_HEADERS` rather than merging. **Not** read, each a silent no-op for an adopter who
sets it: `OTEL_EXPORTER_OTLP_PROTOCOL` (this emitter speaks `http/json` only), `_TIMEOUT`,
`_COMPRESSION`, `_CERTIFICATE` and the client-auth pair. _This paragraph exists because the two carriers
it replaces said the variables were read **"exactly as the specification defines them"** while the
metrics-specific endpoint was ignored and appended to — which produced `/v1/metrics/v1/metrics` for
anyone configured the standard way. A partial implementation of a public contract is fine; describing
one as complete is the overclaim [`../.portulan/principles.md`](../.portulan/principles.md) opens with._

### The config was NOT made a Workspace Definition slot, and the cut is the session-open checkpoint's

The first plan put it in the schema as a `telemetry` slot at spec 2.9. The checkpoint cut it, on
grounds worth keeping: **every slot in that train arrived through a ruled proposal** —
[`../spec/README.md`](../spec/README.md)'s 2.8 argument cites proposal `0025`, `governed_by` cites
`0017`, `provenance` cites `0002` — and [`../.portulan/gate-map.md`](../.portulan/gate-map.md) makes an
idea that adds a surface a **proposal**, *"never opened as an implementation pull request with tests."*
[`../spec/slots.md`](../spec/slots.md)'s own `evals` deferral says a schema change plus a spec bump plus
a migration *"is not a thing to do in passing"* and defers to **when milestone 8 closes**; and the slot
would have shipped with **zero filled instances**, since this workspace declares telemetry off and
[`../examples/`](../examples/) stays at 2.4 — which is
[`../spec/slots.md`](../spec/slots.md)'s *"splitting on speculation is how a schema acquires slots
nobody fills"* exactly. It is filed as [`0034`](../.portulan/proposals/0034-one-spec-bump-carries-both-evals-and-telemetry.md) — **accepted by the maintainer 2026-08-28** — to ride with
`evals` at the close, which makes it one bump instead of two. The acceptance commissions the drafting
and settles none of the shape: the key names, either slot's structure, and whether a migration is owed
are the drafted work, and the close remains the earliest sensible moment because `slots.md`'s deferral
conditions the `evals` half on row 8 having decided what an eval artifact is here.

### Consent — ruled, and railed rather than promised

[`../.portulan/gates.json`](../.portulan/gates.json) makes *sending anything outward on the team's
behalf* Gated, and [`../core/operating/autonomy.md`](../core/operating/autonomy.md) says Gated is **per
action**. Proposal
[`0014`](../.portulan/proposals/0014-a-feedback-pipe-points-out-of-the-seam.md) reserved telemetry as
*"a separate mechanism with separate consent"* — named there, ruled nowhere, until now.

**His ruling: the committed opt-in config IS the standing consent.** Each export rides on it without a
fresh per-send approval, the way a compiled gate carries a tier without asking again; what stays Gated
and his alone is **committing a config that says `enabled: true`**. The ruling is transcribed into
`gates.json`'s own rule and into the gate map in the same change, because a ruling living only in a
session note while those said otherwise would be one rule with two disagreeing carriers, obeyed at the
narrower.

Three things keep it from widening into the thing the tier exists to stop, and each is a rail:

- `--export` refuses in **three** states, and the third is the one that matters most: the config is
  **untracked**, **tracked but absent from `HEAD`** — staged and never committed — or **differs from
  `HEAD`**. So an agent cannot
  manufacture consent by editing a working copy. Without this the ruling would be a mandate nothing
  checks, arriving inside the change that states it.
- **`--export` is person-invoked only.** No workflow, hook or schedule runs *that mode*, and wiring one
  in is a new consent question rather than a covered one. _The narrowing matters and the first draft got
  it wrong in the direction that misleads: CI runs `cli/telemetry.mjs` on **every** pull request, because
  the `telemetry` recipe is in the yielded set and [`../.github/workflows/verify.yml`](../.github/workflows/verify.yml)
  runs the set. What CI never runs is `--export`, and a sentence saying the module is person-invoked
  tells a reader auditing consent to stop looking._
- It **neither queues nor retries**, on [`../cli/feedback.mjs`](../cli/feedback.mjs)'s rule that a queue
  flushing itself later is a silent send with extra steps.
- **Nothing from the transport environment is logged.** Headers never; the endpoint only as origin and
  path, with userinfo and query stripped, and not at all when it failed to parse. An endpoint legally
  carries `user:pass@` and tokens ride in query parameters, so printing it in full leaked exactly what
  withholding the headers protected — into CI logs, which are long-lived and world-readable here.

### The payload is closed by construction, and was widened exactly once

Emission is assembled from an explicit allow-list of aggregate figures; no producer is handed a
snapshot to spread into a body, so there is no path from a free-text or path-shaped field to the wire.
The ruled vocabulary was *figures, rule ids, recipe ids* — **no identity at all**, which would have made
one workspace's export indistinguishable from another's at any collector. Put to him rather than
widened by an implementer, on `cli/feedback.mjs`'s rule that a closed list is wrong only when somebody
widens it **on purpose**: he widened it to **one named resource attribute**, the repository slug. A
reviewer **login** stays excluded and is the field this deliberately is not — this snapshot's only login
is a bot's, but an adopter's would carry human names.

The attribute vocabulary is **pinned in both directions** by the suite, so an added key *and* a deleted
carrier are each a red — against two lists rather than one, because they are two questions. The
allow-list says what an emission *may* carry; a separate floor says what it *must*. One list checked
both ways made `service.namespace` — optional in the config and optional in OpenTelemetry's own
conventions — look mandatory, and was green only because this workspace happens to declare one. A pin
that is correct by coincidence of a single instance is the shape a census over its author's own set
takes, one clause over.

### What this rail does NOT establish

- **It cannot tell a current snapshot from a stale one.** It checks the payload against the snapshot,
  never the snapshot against the world — [`review-loop.sh`](../.portulan/verify/review-loop.sh)'s cost
  inherited one step down, and [#356](https://github.com/sleepy-panda-srl/portulan/issues/356). What
  this layer adds is that the capture stamp travels **inside** the payload, so a stale export arrives
  labelled stale rather than looking fresh. A consequence to state rather than assert a threshold for:
  a stale export carries an aged `timeUnixNano`, and time-series backends commonly drop or reject aged
  samples — semantically correct and silently discarded is the worst pair.
- **The consent rail establishes *tracked and byte-identical to `HEAD`* — not *committed by him*.**
  `commit-to-a-working-branch` is tier **auto**, so an agent commits unattended; a consent committed by a
  scripted `git commit` clears every gate this rail has. What the rail buys is real and is narrower than
  it first reads: it moves the act from a file edit nobody sees into **a commit that appears in a
  reviewed diff**, on the branch a human merges. It cannot tell whose commit it is, and nothing here
  claims it can. Measured at the pre-commit checkpoint rather than reasoned about.
- **The offline audit's class is derived, and was not always.** The table claimed to rail the class of
  network-capable modes in `cli/` and listed **two of three** — `cli/feedback.mjs` files a GitHub issue
  through `gh issue create` and had been network-capable longer than either of the others. A set drawn
  by its author and reported as complete is the census shape session 4 named one clause over, committed
  at this table's birth and found at round 10 of the review. The suite now **derives** the set from the
  tree, so a new network-capable module reddens. What remains uncovered is narrower: a module reaching
  the network in a way the derivation does not see, and a mode reached **indirectly**. It
  matches a module as a path **suffix** and a flag as a **token**, so `./` and `--flag=value` spellings
  are covered — the first version knew one literal string, which made `./` a bypass — but a mode reached
  **indirectly**, through another script or a flag built at runtime, is invisible to it and no wider
  pattern fixes that.
- **The opt-in is never demonstrated in the affirmative from a committed artifact.** No workspace in
  this tree declares telemetry on, so every green here is a green about the **off** path. The send is
  proven in the suite against an injected transport and a temporary repository with the consent really
  committed — a session-time observation, not a standing one, which is the state clause (d) exists to
  replace and does not reach here.
- **`--export`'s network path is covered only by unit tests against a fake**, and by construction no
  yielded recipe may ever exercise it — this recipe's own `offline` check forbids it. That is a
  deliberate consequence rather than an oversight, and it is the mode that matters.
- **Emission is not scheduled**, and nothing fires when nobody runs it —
  [#344](https://github.com/sleepy-panda-srl/portulan/issues/344)'s silence problem in a third place.
- **The review-loop bound is still checked by nothing.** The 2026-07-28 amendment says *"the telemetry
  clause is where that checker's home is"* for
  [`a-review-loop-needs-a-bound.md`](../.portulan/memory/a-review-loop-needs-a-bound.md). An emitter
  with no backend reading it does not discharge that, and this clause must not be read as enforcement.
- **Metrics only.** OTLP's trace payload is a second shape with a second set of semantics; one signal
  demonstrated beats two asserted.

## What is NOT built yet

Each names where it arrives, per [`../.portulan/dod.md`](../.portulan/dod.md) condition 4 — nothing
here claims a capability that does not exist:

- **A rule change merged or rejected on eval evidence** — arrives in milestone 8, a later session.
  Every rule in [`../.portulan/memory/`](../.portulan/memory/) to date was merged on review alone.
- **A release carries an eval result** ([`../docs/plan.md`](../docs/plan.md), Protocol → Versioning).
  Arrives in milestone 8, a later session. **This was the row's ninth clause as of 2026-08-24 and was
  nobody's until that day**: the Protocol had carried the obligation since the plan was locked while
  row 8's criterion listed eight deliverables and did not include it, so a close re-deriving the
  criterion clause by clause would have re-derived eight and left it unbuilt. Named here first as
  *unassigned*; the maintainer then ruled it a close condition and it is now in the row itself. What
  an eval result consists of, and where a release carries it, is still open.
