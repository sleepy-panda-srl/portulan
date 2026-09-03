# 2026-09-03 — A rule change decided by the instruments, and two of my own claims falsified

Milestone 8, session 10 — the number is the maintainer's. Row 8's last outright clause, *a rule change
merges or is rejected on eval evidence*, lands. The row does **not** close: the release clause stays
half-vouched until `0.1.3` is cut, which is Gated and his, and which his 2026-09-01 ruling fixes as the
milestone's last act.

## The session began on the wrong row, and being told so twice is the record

It opened against **row 9** and a fresh-context session-open returned **REQUEST-CHANGES** — correctly, on
two independent grounds: the criterion reads two ways and is the maintainer's to disambiguate, and two of
the plan's three proposed checks were **already railed** by `doctor` since milestone 4. I had asserted
*"nothing in this tree ties the two together"* about the floor's required contexts; `cli/doctor.mjs`
reads every `floor.checks[].context` against `.github/workflows/` and **fails** when no job reports one.
I verified that against the tree before accepting it, which is the only reason it is stated here as a
fact rather than as a supervisor's opinion.

He then corrected the brief to milestone 8, and **ruled row 9's first clause while the question was
open** — recorded in `m08.md` for whoever opens that row: *"Headless PR-as-gate recipe"* means **a
demonstrated headless path**, not an offline verify recipe.

## What the clause actually needed

The clause is **instance-shaped**, like *a release carries an eval result*, and `evals/README.md` had the
honest sentence in the negative: **every rule in `.portulan/memory/` had been merged on review alone.**
So no amount of new instrument discharges it. It needs a decision the instruments made.

#337 is that decision, and its provenance is the point: the gate corpus **found the defect on its own
first run** (#336), by attacking the matcher rather than reading it, and the issue then set out three
defensible answers and presumed none.

## The table, and the two things it did not say

| candidate | `compile` | `goldens` | `mutants` | `doctor` | `tests` |
|---|---|---|---|---|---|
| baseline | 0 | 0 | 0 | 0 | 0 |
| 1 — refuse at `parse`, every tier | **2** | **2** | **2** | **1** | **1** |
| 2 — make `./` match the tree | 0 | **1** | **2** | 0 | **1** |
| 3 — refuse in the backend that enforces | 0 | 0 | 0 | 0 | 0 |
| **the hazard**, on a clean `main` clone | 1 | 0 | 0 | **0** | 1 |
| **the hazard**, on this tree | **2** | 0 | 0 | **1** | 1 |

Every cell is a verify recipe's exit; `compile` is `compile --check`, and the `main` row is a detached
clean checkout rather than this tree with a file swapped.

Option 1 is **rejected on the measurement**: this workspace's own two `./` rules are correct at `auto`,
and refusing the shape at the door makes three instruments could-not-run.

**Option 2's reds are not a rejection, and calling them one would have been this session's own defect.**
`goldens` reds whenever a documented hole moves — *including when it closes* — and `mutants` already
records that exact edit as `killed`, noting *"CLOSES hole 8 … the good-news direction the corpus exists
to catch."* Its `mutants` 2 and its eight `tests` failures are that one fact twice more, not three
objections: the census refuses to run over a reddened corpus, and the failing cases are the ones that
**pin** that census and that corpus. Option 2 is declined on **authority**: it decides what `./` should
mean, which #337 reserves.

**The merge half rests on the last two rows, not the candidate rows** — option 3 and *doing nothing* are
identical across the first four. The discriminating cell is `doctor`: **0 on `main`**, where the hollow
gate is counted among *11 of 25 rule(s) compiled* and nothing in the tree disagrees, and **1 here**.
`tests` is 1 on both sides for unrelated reasons and discriminates nothing.

**And an earlier draft had a rejection branch that was a rejection for finding nothing** — *if the hazard
does not reproduce, the clause is discharged by a rejection*. It cannot: eleven `documented-hole` cases
re-run that measurement on every commit. Deleted at the second session-open.

## Claims of mine were falsified at every checkpoint

**"A permission rule covering the tree."** Re-derived: a real target compiles to a `**` glob and `./`
does not — the emitted spec is the bare `Edit(./)`, and what a host makes of it this repository installs
nothing to measure. The offline-derivable hazard is narrower and better: the compiler reports the rule
**compiled** while the matcher answers false for every input.

**"The `./` spelling."** The class is a **comparison**, not a list: `matchesPath` compares a tail and a
host is *expected* to submit a normalised path — an assumption, named as one, and one the refusal does
not rest on — so any target whose comparison form is not already normalised matches nothing.
Three families — reducing to nothing (`./` `.` `./.` `././` `.//`, one of which, `././`, compiles to a
real subtree glob `Edit(././**)`); an interior `.` or empty segment (`docs/./vision.md`,
`docs//vision.md`, `docs//`, `docs/.`, `./docs/./`, `docs/vision.md/.`), which reads like a real path and
is so worse; and **a backslash** (`docs\\vision.md`, `docs\\`), which the matcher can never reach because
it normalises the *candidate*'s backslashes and never the target's — the only one of the three with no
conditional reading at all.

**And I got the class wrong three times of four cuts, in the same direction every time.** The first cut of the predicate
lifted `matchesPath`'s own strip and caught two of the first family's five; the third session-open found
that. The second cut asked whether the target normalised to **empty**, caught that family and missed the
other six; the second pre-commit found that, by probing neighbouring spellings rather than re-reading the
sentence — and by then three carriers of the prose were claiming the class the predicate did not cover.
The third cut — the interior family — was itself incomplete, and a fold grade found the backslashes one
round later, the same way. **Each time the checkpoint offered narrowing the prose as an equally honest
repair, and each time widening was taken**: a class defined by the examples it was written for is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md), and narrowing would have
shipped a rail whose own documentation described a hole beside it. **Three forced reds now hold it** —
disabling the refusal reds six suite cases, narrowing the predicate to normalise-to-empty reds five, and
dropping the backslash arm alone reds four. _(6/4/3 until the equivalence assertion landed; it fires
under the second and third too, and the figures are re-measured rather than carried.)_

**The lesson is not "be more careful", it is where the misses were found.** Not one of the three came
from re-reading the sentence. Every one came from putting the neighbouring spellings through the
function, which is [`0022`](../proposals/0022-a-claim-about-a-mechanism-is-re-derived-like-a-figure.md)
working as designed and is cheap enough that it should have been the first move rather than the fourth.

## What shipped

`neverMatches` exported from `cli/compile.mjs`, derived from `normalisePath`; a `CompileError` in the
Claude Code backend beside `HOST_GATE_TIERS`, never at `parse`, whose docblock forbids a tier partition
there; a suite block of **twelve cases** — red in **six** when the refusal is disabled, **five** when the predicate is narrowed to normalise-to-empty, **four** when only the backslash arm is dropped, all re-measured after the last fold; a **second drill on
the `doctor` rail** — `doctor` and not `compile`, because a `CompileError` exits 2 and `drills.check()`
refuses `exit: 2` because it *"would read a refusal as a verdict"*; and one minted rule,
`a-target-is-validated-at-the-tier-that-enforces-it`, whose provenance is the **corpus run** rather
than a review or an incident write-up. _(An earlier draft called it "the first here of which that is
true" — a superlative nobody counted, which is the class this repository names most often. Counted, over
the 31 records: **ten** cite a pull request and **fifteen** cite a handoff — fourteen by relative link and
one through a GitHub blob URL, which is why an earlier count here said fourteen. So the link form is not
what is new, and **nor is an instrument being the incident**: `a-mandate-nothing-checks-is-already-broken`
was minted from `doctor`'s first run against this workspace, and `a-checkers-coverage-is-measured-not-named`
from two validator runs. What is new is narrower, and is the clause's own subject — the instrument did not
only find the defect, it **chose between the drafted answers**. This sentence went through three drafts
before it said something true, which is itself the argument for counting.)_

`matchesPath` is **byte-untouched**, deliberately: its answers are asserted by eleven `documented-hole`
cases and by `mutants` operators anchored on its text, and moving its strip would have moved two anchors
and exited the census 2 — a could-not-run wearing a pass's clothes.

## The graded trees, recorded because 0035 needs them

[`0035`](../proposals/0035-the-fold-is-graded-or-it-is-not-supervised.md) asks that the **fold** be graded
and not only the diff, which means a later reader has to be able to say *which tree was graded*. Nothing
in this repository records that today, and the fold grade for this change recovered it from **loose git
objects still carrying their timestamps** — a method that works until somebody runs `git gc`. So it is
written down here instead:

- **Pre-commit pass 1** graded the staged tree whose root was `e8dd54a6`.
- **The 0035 fold grade** took `76237b4a` — that tree plus the fifteen folds — and returned
  REQUEST-CHANGES with twelve findings, three of them cells the fold had predicted rather than run.
- **Pre-commit pass 2** graded `bfeac0ad`, and returned APPROVE-WITH-ADJUSTMENTS with four binding
  findings — chief among them that the predicate covered the normalise-to-empty subset while three
  carriers of its prose claimed the class. That is the widening recorded above.
- **The second 0035 fold grade** took `dd6fb5c1` — pass 2's seven folded — and returned
  APPROVE-WITH-ADJUSTMENTS, finding the backslash family and a pin test that pinned nothing.
- **The third** took `a4781a90`, and found that the pin case still did not call the predicate.
- **The fourth** took `b0948ad5`, and found four measured figures this fold had moved without
  re-measuring them — including the two above.
- **The commit** carries that last fold. Its own hash is not written here: a file naming the tree it is
  part of changes that tree, which is why the four above are recorded and this one is the commit.

Naming them is the cheap half of a rule this repository has not written yet; the expensive half — a rail
that refuses a commit whose graded hash nobody recorded — is not built and is not claimed.

## Residue, owed, and what a close should ask

- **The hook still loads such a rule and steps aside.** `cli/gate.mjs` reads through `parse`. The refusal
  is at compile time. Recorded in entry 8 rather than repaired, because repairing it means inventing
  runtime blocking this session was not scoped for.
- **What `./` should MEAN as a policy target is still nobody's ruling** — option 3 exists to leave it
  open, and entry 8 therefore stays, with every case still expecting FALSE.
- **#337's disposition is his**, with option 3 merged; the issue's reserved question outlives it.
- **`rule-carriers` registration is not owed, and the arrears are named rather than left to be found.**
  [`0027`](../proposals/0027-a-reduced-rule-stays-reduced.md) scopes registration to a rule an incident
  **reduced** to one carrier; this change reduced nothing, so nothing is owed and the recipe is green.
  What is true anyway, counted rather than estimated: the spellings are enumerated in **five** files, counted:
  `cli/compile.test.mjs` (thirteen, and the only one that MEASURES them — the others enumerate for a
  reader), `.portulan/gate-map.md` (thirteen), this handoff (thirteen), and `CHANGELOG.md` and
  `docs/milestones/m08.md` (twelve each, the bare `docs\\` omitted as redundant beside
  `docs\\vision.md`). `cli/compile.mjs`'s docblock enumerated them until the last fold and now cites the
  suite, which is the direction the rest should go and is the whole of what was repaired here. _(This
  bullet has now been wrong three times: "eight or more", then "six", then "four". A carrier count inside
  a bullet about carrier counts, wrong at every attempt until somebody ran a grep for the sentinel
  spelling instead of counting from memory.)_ _(A first draft of this bullet said "eight or more" and listed
  nine, three of which — the refusal string, the drill, `evals/README.md` — enumerate none of the set; the refusal string does not even contain a literal `./`, printing one only through the interpolated target. A
  carrier count, wrong, in a bullet about carrier counts. Corrected on a grep.)_ One of the six had already
  drifted before the diff was committed, saying *committed* where the mechanism is *compiled*. Caught at
  the pre-commit checkpoint. That is the arrears: not a rule to register today, but a fact with more carriers than it
  can keep in step, and the next session that touches it should reduce before it adds.
- **The row's close is next, and its first question is 6d's altitude predicate**, unchanged by this
  session. Then `0.1.3`.
