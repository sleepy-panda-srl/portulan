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

## bash does not join a CRLF continuation — and the first record I wrote of that was wrong

The CRLF group did not fit the grammar, and finding out why is the substantive result. **So is getting
it wrong twice before the checkpoint caught me.**

`shellWords` consumes `\` + `\r\n` as a **pair** and joins the word — added 2026-07-28 with the comment
that `cp /tmp/x \<CRLF>docs/vision.md` was *"the constitution, reachable by editing the file on
Windows."* **Measured here on bash 3.2.57, zsh and sh: none of them joins it.** The `\` escapes the
`\r`, the `\n` ends the command, and a second command runs in place of the rest.

**From that I concluded the spelling was a false red on every payload, wrote "the constitution is never
written" into three carriers, and was wrong.** The pre-commit checkpoint measured what I had not:

**A shell applies a redirection BEFORE it looks the command up.** So although bash splits and the
command never runs, a *clobbering* redirection on the surviving fragment still fires. Measured: a file
holding content before is **zero bytes** after. `>` and `1>` truncate; `>>` appends and does not;
`cp` never runs and leaves the file untouched.

So the three payloads have three different answers, and only one of them is the false red I claimed:

| payload | bash | matcher | verdict |
|---|---|---|---|
| `shell` | splits; nothing gated runs | `false` | correct |
| `write-redirect` | **truncates the target to 0 bytes** | `true` | **a TRUE POSITIVE** — the matcher prevents the destruction |
| `write-named` | `cp` never runs; file untouched | `true` | a false red, fail-closed |

**A production's ground truth is therefore not always a property of the position**, which the grammar
had assumed throughout. It carries a per-kind override now, argued where it is used, and the append
shape is refused by `carries` because `>>` does not truncate and a cell whose ground truth varies with
the spelling has no invariant to hold.

**And the mechanism I gave for the `shell` answer was also false.** I wrote that `commandSegments`
"splits where bash splits". It does not — it consumes the pair exactly as `shellWords` does, and says
so in its own comment. The answer is `false` because the segment keeps its **raw source text**, so the
literal prefix compare meets `git \<CRLF>push --force …` and fails. Right answer, wrong reason, which
`a-stated-enforcer-must-be-the-real-one` counts as the same defect one size down.

**What survives of the original flag, at its real width.** `compile.mjs`'s claim that this spelling
made the constitution *reachable* is still unreproduced **for the `cp`-shaped payload it names** — and
is now beside the point for the redirect shapes, where the target is destroyed regardless of whether
anything joins a continuation. Left unrepaired on the same two grounds: the repair direction is
fail-**open**, and only bash 3.2.57 was available here.

## The measurement harness was fooled a third time, then a fourth

The neutral payload is `printf ok > portulan.marker` and `ran()` checked that the marker **existed**.
For the CRLF production that was wrong: a shell applies a redirection **before** it looks the command
up, so the leftover fragment `ok > portulan.marker` creates the file and *then* fails. An empty marker
appeared and the harness read it as *the payload ran* — certifying a data position as a command one.

`ran()` was changed to require the marker to contain `ok`, which only `printf ok` writes.

**And that fix is what hid the true positive above.** Requiring content made the harness report *the
payload did not run* for exactly the case where bash had just truncated the target — so the correction
to one blindness manufactured another, one measurement later. The probe returns **two** readings now:
`ran`, the marker holds `ok`; and `touched`, the marker exists at all. Each payload kind is graded
through the effect its gated action actually has — a redirection's effect is that the target is
written, whether or not the command ran.

**Four instances, and the pattern is worth more than any of the fixes.** The payload was detectable by
its own text; a failed script was read as a measurement; a redirection fired without its command; and
the repair for that read a truncated file as an untouched one. **Every one was caught by extending the
measurement, and none by reading the code** — which is the argument for this file existing at all,
made four times by the file itself.

## The checkpoint, and the order I got wrong

**Pre-commit: Fable 5, fresh context, REQUEST-CHANGES.** It confirmed the retroactive sweep — all
eighteen adjustments from the two #338 checkpoints, plus the one item that verdict had left
*undemonstrated*, discharged and evidenced line by line. Then it refused the diff on the two findings
above, which is the checkpoint earning its place for the third time in two sessions: **the headline
result of this change was recorded backwards, in three carriers, and no rail could have caught it
because the harness that would have was blind in the same direction.**

Both are folded. Routing the runner through `groundFor` and leaving the *suite* reading
`position.ground` then reddened `tests` — one carrier corrected and its sibling left, inside the fix
for a finding about exactly that. Caught by the rail rather than by me.

**And I committed before the verdict arrived.** I dispatched the checkpoint, kept working, and
committed `a51aa03` while it was still running — out of order under the gate map's checkpoint table,
which is the breach [`proposals/0024`](../proposals/0024-a-tier-says-who-attends-a-checkpoint-says-what-is-owed.md)
retires and the one the Session log already records on
[#137](https://github.com/sleepy-panda-srl/portulan/pull/137). Nothing merged and nothing went
outward: the branch is Auto-tier, the pull request opened after the verdict was folded, and a second
checkpoint graded the correction. But the tier says who must attend an action and the table says what
is owed before it, and I acted on the first while owing the second.

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
