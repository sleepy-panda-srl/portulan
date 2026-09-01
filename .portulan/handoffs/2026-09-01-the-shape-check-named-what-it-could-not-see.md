# 2026-09-01 — the shape check named what it could not see

**Milestone 8, triage on `cli/ab-run.mjs`.** No clause moves, no agent was run, no figure exists, and
`evals/ab/baseline.json` was neither edited nor re-captured. `evals/ab/baseline.md` is **byte-identical**
to what shipped on 2026-08-31 — the renderer changed and the document did not, which is the strongest
available evidence that the repair touched the check and not the record.

## What was wrong

`verifyShape()` said the derived shape check had **"exactly one"** blind spot — a boolean rendering as a
branch. Measured, it had more, and the *frame* was wrong before the count was:

- **`snap.agent ?? "<agent>"`** — a missing field rendered a placeholder that reads like a recorded
  condition, so the derived `undefined`/`NaN` probe saw a clean document.
- **`t.verdict ?? "could-not-attribute"`**, the worse of the two. A turn whose verdict the capture simply
  lacked was **published as `could-not-attribute`** — one of this module's three named states, asserted
  about a turn nothing had graded. Demonstrated end to end: delete the field, refold the cells, and
  `--verify` exits **0** over a register that names a verdict nobody recorded.
- **`turns[].completed`** — the same class, at a site the maintainer's note did not name. `0020` says a
  fix is scoped by its class, not by the site that found it.
- **`turns[].said`**, and an **emptied `invocation`** array. Neither is a boolean.

The same claim had been found false in a sibling module the same day, by a fresh-context checkpoint that
deleted every field the renderer reads, one at a time. That is the only way this class is ever found.

## The two rules, and the third thing that was needed

**(1) The renderer supplies no fallback**, so absence renders as a hole the probe refuses. Both `??`
sites are gone; `t.verdict` now branches strictly on `=== null`, which is `aggregate()`'s own definition
of could-not-attribute. **(2) Every field that renders as a BRANCH is checked by name**, because no hole
appears for those — only the meaning is invented.

Rule 2 puts field names back into the check, which is what this milestone spent five rounds removing. So
the list is not maintained, it is **audited against the renderer in both directions**: a name the probe
already covers fails as redundant, a branch-read leaf nobody named fails as short. **The audit found a
real escape on its first run** — `[].every()` is `true`, so an emptied `invocation` published a command
line carrying none of the flags the turns ran under, and my own check waved it through.

**Row homogeneity** is the third mechanism and it names no field: every turn carries the same key set as
every other, likewise cells, and `verdicts` within a scenario. It closes `nonce`, `timedOut`, `evidence`,
`invocation` and everything added later. **Its reach is stated rather than implied** — it catches a row
that diverges from its neighbours, *not* a column the producer stopped writing, and a case pins that.

## What is still not seen — four items, not a number

Written into **`verifyShape()`'s** docblock — not `BRANCH_READ`'s, which is a list of field names and a
different list: the three fields the committed capture predates (permitted absent, checked if present,
and `PERMITTED_ABSENT`'s docblock says which); a uniformly dropped column; a future branch on a field
neither swept artifact carries — the staleness moves from the check to the fixture rather than vanishing;
and **shape is not truth**, since `source.clean: true` over a dirty tree passes everything here.

**One of the three is not even silent-proof.** `agent` and `model` each print a limitation bullet, so the
register says in its own voice that neither is recorded; a missing `saidTruncated` says nothing at all
unless some `said` is long enough to fire the other bullet. The committed capture happens to sit exactly
on that boundary, which is luck rather than mechanism — and the off-by-one behind it is filed below.

## Three checkpoints, and what they cost

**Session-open ran three times: REQUEST-CHANGES, REQUEST-CHANGES, APPROVE-WITH-ADJUSTMENTS (14).** Two
mechanisms I had planned were **killed by the reviewer, not by me**:

- A **capture-format gate** (`portulan.abBaseline` `"1"`→`"2"`) — ruled a fourth action nobody granted,
  because it retroactively redefines a field of a committed published record, *and* it is downgradeable:
  the same hand-edit that deletes `agent` can write `"2"`→`"1"` and go green.
- **Rewording two limitation bullets** in the published register. Ruled out of scope at round 1; at round
  2 my stated ground for it was **refuted by the tree** on three measured paths.

Round 3 also caught the plan's audit oracle being *unsatisfiable as written* (27 measured leaves against
a declared 8) and supplied the predicate that makes it exact.

## What the pre-commit checkpoint found, and what it cost

**APPROVE-WITH-ADJUSTMENTS (6), and every one of the six was documentation outrunning the code** — the
exact class this diff exists to repair, inside the diff that repairs it. Three were the same
misattribution in three files: the recipe, the milestone and this handoff all pointed at `BRANCH_READ`
for a residue that lives in `verifyShape()`'s docblock, sending a reader to a frozen array of field names
to look for a four-item list that is not there. A fourth claimed *"their absence is not silent —
`limitationsFor()` prints a bullet for each"*, which is false for `saidTruncated` when every `said` is
short. A fifth had me excising one false sentence from `m08.md` while annotating the other in place, in
the file whose convention is dated ledgers rather than rewrites. A sixth had `verify/README.md`
advertising the enforcement with no mention of its limit.

**And it found the `[].every()` class one level up, which this module had just credited itself with
closing.** `for (const t of snap.turns)` over an empty array runs the by-name checks zero times, so
`turns: []` with the cells left intact was shape-valid — and `--write` published a register carrying
eight full figure rows above an empty per-turn table and *"a fresh home and config directory per turn
(0 of them)"*. Found by reading my own comment about the emptied `invocation` and asking where else the
same sentence was true. Closed, with `cells`, and with the substitution twin beside it: `turnTimeoutMs:
null` renders *"Per-turn timeout: 0s"* through `Math.round`, a plausible invented condition the sweep
cannot reach because it is a substitution rather than a deletion.

## Filed to the maintainer — NOT fixed here

1. **The capture-format gate**, with its measured downgrade hazard. It is the only mechanism that would
   close residue item 1, and it is the maintainer's ruling to make.
2. **`cli/ab-run.mjs` — a live off-by-one.** `runTurn()` marks truncation at `> 300`; `limitationsFor()`
   fires *"predates the marker"* at `>= 300`. The committed capture sits exactly on that boundary — four
   rows at 300, none above — so a future capture that records the marker and has a row at exactly 300
   would publish that it predates the marker while carrying it.
3. **`--write` runs `verifyShape()` and never `verify()`.** Demonstrated: a capture with a forged nonce
   and `operatorEnv: "host"` **publishes at exit 0** on the `--write` path, over a capture `--verify`
   would red three ways. The by-name checks were placed in `verifyShape()` for exactly this reason, but
   the asymmetry itself is untouched and is wider than this ask.
4. Nothing cross-checks `portulan.abBaseline` against `captured` or `source.commit`.
5. **A maintenance trap the audit itself sets, and it is coupled to item 2.** The committed capture's
   longest `said` is exactly 300 and the fixture masks the boundary. Repairing item 2's off-by-one makes
   `turns[].said` inert on *both* swept artifacts, so the two-way audit will fail it as **redundant** —
   and the remedy the audit's own rule suggests is to delete the name and its check, reopening a real
   blind spot. The fixture's docblock warns whoever takes item 2 to move the fixture's `said` across the
   boundary in the same commit. A checker that walks its next maintainer into a hole is worth writing
   down before it does.
6. **Present-but-empty strings publish blank conditions.** `source.commit`, `agentVersion`,
   `credentialChannel` and `rulings.k` set to `""` render empty conditions at exit 0 — the same
   substitution class as `turnTimeoutMs`, at four more sites. Guarding them is a wider sweep over what a
   condition *means* rather than what shape it has, and that is the maintainer's call rather than mine.

## Evidence

25 recipes green, run rather than printed. `cli/ab-run.test.mjs` 57 → **65**. `ab-run` forced red with
`--working-copy` and its tell — *"no baseline may be recorded under an unisolated arm"* — intact, which
matters because `verify()` returns `verifyShape()`'s findings first and returns early. Seam scan clean.
