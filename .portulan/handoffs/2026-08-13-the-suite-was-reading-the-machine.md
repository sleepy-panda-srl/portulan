# Handoff — the suite was reading the machine

**Milestone 7, session 13. Full lane.** Task
[`0019`](../tasks/0019-the-flag-that-was-not-optional.md). The ruled disposal of the close's one
REQUEST-CHANGES: `--pack-root` is optional where discovery finds a root.

## The finding worth carrying forward

**A default that changes what a tool reads changes what its whole test suite reads, and no test in the
suite is about that.** Making discovery the unasked default was three small edits. What it did *not*
announce is that every fixture in the suite whose workspace declares a pack now consults the developer's
plugin inventory. Measured by running the full suite twice against two `CLAUDE_CONFIG_DIR` values and
**diffing the failure lists**: nine cases failed only on the maintainer's machine.

**The general form: when you widen what a function may read, the harness widens with it.** The existing
lesson in `.portulan/memory/` is *a harness you write inherits your change's blind spot*. This is its
sibling and it is worse, because the harness was written before the change and inherited a blind spot
that did not exist yet. A test that passed for four sessions can start passing for a different reason
without being edited — the fifth way-to-not-bind from session 9, arriving from the other direction.

**The instrument is cheap and nobody had used it**: two suite runs and a `comm`. It cost about twenty
seconds and it is the only thing that found this.

## What the checkpoint found that I had not

Session-open, fresh Fable 5, **APPROVE-WITH-ADJUSTMENTS (9)** — five must-fix. It ruled the three
questions I put to it (my position on which tools get the union held; the origin re-keying sound; the
degrade asymmetry sound) and then found four things by tracing calls rather than reading flags:

- **`vendor` is a sixth tool**, and it acquired the behaviour with no line of it edited — `verdict()` →
  `doctor`'s `inspect`, which wires its own thunk. It passed no `env`.
- **`init`'s call-site gate made my new arm dead code.** The plan had the arm and not the gate.
- **Three stale sentences my grep pattern could not match.** I greped for the claim's *words*; two of the
  three state it as a *reason* (`independent of host state`, `cannot reach it`) and one is in a file the
  plan named without checking. The extended pattern was the supervisor's.
- **The CHANGELOG lines I called per-release records are all inside `## Unreleased`** — I had asserted a
  forward-only exemption for text that had never been released.

**And it ruled adjustment 9 to the maintainer rather than deciding it**, which was right: row 7's Status
cell said *"Left: the milestone-close verdict alone"*, written before the close returned
REQUEST-CHANGES, so the scoreboard every session boots from claimed nothing was owed while a behaviour
change was. He ruled it in scope. 495 of 500 bytes.

## What to know before touching this next

- **The switch is the thunk's presence, and there is deliberately no second flag.** A per-tool opt-out was
  argued for `compile --check` and refused, with a ground I had not measured: it **cannot reach `vendor`**,
  which never builds a plan. What keeps a required check's verdict about the tree is the **pin**, not the
  absence of a default — and the sentence in `cli/compile.mjs` claiming otherwise had already gone false
  one pull request earlier, when `compile.sh` gained `--pack-root packs`.
- **The two arms differ on exactly one question: what an unreadable record means.** Asked → exit 2.
  Unasked → derived-only with the diagnostic reported. Reusing the `forced` branch as the default would
  make every CI runner exit 2 or go green on an empty set; the pair is asserted as a pair for that reason.
- **`doctor`'s origin re-keying is load-bearing, not tidy.** `doctor --pack-root auto examples` was
  **already** exit 1 before this change — the count key let host state flip a workspace's verdict, and the
  default would have moved that onto the bare invocation. That defect was found by measuring the
  before-state of a workspace nobody was changing.
- **I threaded `env` through six tools and reverted five.** No test reached them, and a parameter that
  reads as a capability with no caller is the defect this repository has been bitten by twice. The seam
  lives where a test uses it; hermeticity for the rest is the module-scope guard plus the derived sweep.
- **The plugin version is NOT bumped, on the maintainer's ruling, and the brief asked for it.** Measured
  before asking: 20 commits have edited the shipped `SKILL.md` since `0.2.0` with no bump, because the
  plugin version is the *release* number — railed against three other fields and renamed only at a cut.
  The checkpoints-pack precedent the brief cited is a **pack** version, which is independent. So an
  install pinned at `0.2.0` keeps the old sentence; the window is stated rather than closed.

## Fidelity

**17 of 17 properties mutation-tested**, and the harness earned its keep four times over: three
properties nothing was binding, one whose mutation premise was factually wrong, and — the one worth
repeating — **the harness failed to bind its own subject**. It read only column-zero TAP `not ok` lines,
so every case inside a `describe` reported its parent's name and nine mutations looked unbound when they
were not. An instrument that reports the wrong name is the same class as a discriminator that
discriminates nothing, one layer up.

**One property is unbound and is recorded rather than repaired**: vendor's old-residence `env`. No test
can bind it, because a pointer's resolution is *reported and never graded* by design and `verdict()`
discards notes. It is kept because leaving one of two sibling call sites unplumbed is `0020`'s defect, and
it is priced out loud rather than counted.

**Two control characters — a NUL and a SOH — reached `cli/init.test.mjs` in an edit of mine**, as digest
separators that were meant to be text. The `control-chars` recipe caught both. Neither is visible in a
diff, so no reviewer would have; it is the cleanest instance this build has of a rail catching what
review cannot.

**Four existing tests pinned the behaviour under disposal and were rewritten into the property they were
reaching for.** The one worth naming: *"a malformed host record cannot reach an unasked run's verdict"* —
the property **survives and its mechanism inverts**. It held because nothing read the record; it now holds
because the read degrades while saying so. The assertion that the diagnostic is absent became the
assertion that it is present, and the verdict-independence it was really about is unchanged.

**The pre-commit checkpoint returned A-W-A (5) and its first must-fix is the sharpest thing in this
session: the rail I added against [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)
had `0020`'s defect.** The hermetic sweep mapped `<module>.mjs` → `<module>.test.mjs`, so it could never
see a `.live.test.mjs` sibling — and `cli/upgrade.live.test.mjs` was reading the real machine through the
new unasked arm while the file's own header claimed the sweep would catch that. The fix landed at twelve
sites and not at their `.live` siblings, inside the instrument built to catch exactly that.

Membership is derived from **imports** now, and that one predicate was written **four times** — a
substring match, a line anchor, a semicolon-bounded statement match, and finally that plus dynamic
imports. Each spelling fixed the previous one's blindness and introduced its own; what each was blind to
is enumerated once, under *An instrument that measures less than it claims* below.

The cheap check that caught most of them is *mutate, then read what the instrument actually says*. The
one that caught the rest is asserting that an instrument is **not its own evidence**.

Its second must-fix found a prose overclaim in three carriers; **grepping for the claim rather than
trusting the list found a fourth**. And writing the one assertion it asked for exposed an asymmetry
nobody had recorded: the two arms reach the union builder differently, and the fixture I first wrote
passed the asked half while binding nothing on the unasked one.

## The Copilot loop, and what each round was

**Both findings were this change's own class, arriving from outside it.**

- **Round 1, inline.** `discoverPackRoots` returns `why: null` on its **ordinary** success path — a
  record that read fine and lists no pack-carrying plugin — and the unasked arm interpolated it bare, so
  `plan.why` rendered *"…found no root — null"* into `doctor`'s note and every unresolved-pack line under
  it. The `union` helper **one screen above guards exactly that condition**. One operation, two sites,
  correct at one, inside the change whose subject is that class.
- **Round 2, and the inline round was empty.** All three findings came through the promoted-note channel
  ([`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md)) — that proposal earning its keep
  again, because the channel that carried them is the one a reader would have skipped. The hermetic guard
  I had just added created a temp directory per test file and removed none: **18 per full suite run**,
  **4,288 accumulated in this session**. Copilot named three files; the fix is at all eighteen.

**And one more instance of the session's real subject** — see *An instrument that measures less than it
claims* below, which is the one place this session counts it. Rewriting the guard across eighteen files
also rewrote the **rail's own `HERMETIC` constant**, whose value is that same line, turning a
single-quoted literal into an invalid multi-line one. `node --check` caught it.

**Filed rather than folded in:** the same measurement found **28,484** `portulan-feedback-*` temp
directories, **7,477 older than today** — a long-standing leak in `cli/feedback.test.mjs` this change
neither caused nor touches.

## Fidelity, in numbers

Suite **1557 pass / 0 fail**, identical on two hosts. _(This line said **1560** for one draft — I assumed
the five folded adjustments had added tests, and four of them added assertions and guards to existing
cases instead. A figure I did not re-measure after the tree moved, in the session whose own handoff says
to re-measure after the tree moves.)_ Eleven recipes green under pinned roots.

**Seam scan clean over the diff and the branch name, term by term; the commit message is scanned when it
is written.** Stated forward on purpose: an earlier draft attested a scan of a message that did not
exist, and its first repair re-attested it in the past tense — the same claim wearing a different coat.
Caught by a **re-check on the frozen diff**, which returned A-W-A (7) and found three must-fixes *inside
the fold of the previous checkpoint's five*.

## An instrument that measures less than it claims — the session's real subject, counted once

Six instances, and the only reason the number is six rather than higher is that each was caught by a
*different* instrument. Counted here and nowhere else, because a figure with two carriers drifts:

1. **The mutation harness read only column-zero TAP**, so nine cases inside a `describe` reported their
   parent's name and nine mutations looked unbound when they were not.
2. **The closure predicate, as a substring match**, made the sweep file a member of its own closure — it
   holds `from "./recipe-set.mjs"` as the *data* for the case that severs it.
3. **The same predicate, line-anchored**, silently dropped `compile`, `doctor` and `index`'s test files —
   the three with multi-line imports, and the three that matter most. Green throughout, because those
   files were guarded anyway. **A rail can lose its most important members and report nothing.**
4. **The same predicate, static-only**, missed a **dynamic** import in `cli/new.test.mjs` — which was the
   one file still consulting the real machine, traced by a checkpoint that instrumented `readInstalls`
   across the whole suite.
5. **Its count floor** (`>= 10`, then `>= 14`) was satisfied by a set missing every member that mattered.
   It names them now.
6. **A mechanical rewrite across eighteen test files hit the rail's own `HERMETIC` constant**, whose
   value is the very line being rewritten.

**Two, four and six are one shape: an instrument cannot tell code from prose about code.** The
self-membership assertion added for (2) caught (4)'s sibling within a minute of being written, when the
docblock explaining the dynamic case spelled a dynamic import in prose. That is the cheapest lesson here
— *the assertion that an instrument is not its own evidence pays for itself immediately.*
