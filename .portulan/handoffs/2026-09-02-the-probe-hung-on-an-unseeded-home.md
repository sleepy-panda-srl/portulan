# 2026-09-02 — The probe hung on an unseeded home, and I published the wrong reason for it

Milestone 8, out-of-band. No clause moves and no row moves: this repairs the instrument
[`../../evals/ab/corpus.md`](../../evals/ab/corpus.md)'s acceptance test runs on, which row 8's close
still depends on through `acceptedUnder.reRunWhen`.

## What happened, and it was not the credential

`node cli/ab.mjs --stop-probe --operator-env isolated` printed nothing and sat there. We had spent
several rounds before that on the maintainer's OAuth token — a line break at character 70, then a 401 —
and both of those were real. **Neither was the reason the probe would not run.** The hang was in front of
them and would have blocked a perfect credential just as completely.

**One cause, and a first version of this handoff named two.** `isolatedEnv` hands the turn an empty
`HOME` and config directory, so the host runs its **first-run flow** — onboarding, and a trust prompt for
a directory it has never seen — and `-p` has nobody to answer it. That is the whole of it.

**The second "cause" was false and I published it in six carriers before anyone ran it.** I wrote that
`spawnSync` without `stdio` made the child inherit the operator's terminal. **It does not.** Node's
`spawnSync` defaults to `pipe`, so the child already got a pipe that EOFs immediately — measured here,
fd 0 a socket with `isTTY:false` — and only an explicit `"inherit"` hands over a terminal.
`stdio: ["ignore", "pipe", "pipe"]` moves fd 0 from a dead pipe to `/dev/null`: hygiene worth keeping,
never load-bearing. **The seed alone removed the hang.**

The claim was inherited from session 6d's note, propagated into `ab.mjs`, `ab-run.mjs`, a test name, the
Session log, this handoff, the commit subject and the branch name — **without being run once**. That is
the same defect this change was repairing, committed by the repair. A fresh-context pre-commit checkpoint
measured it on a real pty and returned REQUEST-CHANGES.

**Session 6d met exactly this, wrote it down, and fixed it in `ab-run.mjs`**: `seedOperator()` plus
`stdio: ["ignore", "pipe", "pipe"]`, recorded in its own session note as *"the arms hung … ten-minute
timeout, forty times over."* The repair reached the **forty matrix turns** and never the **one turn the
acceptance test depends on** — which is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md), a fix scoped to the site it
was found rather than to its class, in the milestone that named the class.

## The seed moved DOWN a layer, because it could not move up

`ab-run.mjs` imports `ab.mjs`, so `seedOperator` could not be imported upward. Two copies was the
alternative and the defect. It now lives in `ab.mjs` and `ab-run.mjs` imports and re-exports it, so both
reach **one function object**. Seeded only inside the isolated branch: under `inherit` the `HOME` is the
operator's real one and seeding would rewrite their own `~/.claude.json`.

## Every test I wrote first was a source-text assertion, and none of them bound

`export { x } from "./y"` forwards a name to consumers and **binds nothing locally**, so `runTurn` threw
`ReferenceError` while every importer saw the symbol. `ab-run.test.mjs` caught that.

**What did not catch it was the test I wrote to pin the move.** It asserted the re-export's *spelling*.
I then rewrote it to assert identity between the two bindings and claimed in its own comment that no
spelling could satisfy it without resolving — **and the checkpoint measured that claim false too**:
reverting to the bare `export … from` left that test green while eight tests in `ab-run.test.mjs` failed.
Twice, on one test, I asserted coverage I had not measured.

The checkpoint then defeated the other three by mutation, all with the suite green:
**`Function.length` excludes defaulted parameters**, so `seedOperator(dir, arm = null)` branching on the
arm satisfied `length === 1`; a slice taken to the banner `"ab: --operator-env inherit"` counted the top
of the `else` block as the `if`, so `seedOperator(os.homedir())` inserted there passed while writing into
a real home; and a `find()` over source lines took the first match and fell for a decoy comment.

All four are replaced by cases that **act on the module rather than read it** — differently-argued calls
compared byte for byte, a stand-in `HOME` asserted untouched, and the seed's landing point paired against
`isolatedEnv`'s. Both of the checkpoint's mutations now fail. A weaker duplicate of
`ab-run.test.mjs:1405` was dropped rather than kept beside the stronger original.

## What this does NOT do

**It does not discharge `acceptedUnder.reRunWhen`.** It makes the probe *runnable*; whether the host
invokes the compiled `Stop` hook under the ruled isolation is still unmeasured, and the hook question
still rests on the 2026-08-29 `inherit` run. The obligation stays where `../../cli/ab.mjs` puts it.

**`stdio` is NOT demonstrated to matter**, because it does not: measured above. It stays as hygiene and
the handoff says so rather than letting a kept line imply it was needed.

**And the maintainer's token still 401s** — `Failed to authenticate. API Error: 401 OAuth access token is
invalid`, which `../../evals/ab/arm.md:195` records as the signature of a credential that reached the CLI
and was rejected. That is a separate question from this hang and is not diagnosable from inside a session
that never holds the credential.

**The drill did not cover this and still does not.** `stop-probe` spawns a real agent, so no rail here
runs it; the four cases added are source-shape and behaviour assertions, one of them verified to fail
when the fix is reverted. A rail that actually exercises the probe would need a credential in CI, which
is a decision nobody has taken.

## Copilot round 1: three subjects, and the third is this pull request's own defect again

**A test named for a thing it did not do.** `under \`inherit\` NOTHING is written into the operator's real
home — run, not read` **ran nothing**: it called `seedOperator` directly and never entered the `inherit`
branch. A name claiming coverage the body has not got is the defect this whole change is about, committed
inside its own repair, one round after the checkpoint caught the same shape three times. It drives
`run()` down the real branch now, with `HOME` at a stand-in and an `--into` holding no constructed arm so
the probe refuses before spawning — **and it asserts the branch's own banner reached stdout**, because
exit 2 and an untouched home are equally true of a refusal that never got there. Without that assertion
the replacement would have overclaimed one layer down.

**Temp directories leaked on the failure path**, at three sites: `fs.rmSync` after the assertions runs
only when they pass, so the runs that leak are exactly the ones somebody is debugging. All three use this
file's own `withTemp`, which already existed — the fix was to use the helper rather than hand-roll
`try/finally` beside it. Measured after: five failing tests, zero new directories.

**A dead import.** `OPERATOR_SEED` was imported when an earlier version of these tests used it and left
behind when they were rewritten.

Two of the five threads were suppressed low-confidence notes promoted to gating threads. Both were right.
