# Handoff — the reachability was retired, and the removal was not taken

**Date:** 2026-08-25 · **M8 (Evals & telemetry), session 2** · Implementer: Opus 5.

## What landed

One leftover from sessions 0–1, closed: **the CRLF reachability claim in `cli/compile.mjs` is settled
by measurement, and the matcher is unchanged.**

1. **Measured on two bash 5.2 builds**, which is the one thing session 1 could not do and the one
   thing that kept the question open. Its record said so in its own words — *"only bash 3.2.57 was
   available to measure on"*.
2. **The reachability sentence is retired in all three of its live carriers**, replaced by what was
   measured, at what width, with the gap named.
3. **[`0031`](../proposals/0031-a-continuation-no-shell-joins.md)** asks the maintainer whether the
   branch should go. **It was not taken here**, and the reason is in the next section.

## The measurement

`shellWords` consumes `\` + CRLF as a **pair** and joins the word. The comment beside it, from
2026-07-28 on [#60](https://github.com/sleepy-panda-srl/portulan/pull/60), justified that with
`cp /tmp/x \<CRLF>docs/vision.md` being *"the constitution, reachable by editing the file on Windows."*

Five shells, a neutral target path, and the exact strings the fuzzer's production builds: **bash
3.2.57** (arm64-apple-darwin25), **bash 5.2.15** (aarch64-unknown-linux-gnu, `debian:bookworm-slim`),
**bash 5.2.37** (x86_64-pc-linux-gnu, `node:26`), **zsh 5.9**, and **the measured host's `/bin/sh`** —
which on that macOS host is bash 3.2.57 in POSIX mode, so it is a fifth reading of bash rather than
coverage of `/bin/sh` as a family: `dash` and `busybox`, the common `/bin/sh` on Linux, were **not**
measured. Images were already present locally; nothing was pulled.

**All five agree and none joins the pair.** The write-named shapes leave the target byte-for-byte
unchanged; the clobbering redirect shapes truncate it to zero bytes; `>>` does not. The LF controls in
the same harness *did* join and *did* write the target — which is what makes the rest a measurement
rather than a silence. **Every cell `fuzz-shell.mjs` already recorded reproduces on both bash 5.2
builds**, the true positive included.

**Never against `docs/vision.md`.** Every probe used `neutral/target.md`, on the maintainer's explicit
instruction in this session's brief. That instruction cited an earlier probe written against the
constitution and stopped by the live gate; **no record in this repository carries that event**, so it is
reported here as the brief's reason for the constraint rather than as a fact this handoff can source.
The constraint itself needs no incident: the constitution is never written by an agent.

## Why the branch is still there

Removing it is **fail-open on the matcher guarding the constitution**, which the gate map names as the
case to scrutinise hardest — so it is the maintainer's, and `0031` asks it rather than taking it.

The proposal carries the cost measured rather than argued — **at the third attempt, and the first two
are the lesson.** Deleting both carriers in a scratch clone and running the recipes moves **four**
surfaces: the `crlf-continuation-in-the-payload|write-named` fuzz cell (divergence closes), the
`a-CRLF-continuation` goldens fixture (regresses), **two direct assertions in `cli/compile.test.mjs`**,
and `mutants` refusing with exit 2 over the corpus that the second has now reddened.

**I wrote an exhaustive claim three times and measured it once.** The first draft said "three cells and
nothing else" — three was the probe table's row count borrowed into the file's own cell vocabulary, and
the goldens fixture was missing; the pre-commit checkpoint caught that and I corrected it to "those two
and nothing else", which was still a sentence I had reasoned to rather than run. Copilot's first round
on #342 named the test surface, and running the deletion found the fourth as well. **A claim of
exhaustiveness is the one kind that cannot be reviewed by reading** — in a change whose whole subject is
a claim nobody measured. The **true positive survives the removal for the fuzzer's
production**, and the reason I first gave was false: I wrote that redirections are recognised off raw
segment text, and there is no raw-text path — `shellWrites` iterates `shellSegments`, built from
`shellWords`. What saves that cell is **where the pair sits**: after the head, so the split leaves
`> docs/vision.md` in a later segment that still names the target. After the `>`, the operator takes the
escaped `\r` instead and the match is lost — which is why one of the two test assertions fails. It does
not generalise to every redirect spelling. A real LF continuation still joins. So the honest statement is that removal costs nothing measurable *on the shells measured*, and
the gap sits precisely where the retired claim pointed: **no Windows-side bash** — git-bash, MSYS2,
Cygwin, WSL — **and no bash 4.x**. That is why this is a question and not an obvious cleanup.

## Three carriers, not one — the supervisor found the third

I planned to correct two carriers. The session-open checkpoint found a **third**: the same retired
sentence lived in `cli/compile.test.mjs`'s comment above the two CRLF assertions. That is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s class arriving inside a
session whose whole subject is one claim with several carriers, and it is the second time this arc has
met it. All three now point at one write-up rather than restating it, and `commandSegments` — the
pair's *second consuming* carrier — says out loud that a removal would have to remove both, because
one carrier corrected and its sibling left is how the last several defects on this line happened.

## The correction I was told to make and would not have made

I had planned to write *"the bash-5 measurement is recorded in prose, so no rail exists"*. The
supervisor refused it: **the rail already exists.**
[`cli/fuzz-shell.ground.test.mjs`](../../cli/fuzz-shell.ground.test.mjs) runs this production under
whatever bash the host running `tests` has, and reds if that bash joins the pair — so a joining shell is
caught wherever the recipe runs, CI included. Writing *no rail* beside live machinery is
[`a-stated-enforcer-must-be-the-real-one`](../memory/a-stated-enforcer-must-be-the-real-one.md) in the
mirror direction and the inverse of `dod.md` condition 4. What is honestly absent is narrower and is
what the comments now say: the rail measures **one host's bash per run**, and **no Windows-side bash
runs anywhere in this repository's CI**. The containers are a record, not a recipe — a recipe that
pulled an image would be a network call in CI.

## Copilot on #342 — four rounds, 38 gating threads, one finding refused by measurement

**Four rounds, 38 gating threads — 30 across rounds 1–3 and 8 in round 4** — counted from the thread
record rather than from any round's summary. The repository's promotion step turns Copilot's suppressed
notes into threads, so the notes-only channel gates here rather than getting a batched reply, and one
finding is routinely raised on several threads at once.

**No global finding count is given, and that is deliberate.** I wrote one three times — "six distinct",
"five distinct", "eight distinct" — and each disagreed with the bullets beneath it or with a sibling
summary. A tally I keep restating and keep getting wrong is not a fact about the review; it is a claim
I have no instrument for. The classes below are enumerated instead, which is checkable against the
threads. _(Copilot, round 3, and the pre-merge supervisor, which found the three summaries still
disagreeing.)_

- **The exhaustive-cost claim missed the test surface** — raised on three threads. Real, and it made
  me run the deletion instead of reasoning about it, which found a fourth surface Copilot had not
  named. Above.
- **The `commandSegments` sibling comment said "the same false red"** and that carrier records none:
  it supplies the SHELL matcher, whose CRLF cell answers `false`, the correct negative. Real; the
  comment now says which cell is which.
- **"bash splits, `cp` never runs"** — inaccurate. The pair is inserted after the head, so `cp` DOES
  run on the first fragment and fails on a malformed `\r` argument; what never runs is the intended
  write. Real; reworded at the cell.
- **The PR-URL placeholder** — already fixed by this branch's second commit before the round landed.
- **The probe read SIZE, not bytes** — right, and equal size cannot rule out a same-length overwrite.
  Answered by strengthening the instrument rather than narrowing the claim: it now compares SHA-256
  before and after, with the copy source holding `SRCSRC` against the seed's `BEFORE` — **the same
  length, deliberately different bytes** — and the hasher self-tested before any case runs. _(I first
  wrote that the source was "the same six bytes as the seed", which would have made a successful
  overwrite byte-identical to the seed and blinded the instrument in the one cell it was built for. The
  design was right and the sentence describing it was not; caught at the pre-merge supervisor pass.)_ **All three bash builds: `IDENTICAL`, content `BEFORE`.** The container's first
  attempt had no `shasum`, produced empty hashes and reported everything identical — a harness fooled by
  its own failure, caught by the self-test that now runs first.
- **The mechanism I gave for the surviving true positive was false**, in five carriers. There is no
  raw-segment-text path. Corrected above and everywhere it appeared.
- **REFUSED, on measurement: "the two assertions are not both false reds".** Copilot read
  `echo x > \<CRLF>docs/vision.md` as the write-redirect shape the fuzzer records as a true positive.
  It is not, and **where the pair sits decides it**: after the operator the escaped `\r` becomes the
  redirect's target, so bash writes a file named `\r` and the constitution is untouched — exit 126,
  target byte-for-byte unchanged on bash 3.2.57 and 5.2.15. The truncating shape puts the pair
  *before* the operator. Two different strings. The refusal is folded as a clarification rather than
  only argued, because a reviewer making that reading once means the next one can.

## What the next session should know

- **`0031` is open and blocks nothing.** The matcher behaves today exactly as it did at `2054740`.
- **If it is accepted, the removal is its own review and carries all four surfaces with it** — the
  `write-named` EXPECT cell, the `a-CRLF-continuation` goldens fixture, the two `compile.test.mjs`
  assertions, and `mutants`, which is unblocked by the fixture rather than by an edit of its own.
  Moving a recorded cell in the good-news direction is still a red until the record is updated — by
  design.
- **If it is kept, the Windows gap needs managing rather than noting.**
  [`a-recorded-limit-is-not-a-managed-limit`](../memory/a-recorded-limit-is-not-a-managed-limit.md)
  says a record is not management: an issue, a rail, or an explicit permanent-by-design ruling.
- **Row 8's Status cell did not move.** This closed a leftover, not a clause. Seven of nine remain.

## Verification

Every recipe the manifest yields, exit codes read directly and never through a pipe. `goldens`,
`mutants` and `fuzz-shell` green and unmoved, which is the check that matters here: no recorded cell
shifted, because no matcher was touched. Two recipes were red at some point for structural reasons, and
they clear at different moments — which is the correction the pre-commit checkpoint made to this
paragraph. `docs` 5c stays red **until the follow-up commit carries the pull-request URL into `0031`**,
not until the first commit; and `pack-identity` compares the tree against the **staged** blob, so it
reports an **unstaged** edit as drift and was green in the fully-staged tree before either commit. That
second one is the trap [`identity.md`](../identity.md) already records, met on schedule and then
mis-stated once in this very paragraph.

Seam scan clean across every path the diff touches, the commit message and the branch name, with a
planted control term proving the scanner fires. Fresh-context supervision at both moments: session-open
and pre-commit.
