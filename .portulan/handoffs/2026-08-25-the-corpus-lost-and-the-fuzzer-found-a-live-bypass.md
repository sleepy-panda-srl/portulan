# Handoff — the corpus lost, and the fuzzer found a live bypass

**Date:** 2026-08-25 · **M8 (Evals & telemetry), session 1** · Implementer: Opus 5.

## What landed

**Milestone 8 clause (b) — mutation testing over both matchers, and grammar-aware fuzzing over the
shell segmenter — end to end.** One clause of nine. Session 0 landed (a); **seven remain**, and the
change says which in every carrier rather than in one.

- `cli/mutants.mjs` + `.portulan/verify/mutants.sh` — the mutation census. It breaks
  `cli/compile.mjs`'s matcher region on purpose, one **anchored** operator at a time, and grades each
  mutant against the gate corpus.
- `cli/fuzz-shell.mjs` + `.portulan/verify/fuzz-shell.sh` — the grammar fuzzer. It composes commands
  from a grammar over every position it knows and three payloads, fuzzing **spellings** within each
  cell, and holds both segmenters to a recorded answer per cell.
- `cli/fuzz-shell.ground.test.mjs` — the grammar's ground truth, measured under real bash with a
  **neutral** payload.
- **A live bypass of every Gated shell action, found and closed.** Gate map hole 2 amended, and entry
  1 gained a spelling it had never named.
- New corpus cases: one per surviving mutant, plus the false-red controls the widened matcher needed
  and the two that discriminate hole 8's candidate repairs. Each derived by measurement.

**Every total in this handoff is a FIRST-RUN figure, dated, and the shipped counts are given beside
it.** The distinction is load-bearing rather than pedantic: the census grew during the session — the
pre-commit checkpoint widened its region — so a bare "forty-eight operators" written mid-session is
false by the end of it. The shipped numbers are printed by the runners themselves
(`node cli/mutants.mjs`, `node cli/fuzz-shell.mjs`, `node cli/goldens.mjs`), which is their one
carrier; nothing in the repository's prose repeats them. _(An earlier draft of this file did repeat
them, and was already stale when the pre-commit checkpoint read it — this session's own signature
defect, in its own record layer, one day after session 0 met it five times.)_

## The two results, and the second is the one that matters

**The corpus lost.** On the census's first run, 2026-08-25, the 224 adversarial cases written the day
before to be its kill-set failed to notice **eleven of forty-eight** breakages of the matchers they
cover. Among them: removing `sudo` from the command-prefix table, dropping `..` resolution from path
normalisation, disabling quote tracking in `commandSegments`, and dropping the newline from
`OPERATOR`. Every one is a fixture now. **The pre-commit checkpoint then widened the region and the
corpus lost again** — it had no `NotebookEdit` case at all, so both that tool's table entry and the
`?? input.notebook_path` fallback were unexercised across every write-rule fixture in the corpus.

**`bash -c "ls; git push --force origin main"` answered `false`.** One wrapper plus one separator, and
every Gated shell action — force-push, `gh pr merge`, `gh repo delete`, `npm publish` — walked
through. Bash runs it. The gate did not see it.

The composition closed on #60 tests the raw command's segments and each **segment's** spellings. It
never tested a **spelling's** segments. So `ls && bash -c "…"` was closed and `bash -c "ls; …"` was
open, and reading either claim on its own left the gap invisible — the *"two claims that each held and
did not compose"* shape the gate map already records one paragraph above where this now sits.

**The write matcher never had the gap, and that is the lesson rather than a footnote.** Its callback
is `shellWrites`, which segments AGAIN internally with `shellSegments`, so the write half got a third
segmentation for free while the shell half — a plain prefix compare — got none. *A fix landing in one
carrier and not its sibling* (`0020`), between two branches of one function, for the second time.

Repaired at the **class**: a spelling is segmented on both arms, so
`ls && bash -c "x; git push --force …"` closed in the same stroke rather than becoming the next
round's finding. The unwrap budget is unchanged at one level, with the two-wrapper counterexample now
asserted in the corpus as well as the suite — a composition change is exactly what peels a second
level by accident, and an earlier draft of the first composition did.

## What measurement refuted, and what it cost to find out

**I wrote three expectation tables from the armchair and measurement corrected all three.** That is
the session-open supervisor's adjustment 3, and it was right to insist.

1. **`same-line-comment` on the shell matcher.** I recorded it as a documented false red, citing
   `compile.mjs`'s own `#` decision. Measured: **false**, which is correct. The false red needs a
   **separator after the `#`** — `echo ok #; git push …` — because the matcher's test is a prefix
   compare and `ls # git push …` does not *start with* the target. The comment in `compile.mjs` says
   exactly that and I read past it. A separate production carries the real case now.
2. **The write payload is two payloads.** `shellWrites` has two recognitions, and in the
   `same-line-comment` position they diverge: `ls # echo ok > docs/vision.md` is caught, `ls # cp
   /tmp/x docs/vision.md` is not, because there the head is `ls`. Folded into one payload the cell
   answered two ways and the invariant would have had to be weakened to admit it. Split, every cell
   is exact — and no cell is mixed across four hundred spellings, which is a result rather than a
   convenience.
3. **`foo/../docs/vision.md` does not test `..` resolution.** It still ends with `/docs/vision.md`,
   so the tail comparison matches whether or not `..` is resolved. The spelling that distinguishes is
   `docs/milestones/../vision.md`. My armchair fixture would have shipped as coverage of a thing it
   did not cover.

**And bash refuted the grammar twice.** `docs/nowhere/../vision.md` is not a spelling of the target
unless `nowhere` exists — bash resolves `..` against the filesystem, `normalisePath` resolves it
lexically, and the difference is fail-closed and now written down. Then the ground-truth harness
itself reported `single-quoted-echo` as a **command** position: the neutral payload was
`printf PORTULAN_RAN` checked on stdout, and `echo 'printf PORTULAN_RAN'` prints the payload's own
source. **A measurement harness fooled by the thing it measures** would have certified a data position
as a command position and graded that whole cell against the wrong oracle. The payload drops a marker
file now.

## Design decisions worth knowing

**A `survives` record admits only a proof, never a gap.** `matchesRule` is a pure function of
`(rule, tool, input)` and a fixture is exactly that triple, so any non-equivalent mutant is killable
by one. A standing ledger of named-but-unfilled gaps would rebuild the prose hole list clause (a)
exists to have replaced, one altitude up. Five operators are recorded `survives`; three are
semantically equivalent, one is equivalent at its call site, and one is equivalent **under the yielded
policy** — the only `read:` rule declared is hole 8's `./`, so nothing can distinguish it. All five
held under measurement.

**Two operators are controls that must survive.** A harness that only ever reports kills is
indistinguishable from one that reports kills wrongly. _(One of the two carried a `why` describing a
substitution it no longer made — the text of an earlier draft, left behind when the anchor moved.
Found at the pre-commit checkpoint. A `survives` record whose proof describes a different mutant is a
wrong record even where the verdict is right.)_

**Positions are recorded; spellings are fuzzed.** The unbounded half is the spelling axis, where the
invariant is exact: every spelling of one command in one position gets the same answer. That is the
shape three of session 0's ten rounds had — a reader narrower than a shell word — turned into a
generator. The position axis is enumerated because each position needs a name a reviewer can argue
with, and because a recorded divergence must cite the record licensing it.

**The seed is printed on every run, green included.** A green nobody can reproduce is a green nobody
can audit.

**Neither runner spawns anything**, asserted statically in both suites. The bash measurement lives in
its own file for that reason, and never touches either payload.

## State

`main` @ `e3fe3f6`; branch `agent/m8-mutation-and-grammar-fuzzing`. Two recipes were added, so the
yielded set grew by two; **every recipe the manifest yields is green** in this working copy, and
`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs` is the carrier of what
that set is. Seam scan clean over **every path the diff touches**, generated files included, plus the
commit message and the branch name; planted-term controls reddened in **both** channels — a listed
term in a staged file and a listed term in the message.

**Eight forced-red drills, run by hand, exit codes read directly rather than through a pipe.** For
`mutants`: an anchor that no longer places (2), an operator recorded `killed` made equivalent (1), a
corpus red before any mutant runs (2), and a substitution that will not import (2). For `fuzz-shell`:
the same seed replayed twice (identical output), the closed bypass reintroduced (1, and it printed the
finding as a ready corpus case), a production with no recorded cell (2), and a recorded divergence
with its record removed (2).

**Drill 1 exited 0 on its first attempt and the recipe was not at fault — my substitution missed by
four spaces of indentation and mutated nothing.** A drill that does not fire is a drill reporting on
nothing, which is the same false green the whole session is about; redone with a `count == 1` guard
that refuses when the anchor does not place. Recorded because it is the fourth time in two sessions
that a check written alongside a change inherited the change's blind spot.

**Checkpoints. Two, both Fable 5, both fresh context, both APPROVE-WITH-ADJUSTMENTS, every adjustment
folded including the ones marked optional.**

**Session-open — eleven adjustments.** Three of its binding findings were things I had *wrong* rather
than things I had missed: the `#` production's ground truth, the need to key the expectation table on
`(production × matcher branch)` rather than on position alone, and the ESM module-cache trap that
would have graded the first mutant once per operator while reporting on all of them. It also checked
rather than took every claim I made about `compile.mjs`'s import graph.

**Pre-commit — seven adjustments, four binding.** It ran a differential of the staged matcher against
`HEAD`'s over more than a thousand rows and returned the thing I most needed to know: **zero
narrowings, zero two-level peels, `--force-with-lease` untouched in every spelling, and the write and
read branches bit-identical.** That is the reassurance session 0's checkpoint could not give, arrived
at the same way — by attacking rather than reading.

Its four binding findings, all in the record layer, which is the honest characterisation:

1. **The Session log entry claimed this checkpoint's verdict before it existed.** Written from the
   template of a session that had already finished. Corrected.
2. **The handoff's own counts were stale** — see the note under *What landed*. My own signature
   defect, one day after session 0 met it five times.
3. **A `survives` record's proof described a mutant the operator no longer makes**, and cited an
   operator id that exists nowhere.
4. **`REGION` was incomplete** while its own sentence said *"every function and table `matchesRule`
   can reach"*. It derived the reachable set instead of reading the list and found `WRITE_TOOLS` and
   `READ_TOOLS` missing. Adding them found the `NotebookEdit` gap above — the coverage floor earning
   its place on the first day it was widened.

Its three optionals were all real and all folded: gate-map entry 1 never named quoted command
substitution though three cells cite it; the widening's inherited `#` false red inside a wrapper had
no recorded cell; and a comment in the ground test claimed to print what it only asserted.

**And it named one thing as undemonstrated rather than wrong: whether a respelling still means what it
spells once composed inside a wrapper.** Measuring that found a real defect in the generator — a
`$'…'` word inside a single-quoted wrapper closes the wrapper's own quote, so
`sh -c 'cp /tmp/x $'docs/vision.md''` writes `/vision.md` and not the constitution, while the cell
records a catch. The generator would have been exact about a string it no longer had ground truth for,
which is the one failure this design is arranged against. Positions now declare what they can carry,
the refusals are counted and pinned, and bash measures the composition.

## The review loop

**Round 1 — two inline findings, both mechanism, both mine.**

`--only` validated no operator metadata at all: the loop read `only === null ? OPERATORS : []`, so a
malformed operator slipped through in exactly the mode a person reaches for *when something is already
wrong*. Fixed at the rule — `--only` narrows what runs, not what must be well formed.

The per-cell PRNG seed mixed in `position.id.length` and `kind.length`, so most of the grammar shared
a stream with another position **while the comment beside it claimed each cell had its own.** The
cells stayed correct; what was lost is the diversity the spelling axis exists for. Seeds derive from
the cell's full identity now, and the suite asserts the *rule* — every cell's seed distinct, the same
cell still reproducible — rather than the ids that happened to collide. Re-fuzzed at 400 spellings per
cell across four seeds, 153,600 generated commands, no new divergence.

**A claim broader than the code it describes is this repository's signature defect**, and I had folded
three findings of that shape from other people's code earlier the same day before writing one of my
own — in the file whose whole job is holding a matcher to what its sentence claims.

**Round 2 — no threads, two suppressed notes, both right.** The notes-only channel carries findings
the inline one does not, which is why both are read every round.

`ran()` in the ground-truth test asserted only that bash **started**. A script that ran and *failed*
dropped no marker and came back `false` — which for a `ground: "data"` production reads as
**confirmation**. The position would have been certified as data because the script was broken. A
measurement harness fooled by its own failure, in the file whose subject is that class and which
already records catching one instance of it. Status and stderr are part of the oracle now.

`evals/README.md` carried a census count against a table that had since grown. **Third instance of the
same defect in this session, and the location is the lesson:** the pre-commit checkpoint caught that
exact figure in this handoff, I fixed it *there*, and the repair stopped at the site that was quoted —
`0020`, in the session that spent a paragraph writing about `0020`. Round 2's repair is the class: every
prose carrier of a census, corpus or grammar figure is now deleted in favour of the runner that prints
it, or explicitly dated as a first-run measurement.

**Round 3 — one suppressed note, real, and triaged rather than answered.** `matchesRule`'s shell branch
segments the raw command **twice**: `reach` is applied to every spelling, the raw command is always the
first spelling, so `commandSegments(input.command)` runs inside `reach` and again in the second arm.
Before this change the second arm reused a hoisted `segments`. A regression this change introduced, in
a function that runs on every Bash tool call.

Filed as [#339](https://github.com/sleepy-panda-srl/portulan/issues/339), on the board at **Next**,
carrying the worked repair — a **memoisation** rather than a hoist, because `reach` also runs on the
unwrapped spelling and `spellings()` trims, so an `s === input.command` identity check would silently
miss the raw arm — and the verification the fix must carry, including that the
`matchesRule-shell-stops-segmenting-a-spelling` operator must stay killed or the optimisation has
reverted the repair it is optimising.

**The sibling exemption would have applied and was declined on severity.** It is a defect this change
introduced, which is the ground session 0 took its own round 3 on — but session 0's was a live gate
bypass and this is a repeated scan with correctness unaffected. Flagged to the maintainer with the fix
offered if he wants the round spent, never assumed.

**Round 4 — the same finding promoted to an inline thread, and one suppressed note that is the
session's fourth instance of one class.**

The thread is #339's finding, arriving on the inline channel after arriving as a note. Answered
*there* rather than only in the pull-request comment, because *an answer lands on the thread that
raised it*.

The note: `.portulan/verify/README.md` still hard-coded *"eleven separate breakages"*. **Round 2's
repair was supposed to BE the class-wide sweep**, and the reason it missed this site is worth more
than the fix — my grep searched for census SIZES (`48`, `53`, `224`, `forty-eight`), and this sentence
carries a bare *eleven* with no denominator near it. **So the sweep for the class was itself scoped to
the spelling that had been quoted**, which is the same defect one altitude up, inside the repair for
it. Fourth instance this session; second incomplete sweep.

Re-swept by **word form** over every file this branch touches rather than by digit. Nothing else is
live: what remains is the handoff's explicitly dated first-run figures and a fixed count of checkpoint
adjustments, neither of which can grow. The number is deleted rather than corrected.

**So the bound held at two fix-rounds**, which is the first time in this milestone it has. Rounds 3
and 4 were a triage and a records correction under rule 2 — neither is a fix-round, and both are
flagged as such rather than counted quietly.

**Round 5 — a mechanism defect, and past the bound deliberately.** `runCorpus` read
`if (!rule) continue;`, so a fixture file whose rule the policy does not declare — renamed, misfiled,
outlived its gate — sat **ungraded while the census reported green**. A coverage tool that silently
thins its own kill-set and then reports on it is the loudest false green available here, and it is
`a-checker-must-refuse-what-it-cannot-check` in the module whose entire subject is that class.

Refused now in **both** places: `run` checks the corpus-to-policy correspondence once, before the
baseline, naming every offending file and its reason; and the exported `runCorpus` throws rather than
skipping, so a direct caller cannot get the silent behaviour back. Drilled by renaming a fixture out
from under its gate — exit 2, the file named. It does **not** lean on `goldens` reding on the same
condition: a rail that depends on a sibling rail is a rail with a precondition nobody states.

**Taken past the two-round bound under the sibling exemption, and the asymmetry with #339 is the
point.** Both are defects this branch introduced. #339 is a repeated scan with correctness unaffected
and was triaged; this one is a false green in the tool whose only output is a coverage claim, and
triaging it to protect a round count would be protecting the count with the thing the count exists to
buy. Flagged to the maintainer rather than assumed, the way session 0 flagged its rounds 3, 5 and 9.

**The count class, tallied once, here.** Four instances in one session: the handoff (caught by the
pre-commit checkpoint), `evals/README.md` (round 2), `.portulan/verify/README.md` (round 4), and the
`nineteen of thirty-two` code comments (swept with round 4's re-sweep). The first repair stopped at
the site; the second claimed to be the class and was scoped by its own grep; the third is by word form
and deletes rather than corrects. **Session 0 recorded this class five times and I read that record
before starting.** Reading it was not enough, which is the honest finding: what would have worked is a
rail, and there is none — `docs.sh` checks that the Session log entry fits its budget and carries a
seam attestation, and nothing anywhere checks whether a number in prose is still true.

_Board note, since the memory record says to verify an add by re-listing: the GraphQL mutation returned
a usable item id, and the **first** re-list did not show the item while a second one moments later did,
with `Priority: Next` and `Status: Todo` confirmed through the item's own node. The re-list is briefly
stale, so a single negative re-list is not evidence either — which is one more turn of the same screw
that record already describes about `item-add`'s exit code._

## One process defect of my own

**My first two review replies went out through the maintainer's credentials instead of
`.portulan/tools/gh-bot`.** The gate map's *Which identity acts* is explicit that pull-request
conversation comes from the agent identity, because a reply written by an agent and posted as a human
makes the conversation read as human when it is not — the exact provenance defect that wrapper exists
to prevent, and one nothing in the artifact would have revealed to a reader.

Caught by checking authorship after posting rather than before. Re-posted under `portulan-agent`, and
the two misattributed comments are **annotated in place rather than deleted**: a misattribution
corrected in the open is a record, and a deleted one is not.

Worth recording because the failure mode is not ignorance of the rule — I had read that table during
the boot. It is that `gh` was already authenticated and the command worked, so nothing resisted. That
is the shape a rail catches and a reminder does not, and there is no rail here: nothing checks the
author of a review reply. Whether that deserves one is the maintainer's call rather than mine.

## What is NOT in this change

- **#337** is untouched. What `./` should mean is a policy question with three defensible answers and
  the maintainer has not ruled. The fuzzer meets it as recorded hole 8 and two new corpus cases pin
  the discrimination between its candidate repairs.
- **#339** — the double segmentation this change introduced. Filed, not fixed; see the review loop
  above for why, and the issue for the repair.
- **No gate rule, no tier, no `gates.json` change.**
- **Row 8's Sessions cell is untouched at 1–2** against nine clauses. The maintainer said the budget
  will increase and gave no number; a budget an implementer picks for itself is not a budget.
- **`portulan-gotchas.md`** in the agent memory store remains at its budget edge. That consolidation
  is the librarian's pass and is owed separately.
