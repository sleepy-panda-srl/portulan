# evals/

Milestone 8's home: the golden corpora, the review-loop register, the telemetry opt-in, the A/B harness's
records and the eval result each release carries. Row 8 of [`../docs/plan.md`](../docs/plan.md) is the
binding criterion; [`../docs/milestones/m08.md`](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/docs/milestones/m08.md) is its legislative history.
This file does not restate either — a rule with two carriers is obeyed at the narrower one. It says what
is here, how to run or extend each rail, and what each one does not establish; a rail's detail is its
module's header comment. How each clause came to be — first-run figures, reversed designs, review
rounds — is at `git show 8a33f9b:evals/README.md`.

## Two words that mean two things here

**"Eval" carries two unrelated senses in this repository, and only one of them lives in this directory.**

| Sense | Where it lives | What it is |
|---|---|---|
| **Evaluation as measurement** — golden tasks, A/B, the eval gate | **here**, `evals/` | Does the engine make an agent work better? Milestone 8's subject. |
| **Evaluation as a licensed copy** | [`../cli/eval-bundle.mjs`](../cli/eval-bundle.mjs), [`../.portulan/verify/eval-bundle.sh`](../.portulan/verify/eval-bundle.sh) | A named-recipient bundle cut from a commit under evaluation terms, its issuance ledger kept outside this repository. Nothing to do with this directory. |

So the machinery here is named **`goldens`**, never `evals`: the directory keeps the row's word and the
tools take a narrower one. And **`goldens` names two runners** — two subjects and two oracles, which is why
they are two modules and two recipes rather than one with a flag. [`../cli/goldens.mjs`](../cli/goldens.mjs)
grades the **compiled gates** through the compiler's own `matchesRule`;
[`../cli/skill-goldens.mjs`](../cli/skill-goldens.mjs) grades the **core skills'** mandates against the
live artifacts they govern.

Each rail below is a verify recipe in [`../.portulan/verify/`](../.portulan/verify/), run on every pull
request; `bash .portulan/verify/<recipe>.sh` runs one by hand, and `node cli/<module>.mjs --help` prints a
module's modes. Every runner prints its own totals, so no figure is written here.

## The gate corpus — clause (a)

```
evals/goldens/gates/<rule-id>.json      one fixture file per rule in the yielded gate policy
node cli/goldens.mjs --workspace . --pack-root packs
```

**What a fixture is.** A file is named for its own `rule` field — the runner refuses a misfiled one — and
holds `cases`, each `{id, class, tool, path, input, expect, why}`. A case is **data**, answered by the
compiler's own exported `matchesRule`, the function the hook calls at tool time. **A case's command string
is never executed**, and the suite asserts the runner imports no process-spawning API. Two classes, and
exactly two:

- **`holds`** — the matcher catches this today and must keep catching it.
- **`documented-hole`** — the matcher does **not** catch this, and `hole` names the record that says so.
  It holds **in both directions**: if the hole silently closes, the case goes red until the record is
  updated.

`path` names the branch of `matchesRule` a case exercises — `matchesPath`, `shell-write`, `shell-prefix`
or `no-branch` — and is **derived, never declared**: the runner computes it with `matcherPath(kind, tool)`
and refuses a case that disagrees. Byte-level attacks are stored **escaped** (JSON `\r`, `\u0000`), since
[`../cli/control-chars.mjs`](../cli/control-chars.mjs) refuses raw control bytes in the tree; the suite
checks both that the corpus is clean and that the escapes decode.

The corpus is load-bearing for the next clause: clause (b) needs this corpus as its kill-set and this
fixture format as its output shape. A `mutants` survivor is repaired by a new case here, and a `fuzz-shell`
finding prints as a case ready to paste — reviewed first, since its `expect` records what the matcher did.

**What it does NOT establish: adequacy.** It checks **presence** — every compiled gate has fixtures and
every case answers as recorded — which one trivial case per rule satisfies. `mutants` checks
**discrimination**; **realism**, whether the attacks resemble anything an adversary would type, stays a
reviewer's judgement. The runner prints that limit on every green and names every rule exempt for
declaring no matchable action.

## Mutants and the grammar fuzzer — clause (b)

```
node cli/mutants.mjs    --workspace . --pack-root packs     the mutation census
node cli/fuzz-shell.mjs --workspace . --pack-root packs     the grammar fuzzer
```

**`mutants` asks whether the corpus discriminates.** It breaks [`../cli/compile.mjs`](../cli/compile.mjs)'s
matcher region on purpose, one declared, anchored operator at a time, and grades each mutant against the
gate corpus. An operator the corpus fails to notice is a hole in the kill-set and the repair is a new
fixture; a `survives` record is admissible only as a **proof** of equivalence, never as a standing note
that a gap exists.

**`fuzz-shell` asks whether the two segmenters answer one grammar.** It composes each command from a
grammar, so it knows whether the payload sits where bash would execute it or only print it. Positions are
enumerated and recorded, spellings are fuzzed, and every spelling of one command in one position must get
the same answer; every recorded divergence from ground truth cites its record. The grammar's own ground
truth is measured under real bash with a neutral payload by
[`../cli/fuzz-shell.ground.test.mjs`](../cli/fuzz-shell.ground.test.mjs), and the seed is pinned and
printed on every run.

**What they do NOT establish:** that the attacks are realistic (`mutants`), or what a gate ought to cover
(`fuzz-shell` — whether a recorded escape should stay open is a policy question for the maintainer).

## Forced-red drills — clause (d)

```
node cli/drills.mjs --pack-root packs                       the sweep: force every rail red
node cli/drills.mjs --check --pack-root packs                the roster: every rail has a drill
```

`goldens` asks whether a gate has fixtures and `mutants` whether they discriminate; **this asks whether
the rail still fires at all.** A drill is a pair — a control on a pristine tree, then a perturbation that
must place exactly once and move bytes on disk — and the rail's output must carry the drill's declared
tell in the fire and not in the control. Each runs in a throwaway `git worktree`. A new rail needs an
entry in `DRILLS` in [`../cli/drills.mjs`](../cli/drills.mjs): `--check` reds a yielded rail with no drill.
The sweep reports on a **commit** and refuses a dirty tree (`--working-copy` synthesizes one), which is why
the verify recipe runs `--check` and not the sweep; the rails it cannot force are named in its output, each
with the reason.

**The calendar** is [`../.github/workflows/drills.yml`](../.github/workflows/drills.yml), weekly, and its
header carries the recorded runs of both its triggers, the dispatch and the schedule.

**What it does NOT establish:** `--check` runs no rail, so whether each one fires is the sweep's answer on
the calendar; and a scheduled run that never starts stays undetectable from inside —
[#344](https://github.com/sleepy-panda-srl/portulan/issues/344).

## The review-loop meter — clause (c)

```
node cli/review-meter.mjs --snapshot evals/review-loop/snapshot.json      the figures
node cli/review-meter.mjs --fetch --repo <owner/name> --out <file>        the one mode that fetches
```

[`review-loop/snapshot.json`](review-loop/snapshot.json) is the capture and
[`review-loop/register.md`](review-loop/register.md) the register rendered from it: the first command
with `--register evals/review-loop/register.md --write` regenerates it, and the recipe byte-compares it.
The criterion's *"rounds per pull request"* is **submissions** per pull request — its unit before *round*
was redefined — and the tool prints that name, never the bare word.
[`../cli/review-meter.mjs`](../cli/review-meter.mjs)'s header says what each figure is.

**What it does NOT establish:**

- **Fix-rounds.** Whether a push answers a submission is a fact about its contents that no API answers, so
  the tool computes none, estimates none, and prints nothing that could be mistaken for one.
- **The exact empty-round rate.** It prints `submissions that found nothing ≤ submissions with no inline
  comment`, an upper bound. The other half — a suppressed note in the review body — was decided by a
  workspace-layer matcher the engine tool refused to copy, since two spellings of one rule on opposite
  sides of that boundary cannot see each other drift; the matcher left with its workflow on 2026-09-23
  ([#355](https://github.com/sleepy-panda-srl/portulan/issues/355)).
- **A bound.** It is a meter: rule 4 of
  [`a-review-loop-needs-a-bound.md`](../.portulan/memory/a-review-loop-needs-a-bound.md) stops a loop, and
  nothing here stops anything.
- **Current data.** The recipe compares the register to the snapshot, never the snapshot to the world, so a
  stale capture and a current one are the same green. Refreshing is `--fetch`, run by a person
  ([#356](https://github.com/sleepy-panda-srl/portulan/issues/356)).

## Golden tasks per core skill

```
node cli/skill-goldens.mjs --repo-root . --workspace .portulan
```

The row's original first subject. **Ruled, not derived:** a deterministic corpus graded against live
artifacts in the tree; the model-run sense is the A/B clause's.

**What a case is.** [`goldens/skills/<skill>.json`](goldens/skills/) holds one case per numbered step of
the skill's `## The pass`. The runner derives that denominator from the skill file, so a new step is red
until a case accounts for it. A step is either:

- **`bound`** — a `mandate` quote that must place exactly once in the skill's `SKILL.md`, the `artifacts`
  it governs as a declared slot, a `predicate` decided before any figure is taken, and a `carrier` naming
  the rail that enforces it, or `null`. `kind` is `load-bearing`, or `census` for a row that re-indexes a
  figure an existing recipe already prints.
- **`unbindable`** — with a `reason` from a closed vocabulary: `judgement-only`, `no-artifact`,
  `cross-language` or `already-carried`. A `judgement-only` step may name no artifacts: if you can name the
  artifacts a mandate governs, it is not judgement, it is unbuilt.

### Accepted drift — the in-tree record

A bound case may list live files that fail its mandate and still ship green, in `expect.accepted` as
`{file, why}`: a merged record is not an implementer's to rewrite. The runner refuses an entry whose `why`
carries no argument, and the list holds **in both directions** — a file that starts complying reddens the
corpus until it is delisted, because a drift list that outlives its drift is as wrong as one that hides
it. The runner prints each count beside the compliant total. Three mandates carry accepted drift, tracked
together as [#358](https://github.com/sleepy-panda-srl/portulan/issues/358):

| Mandate | Live artifacts | Drift |
|---|---|---|
| `clarify` step 4 — fold answers back as **EARS** acceptance criteria | `.portulan/tasks/` | no acceptance-criteria section, or criteria not EARS-shaped |
| `codify` step 1 — name the incident and link it | `.portulan/proposals/` | no provenance field |
| `codify` step 3 — attach how it earns its place | `.portulan/proposals/` | no enforcement field |

**The maintainer ruled on 2026-08-26 that [`../core/templates/task.md`](../core/templates/task.md)'s shape
still binds**, so `clarify`'s twelve accepted files are non-compliant by his word rather than by an
implementer's inference — which is what makes them accepted drift and not a divergence pinned before
anyone ruled. Of those twelve, ten carry no acceptance-criteria section in any spelling and two fail on
EARS shape alone, so *"fails the EARS mandate"* is arithmetically right and rhetorically wrong; #358 has
the cohorts.

### What this rail does NOT establish

- **Adequacy.** A mandate can be bound and the binding trivial.
- **That a carrier runs its check.** The predicates import the carriers' own functions — `RETIRE_WHEN`
  comes from [`../cli/doctor.mjs`](../cli/doctor.mjs) — which proves a carrier **contains** the check,
  not that it **runs** it; and `carrier` is a declared, reviewed field that nothing links to a check.
  Closing that needs a per-mandate drill, the `drills` shape one grain finer.
- **An agent's judgement.** It grades a skill's mandates against the tree, never an agent following one.
  The `judgement-only` rows are the A/B clause's first subject, which [`ab/corpus.md`](ab/corpus.md)
  carries.

## The OTel opt-in

```
evals/telemetry/config.json             the committed opt-in — the ONLY gate on emission
evals/telemetry/review-loop.otlp.json   the golden payload, regenerated and byte-compared
node cli/telemetry.mjs --config evals/telemetry/config.json --render
```

The same command with `--write evals/telemetry/review-loop.otlp.json` in place of `--render` regenerates
the golden, which every release cut owes because the version rides in the payload. **Ruled, not
derived:** a real emitter of hand-written OTLP-over-HTTP JSON, off by default, never callable from a
verify recipe, carrying the review-loop figures only. [`../cli/telemetry.mjs`](../cli/telemetry.mjs)
carries the ruling, the environment variables it reads and the ones it does not, and what the payload
may hold.

**The committed file is the only gate** — deliberately not `OTEL_SDK_DISABLED`, which defaults to `false`
and would make emission an opt-out. The environment supplies transport only, and the validator refuses a
config carrying `headers`, `endpoint` or a token, so a secret never enters a committed file.

**Consent is ruled, and railed.** The committed opt-in **is** the standing consent, and committing a
config that says `enabled: true` is Gated and the maintainer's alone. `--export` refuses a config that is
**untracked**, **tracked but absent from `HEAD`** — staged and never committed — or **differs from
`HEAD`**, so editing a working copy cannot manufacture consent. It is person-invoked only: CI runs this
module on every pull request but never `--export`, and wiring that mode into a workflow, hook or schedule
is a new consent question rather than a covered one. It neither queues nor retries.

**What it does NOT establish:**

- **Current data.** The payload is checked against the snapshot, never the snapshot against the world
  ([#356](https://github.com/sleepy-panda-srl/portulan/issues/356)). The capture stamp travels inside the
  payload, so a stale export arrives labelled stale — and time-series backends commonly drop aged samples.
- **Who committed the consent.** The rail establishes *tracked and byte-identical to `HEAD`*, not
  *committed by the maintainer*: `commit-to-a-working-branch` is `auto`, so an agent can commit it. What it
  buys is that the act appears in a reviewed diff.
- **The opt-in in the affirmative.** No workspace in this tree opts in, so every green is about the off
  path. The send is proven only in the suite, against an injected transport, and no yielded recipe may
  ever exercise `--export`.
- **A network mode reached indirectly.** The suite derives the set of network-capable modules from the
  tree, and the offline audit matches a module as a path suffix and a flag as a token; a mode reached
  through another script, or through a flag built at runtime, is invisible to it.
- **Scheduled emission.** Nothing fires when nobody runs it —
  [#344](https://github.com/sleepy-panda-srl/portulan/issues/344)'s silence again.
- **Enforcement of the review-loop bound.** An emitter with no backend reading it is not the checker
  [`a-review-loop-needs-a-bound.md`](../.portulan/memory/a-review-loop-needs-a-bound.md) lacks.
- **Traces.** Metrics only.

## The A/B baseline

| File | What it is |
|---|---|
| [`ab/corpus.md`](ab/corpus.md) | The scenarios and grading rules, the registered carrier of the clause's subject, and *What may not be concluded* |
| [`ab/arm.md`](ab/arm.md) | What *Portulan on* denotes here: the vendored-and-compiled treatment arm |
| [`ab/register.md`](ab/register.md) | Both arms as built, byte-compared by the `ab` recipe |
| [`ab/graders.md`](ab/graders.md) | The graders' discrimination, byte-compared by the `ab-grade` recipe |
| [`ab/baseline.json`](ab/baseline.json), [`ab/baseline.md`](ab/baseline.md) | The capture, and the register rendered from it — the one carrier of the figures |
| [`ab/warm.md`](ab/warm.md) | The warm-start A/B, a sibling of the baseline rather than a clause of row 8: it prices fresh sessions warm against cold from the host's own records, in the three lines every measurement reports, and says which host switch earns a place in `sessions`. Its runner, [`../cli/warm.mjs`](../cli/warm.mjs), is built, and its record waits on the maintainer's word, since every run starts real sessions |

[`../cli/ab.mjs`](../cli/ab.mjs) builds the arms, [`../cli/ab-grade.mjs`](../cli/ab-grade.mjs) grades the
trees they leave behind, and [`../cli/ab-run.mjs`](../cli/ab-run.mjs) runs the turns between: `k = 5` per
cell, ruled by the maintainer, every turn isolated with a home and config directory of its own. Each
module's `--write` regenerates its document; `ab-run --write` re-renders the register from the committed
capture. The recipes run no agent; the modes that do — `ab --stop-probe`, `ab-run --smoke` and
`--matrix` — are a person's to run.

**What may not be concluded** from the baseline is [`ab/corpus.md`](ab/corpus.md)'s section of that name,
and the register cites it rather than restating it. **The baseline is scoped to the vendored-and-compiled
tier** [`ab/arm.md`](ab/arm.md) specifies, and closes row 8 for no other configuration of *Portulan on*.

## A release carries an eval result

```
node cli/release-eval.mjs --capture     at a cut: run every yielded recipe, write the record pair
node cli/release-eval.mjs --verify      the recipe: every governed release has a record matching its capture
```

[`releases/`](releases/) holds one pair per version, described in
[`releases/README.md`](releases/README.md), for every version [`../CHANGELOG.md`](../CHANGELOG.md)
records from `0.1.3` onward — graded permanently and in both directions. A record is the verdict every
recipe the workspace yields returned at a named commit, plus the **identity** of the A/B baseline the
release ships against, never its figures.
**`evals/releases/` ships in the package**, by the maintainer's decision of 2026-09-01, so the package
carries both the record and the tool that checks it: `--tagged` grades a record in the unpacked package as
it does in the tagged tree. The recipe grades the tree on every commit;
[`../.github/workflows/publish-github-packages.yml`](../.github/workflows/publish-github-packages.yml) runs
`--tagged` against the tag's own checkout before publishing; the rest is Gated, and
[`../.portulan/gate-map.md`](../.portulan/gate-map.md) carries it beside its tier.

**What it does NOT establish.** Every register prints its own limits: a green means the record agrees with
its capture, never that the release is good; the recipes ran at a commit inside the cut change, not at the
tag; `release-eval`'s own row is excluded. Beyond the register lies the **published** half: `--tagged`
reaches the tagged tree at the publish, and the release body, written outside the tree, is reached by no
check. While every governed release has its record, the clause's central arm — a governed release with
none — is exercised only by the forced-red drill that moves the boundary.

## A rule change decided on eval evidence

Row 8's clause *a rule change merges or is rejected on eval evidence* is discharged by one instance, hole 8
of [`../.portulan/gate-map.md`](../.portulan/gate-map.md): a `gated` or `prohibited` path target that can
never match. [#337](https://github.com/sleepy-panda-srl/portulan/issues/337) set out three answers, the
instruments chose between them, and the change merged on 2026-09-09; the evidence table and the argument
are [`../docs/milestones/m08.md`](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/docs/milestones/m08.md)'s session-10 note. The rail is `neverMatches`
and the backend refusal beside `HOST_GATE_TIERS` in [`../cli/compile.mjs`](../cli/compile.mjs), a suite
block, and a second forced-red drill on `doctor`; its limit — the refusal is at compile time, not at the
hook — is stated beside the refusal. The hazard is held there and not in the gate corpus, whose
denominator is the yielded policy: adding a never-matching `gated` rule to `gates.json` to give the corpus
a case would manufacture the defect.

## What is NOT built yet

Each names where it arrives, per [`../.portulan/dod.md`](../.portulan/dod.md) condition 4 — nothing here
claims a capability that does not exist:

- **A release actually *published* with its eval result.** The mechanism is built and `0.1.3`'s record is
  in the tree; the tag and a release body citing its register are not. **Ruled 2026-09-01: it waits for a
  real cut.** `tag-a-release` and `publish-a-release` are Gated, so the clause stays undemonstrated until
  the maintainer takes them; [`../docs/milestones/m08.md`](https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/docs/milestones/m08.md) carries the argument.
- **The `evals` and `telemetry` Workspace Definition slots.** Proposal
  [`0034`](../.portulan/proposals/0034-one-spec-bump-carries-both-evals-and-telemetry.md), accepted
  2026-08-28, carries both in one spec bump. The deferral in [`../spec/slots.md`](../spec/slots.md) is due
  since the milestone-8 close and undrafted; the drafting settles the key names, each slot's structure and
  whether a migration is owed.

Each rail's open limits are in its section above, with the issue tracking each where there is one.
