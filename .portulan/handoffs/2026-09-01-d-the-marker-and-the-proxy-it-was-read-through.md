# 2026-09-01 — the marker, and the proxy it was read through

**Milestone 8, triage on `cli/ab-run.mjs`.** [#388](https://github.com/sleepy-panda-srl/portulan/issues/388)
and [#389](https://github.com/sleepy-panda-srl/portulan/issues/389), filed to move together. No clause
moves, no agent was run, `evals/ab/baseline.json` was neither edited nor re-captured, and
`evals/ab/baseline.md` is **byte-identical** — `git diff origin/main -- evals/` is empty.

## #388 was not an off-by-one, and its own named fix is a REGRESSION

The issue said `runTurn()` marks at `> 300` while `limitationsFor()` fires *"predates the marker"* at
`>= 300`, and named the repair: *"Align the two comparisons."*

**Measured, that repair deletes a TRUE limitation from the committed register and reds `ab-run.sh`.**
The committed capture's four rows sit at exactly 300 and end mid-word — `observed-content/a/4` ends
*"…which I refused as a lik"* — so they are genuinely the ones the pre-marker cutter cut, and the bullet
about them is true. Aligning the comparisons drops it. The tree had already objected: an existing case
went red under it, and nobody had run it.

**The two `300`s are different constants that happen to be equal.** `runTurn()`'s is today's cap and may
move; the limitation's is the **pre-marker cutter's** cap and is frozen forever, because exactly one
pre-marker capture exists and it cannot be re-taken. Setting both to 500 reds the recipe. That is now
written at the site, so the next reader does not "tidy" them into one constant, get a drift, and repair
it by re-rendering the record.

**The actual defect is a limitation asserted through a PROXY.** The branch asks *does this capture
predate the marker* and answered by measuring a string length. The proxy held for the one capture that
existed and broke for the first capture that would record the field: a modern capture marking every turn
and holding one row at exactly 300 published that it predated a marker it carried. The vintage question
is asked directly now — *does any turn record `saidTruncated`* — and the length survives only as
**evidence that a pre-marker capture's rows were cut**, which is all it was ever fit for.

`limitationsFor()`'s docblock already carried this lesson from the `model` bullet; this is the second and
sharper instance, and it is recorded there: **a limitation must be keyed to the fact it claims, not to a
correlate that happens to agree today.**

## #389's trap was real, and it was conditional on taking the wrong repair

#389 predicted that repairing #388 would make `turns[].said` inert on both swept artifacts, so the
two-way audit would fail it as **redundant** and invite deleting a real check.

**Both arms measured.** Under the naive repair the trap fires exactly as filed — the audit reds with
`turns[].said` missing from the measured set. Under the repair that was taken, `said` stays branch-read
and **nothing needed moving**: the fixture instruction #389 gave (*"move `recordingFixture()`'s `said`
across the boundary in the same commit"*) was unnecessary. So the answer to #389 was **choosing the
right repair for #388**, which is exactly why they could not be done separately.

## What remained after that, and was not left as a comment

Under the guarded repair `said` is branch-read on **exactly one artifact — `evals/ab/baseline.json`**,
the only pre-marker capture in the tree. Replace it with a modern capture and the trap fires after all,
merely deferred. So `preMarkerFixture()` joins the sweep, **and a rail was put on it**: every
`BRANCH_READ` field must be measurable from the fixtures alone, so no name depends on a file that can be
replaced. Dropping the fixture from `ARTIFACTS` reds that case — which is what makes it insurance rather
than a comment, and this session has now argued twice that a rail nothing can run is not one.

## Two checks the marker earned

**A marked row must carry the marker.** The bullet claims rows *"are marked `…` where they are"*, so a
turn with `saidTruncated: true` whose `said` lacks it publishes a false claim. A substitution, so the
deletion sweep cannot reach it; checked by value beside `verdict` and `invocation`.

**And the marker is an IN-BAND WITNESS, which narrows residue 1.** That residue said the three
permitted-absent fields could be separated from a deletion only by a declared capture format. Too strong
for `saidTruncated`: rows ending in the marker while no turn records the field describe a capture that
HAD the field and lost it. `agent` and `model` have no such witness and still need the maintainer's
ruling ([#390](https://github.com/sleepy-panda-srl/portulan/issues/390)); the residue says so now.

`TRUNCATION_MARKER` is named — it had three bare carriers for one character three sites must agree on.

## What the session-open checkpoint changed — APPROVE-WITH-ADJUSTMENTS (12)

It measured the naive repair and found it a regression rather than an alternative, which turned the
plan's "#388's framing is slightly wrong" into the sharper claim above. It ruled that the two `300`s must
never be shared and asked for that at the site. It found the residual I had missed — `said` branch-read
on one replaceable file — and refused *"#389 is answered"* as an over-claim, since #389 also hands the
maintainer a general question. It caught four sentences the repair falsifies, including
`recordingFixture()`'s docblock, which was **#389's own carrier of a warning that this commit makes
false**. And it asked me to evidence *"genuinely the ones `runTurn` cut"* rather than assert it, in a
change whose subject is assertions.

## Copilot round 1 — five comments, four findings, all accepted

**The sharpest was one the pre-commit checkpoint had NOTED and not claimed.** Its observations section
said the converse of the marked-row check was unguarded — a row whose `said` ends in the marker while
its own `saidTruncated` says `false` — and left it as "not claimed as covered, so not a defect in the
claim". Copilot promoted it to a finding, correctly: the column-level witness stays silent because the
column is present, and the marked-row check runs only when the flag is `true`, so a row contradicting
itself passed everything. **The pair is total now** — flag true needs the marker, marker needs the flag
true — and that is the difference between a limit that is stated and a limit that is closed.

`"saidTruncated" in t` **threw on a `null` turn**, and the renderer's guard caught it and reported
*cannot be rendered* — an exception standing in for a shape finding, which is the class this file has
spent three sessions repairing. And `TRUNCATION_MARKER`, introduced in this very commit to hold the
marker's sites together, was **not used by the register prose that describes it** — flagged twice in one
round, which is what a constant introduced and then not adopted looks like.

**One rail I wrote for that was the wrong instrument and I replaced it.** It scanned the source for a
bare `…` — and the character is also ordinary prose elision, so it flagged nine comments about
`--agent ""` and `k: 4 …` that have nothing to do with truncation. A checker that cannot tell its
subject from a lookalike measures itself, which is [[portulan-checker-design]]'s first class. What is
checkable at runtime is that the rendered bullet carries the constant; that the four sites move together
is shown by **mutation** — changing the constant reds eight cases — and the case says so rather than
implying a rail exists.

## Left to the maintainer

**#389's general question is NOT closed by this commit:** *a check whose necessity depends on a known
defect is not a check*. Here the dependency was removed by taking a different repair, and the
`BRANCH_READ` audit could in principle be satisfied-and-wrong the same way again. Whether that deserves
a rule is his call, and it is **re-filed as [#399](https://github.com/sleepy-panda-srl/portulan/issues/399)**
— with three candidate shapes and a lean, none of them mine to pick — rather than buried in a closure
comment that #389's own closure would bury with it.

## Evidence

26 recipes green, run rather than printed. `cli/ab-run.test.mjs` 82 → **89**, three red before the repair and
three added for Copilot's round. Three mutations caught: dropping the pre-marker artifact, the naive #388 fix (5 cases **and**
`ab-run.sh`), and unguarding the vintage branch. Drill forced red with `--working-copy`, tell intact.
Seam scan clean.
