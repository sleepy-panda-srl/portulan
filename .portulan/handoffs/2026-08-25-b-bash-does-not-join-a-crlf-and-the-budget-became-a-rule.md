# Handoff — bash does not join a CRLF, and the session budget stopped being a number

**Date:** 2026-08-25 · **M8 (Evals & telemetry), session 1, follow-up** · Implementer: Opus 5.

## What landed

Three things, all on the maintainer's instruction of 2026-08-25 — *merge #338, address every
supervisor adjustment including the optional ones retroactively, and set row 8's Sessions cell to one
session per clause*.

1. **[#338](https://github.com/sleepy-panda-srl/portulan/pull/338) merged** as `43abab9`. Clause (b)
   is in `main`. Every review thread was resolved first, which is the merge gate rather than a
   courtesy — and resolution travelled **with** his merge approval rather than ahead of it, per the
   gate map's *Resolving a review thread* row.
2. **Session-open adjustment 4, finished.** It was the one adjustment I had discharged only in part.
3. **Row 8's Sessions cell reads `1 per clause`**, with the argument in
   [`m08.md`](../../docs/milestones/m08.md).

## The adjustment I had only half-discharged

Session-open binding 4 asked for a spelling axis composed with the position axis and named four
groups. I shipped two of them — quoting forms, and target-path spellings — and reported the whole
adjustment folded. **Two groups were missing**, and both are named in the milestone's own amendment as
bypasses #60 shipped with:

- **an escaped space, and an escaped quote inside a double-quoted span** — the class #336 met three
  times, each time fixed at the spelling that was quoted;
- **a CRLF continuation**.

Four new redirection-**target** productions carry the first group, because that is where the class
actually lives: `LEADING_REDIRECTION` must consume a whole shell word, and a shell word holds spaces
when it is quoted or escaped. `2> "log file.txt"`, `2> 'log file.txt'`, `2> log\ file.txt`, and
`2> "log \"q\" file.txt"`, each in front of every payload. **All twelve cells are caught** — the class
holds under generation, not only under the spellings a reviewer happened to quote.

## bash does not join a CRLF continuation, and `shellWords` does

The CRLF group did not fit the grammar, and finding out why is the substantive result.

`shellWords` consumes `\` + `\r\n` as a **pair** and joins the word — added 2026-07-28 with the
comment that `cp /tmp/x \<CRLF>docs/vision.md` was *"the constitution, reachable by editing the file
on Windows."*

**Measured here on three shells — bash 3.2.57, zsh and sh — and none of them joins it.** `\` escapes
the `\r`, the `\n` then ends the command, and what runs is `cp /tmp/x docs/` followed by a second
command `vision.md`, which is not found. The constitution is never written.

So the matcher answers `true` where bash writes nothing: **a false red, fail-closed**, costing one
prompt on a rare spelling. Nothing is mis-enforced and no gate is weakened.

**Two things follow and only one of them is mine to settle.**

The fuzzer now carries the spelling as a recorded cell in all three payload kinds, and the asymmetry
between the two readers shows up again: the **shell** matcher answers `false` — correct, because
`commandSegments` knows nothing of a CRLF continuation and splits where bash splits — while both
**write** matchers answer `true`, because they reach `shellWords`, which joins. One spelling, two
readers, opposite answers, and only one of them agrees with bash.

**The other is flagged rather than repaired: `compile.mjs`'s claim that this spelling made the
constitution reachable did not reproduce.** It is left alone deliberately on two grounds — the repair
direction is fail-**open**, which is the wrong way to be wrong about a gate; and only bash 3.2.57 was
available on this machine, so a bash 5 that joins the pair would vindicate the original measurement
and I cannot rule it out. What is in the tree now is the measurement and its width, not a verdict.

## The measurement harness was fooled a third time

The neutral payload is `printf ok > portulan.marker` and `ran()` checked that the marker **existed**.
For the CRLF production that was wrong: a shell applies a redirection **before** it looks the command
up, so the leftover fragment `ok > portulan.marker` creates the file and *then* fails. An empty marker
appeared and the harness read it as *the payload ran* — certifying a data position as a command one.

`ran()` now requires the marker to contain `ok`, which only `printf ok` writes.

**Third instance, and the pattern is worth more than the fix.** First the payload was detectable by
its own text (`echo` printing `printf PORTULAN_RAN`); then a failed script was read as a measurement;
now a redirection fired without its command. **Every one was caught by extending the measurement, and
none by reading the code** — which is the argument for the ground-truth file existing at all, made
three times by the file itself.

## The budget stopped being a number

The Sessions cell read `1–2` against nine clauses since before four of them existed. The maintainer's
ruling of 2026-08-25 makes it **`1 per clause`**.

**It is the same repair this milestone has applied to recipe counts, corpus sizes and operator
totals — state the rule, not the tally — reaching the plan's own budget column.** A cell reading *9*
would have been wrong on 2026-07-27 and wrong again the day before it was written, because this row
has been amended twice and both amendments added clauses. `1 per clause` was correct on all three days
and survives the next amendment without anybody editing it.

## State

`main` @ `43abab9`; branch `agent/m8-supervisor-remainder-and-session-budget`. Every recipe the
manifest yields is green. Seam scan clean over every path the diff touches, the commit message and the
branch name, with a planted-term control reddening.

**Two forced-red drills against the new productions**, exit codes read directly. Removing
`shellWords`' CRLF-pair branch reds the fuzzer in the *good-news* direction — *"the recorded divergence
has CLOSED"* — which is the record staying true in both directions rather than only one. Narrowing
`REDIRECTION_TARGET` back to `[^\s]+`, the exact #336 defect, reds **both matchers across the quoted
and single-quoted target cells**, and reds `goldens` besides: the class is generated now rather than
enumerated, so a fourth sibling arrives here instead of in a review.

_The second drill was a no-op on its first attempt — the patch script's quoting broke and the recipe
ran green against an unmodified file. Same shape as the drill that no-opped on #338, and the same
repair: the patcher now hashes the file before and after and refuses when nothing changed. A drill
that does not fire reports on nothing, which is the failure this whole milestone is about._

**Clause (b) is in `main`. Seven clauses remain**, and at one session per clause that is seven
sessions.

## Open, and not mine

- **#339** — `matchesRule` segments the raw command twice. Board: *Next*.
- **#340** — the canary's leaked temp directory. Board: *When-open*.
- **`compile.mjs`'s CRLF claim**, above. Recorded, not repaired; the repair direction is fail-open.
- **`portulan-gotchas.md`** in the agent memory store is at its budget edge. The librarian's pass.
