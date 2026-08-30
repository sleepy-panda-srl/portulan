# Handoff — the table was a blacklist, and the arm carried the index

**Date:** 2026-08-29 · **Milestone 8, session 6b. Full lane.** Implementer: Opus 5.

## What landed

The A/B **arm builder**: [`../../cli/ab.mjs`](../../cli/ab.mjs) and its suite, the `ab` verify recipe,
a forced-red drill (roster 24 → 25), a byte-compared [`register.md`](../../evals/ab/register.md), and
repairs to [`arm.md`](../../evals/ab/arm.md) and [`../../evals/README.md`](../../evals/README.md).
**23 recipes green in this working copy. The row does not move.**

**Three fresh-context gradings, and both pre-commit passes asked for changes.** Session-open returned
APPROVE-WITH-ADJUSTMENTS (12). Pre-commit returned **REQUEST-CHANGES on 5 blocking + 13**; the repair
obliged a **second full pass** under the checkpoints pack's own rule, which returned **REQUEST-CHANGES on
2 blocking + 9** — one of them a defect the *first* fold had introduced, of exactly the class the first
pass blocked on. All folded. A **second opinion** on the three maintainer rulings returned **CONCUR** on
all three with three adjustments, all folded, and one proposed mechanism I could not reproduce and did
not adopt. Every pass re-ran the measurements rather than reading mine.

**Nothing is graded, and the one agent that ran graded nothing.** The maintainer split this clause at
**construction | grading | running** on 2026-08-29: 6b builds the arms, **6c** owns the four graders and
their level-1, attribution and level-2 discrimination fixtures, **6d** owns the run once he rules `k`.
The agent turns this session spawned were `corpus.md`'s acceptance test and nothing else — no scenario,
no grader, no figure. **There were three invocations and two completed turns**, not one: the first
refused on an expired credential, and the run was then repeated through the shipped command once a
checkpoint found that the recorded nonce could not be recomputed. _(This paragraph said "the single agent
turn" until a second opinion counted them against the corpus in the same staged diff.)_ The honest sentence about this session is that the
instrument builds the arm it was ruled to build and that the arm's hook is reached; it says nothing
whatever about whether Portulan helps.

## The finding, and it is the reason the session was worth running

**`arm.md`'s move table is a blacklist, and [`../../cli/vendor.mjs`](../../cli/vendor.mjs) carries every
ordinary file under a workspace directory.** So a specification that names what to *remove* ships
whatever it forgot. Built to that file's six rows exactly and vendored, the treatment arm carried:

```
.portulan/memory-index.md     30 of customer zero's rule titles, over an EMPTY memory/
.portulan/handoffs-index.md   146 dated handoff titles, over an EMPTY handoffs/
.portulan/rule-carriers.json  five entries naming the A/B clause — the experiment's own subject
.portulan/labels.json         customer zero's GitHub label policy
```

and **`doctor` reported GREEN** over all of it, because nothing in the arm regenerates or byte-compares
once the recipe set has been replaced. That is session 6a's retargeting undone through a side door: a
store's table of contents without the store.

**It was found by the session-open checkpoint, not by me** — a fresh context that built the arm itself
rather than reading my description of it. My plan had reached half of one of the four (`memory.index`)
and had filed it under tidiness.

**The repair is structural rather than four more deletions.** `DISPOSITIONS` is **total**: every path
under `.portulan/` must be classified by exactly one entry, and `plan()` refuses otherwise. A file
customer zero adds tomorrow is a red on the commit that adds it. The moves the specification did not
reach are each now argued in `arm.md` with the measurement behind it — **and no count of them is written
anywhere in prose**, here included: `DISPOSITIONS` is the carrier, `--plan` prints it, and the register
records it. *"Seven moves added"* stood in a draft of this paragraph and was the replaced defect in new
clothes — a table-row count wearing the word the machine carrier uses for a disposition.

## The rail was not run over the file that broke it

**Two blocking findings at pre-commit, and they are one story.** `stage()` was headed *"the
substitutions, each rule-2 checked"* and called the checker for **`dod.md` alone**: `workspace.json` and
`verify/build.sh` were written and never graded. Five carriers stated the stronger claim, one of them a
**generated** file.

And the ungraded `build.sh` was carrying a violation. Its comment quoted the sentence
[`corpus.md`](../../evals/ab/corpus.md) names as forbidden — *"done requires a green verify"* — in order
to say it was forbidden, and named `evals/ab/corpus.md` and `evals/ab/arm.md`, **neither of which exists
in the arm**. So the arm's only recipe both planted the mandate under test and described the experiment
to its own subject — which is the exact reason `arm.md` gives for dropping `.portulan/README.md`, committed
one constant away from that drop. `DOD_CITATION` points the arm's condition 1 at that file.

Running this module's own `rule2()` over its own constant returned the violation. **The rail worked; it
was not pointed at the file.** Every substitution now reaches a checker before anything is written, and
the gate precedes the writes so a refused construction leaves no arm behind.

**A category error surfaced in the repair.** Pointing a sentence matcher at `workspace.json` refused the
whole manifest: serialised, it is one "sentence" containing the token `requires`. A manifest authors no
sentences — what it can carry is a prose *value*. `rule2Json()` grades the string leaves a data artifact
adds, the disposition declares which kind it is, and the blunt `portulan` → `scratch` substitution that
row used to declare is gone: `rule2()` un-substitutes globally, so it was rewriting the document before
comparing and produced *"A portulan project adopting Portulan"* inside its own refusal message.

## The matcher's coverage was overstated, and by a lot

The docblock claimed it *"catches the deontic vocabulary and misses a paraphrase that avoids it"* —
singular. The checkpoint attacked it with fifteen sentences a reasonable implementer would write.
**Thirteen got past**, including `mustn't` and `cannot` — which falsifies *the deontic vocabulary*
outright — the entire imperative mood, and **"Done is demonstrated, not asserted"**: the mandate under
test in its own canonical wording, quoted from the kernel.

The corpus had **no imperative case at all**, so nothing had measured that class.

**The honest statement, which is now in six carriers and should not be shortened in any of them:** the
matcher catches a **17-word list**; the class it misses is *every mandate not spelled with one of those
words*. Six corpus cases are now misses the suite requires to **stay** missed. What the rail establishes
is that the careless spelling is caught. **A person still reads the added sentences**, and this does not
replace that. [`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
was cited *by this diff* while the diff was doing the thing it forbids.

## What the drill's control leg caught, which is the argument for having one

`.portulan/personas/` holds **only empty directories**, so git does not carry it: present in a working
copy, absent in any clean checkout. The drill runs each rail on a pristine throwaway worktree **first**,
that worktree is made from a commit, and the control exited 2 — the `personas/` disposition matched
nothing and the builder called it stale. **CI would have refused every run on a tree with nothing wrong
with it.**

The first repair was also wrong, and in an instructive direction: I audited the `mayBeAbsent` exemption
by refusing it whenever the path *was* present — the `docs.sh` `cli-table` pattern, over-applied. That
refused every working-copy run. `mayBeAbsent` says *matching nothing is not staleness*; it does not say
the path must be absent. **What is checkable is the stated reason** — git carries nothing under it — so
the exemption is now audited by asking git, and *nobody asked* is exit 2 rather than a pass.

_Note for whoever writes the next session note: **"rule 2" is overloaded here.** `arm.md`'s rule 2 is
this one; [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md)'s rule 2
is *records land last*, and it is what `cb734896` was about — yesterday._

## `done-demonstrated` is LIVE, and the answer arrived late enough to be instructive

[`corpus.md`](../../evals/ab/corpus.md)'s acceptance test needs the arm's `Stop` hook to record an
invocation **on a real stop**. The maintainer approved one ungraded agent turn for it. **It was met in its first half:**

```
node cli/ab.mjs --construct --into <dir>
node cli/ab.mjs --stop-probe --into <dir>/a --seed m8s6b-acceptance --operator-env inherit
```

`met: true` · **4** recorder invocations · seed `m8s6b-acceptance` · nonce `4f53b2a09c4c1d9d` · agent
exit 0. The corpus now holds **four** scenarios, on the maintainer's ruling of 2026-08-29 accepting the
`--operator-env inherit` departure for this test and nothing else.

**The first recorded result was not reproducible and that is the more useful half.** It came from a
direct module call passing `process.env`, while `--stop-probe` had no unisolated path at all — so the
record attributed an output to a command that could not produce it, and its nonce `2f946f076a19dbde`
carried no seed and could be recomputed by nobody. Both were caught by the second pre-commit checkpoint.
The flag now exists, prints the departure on every run, and the seed is recorded beside the nonce.

**The second half of the test is unbuilt**: *"and a fixture asserts that record's presence"*. All four
stop-probe cases in the suite are refusals, because a positive control would have to spawn an agent and
`tests.sh` runs that suite. The demonstration is a session's recorded run, not a rail.

**The first two attempts could not run, and I drew the wrong conclusion from the second.** The operator's
session had expired — incidental. After he logged in the probe **still** refused, because `isolatedEnv()`
gives the arm a fresh `HOME`; breaking **`HOME` alone** or **`CLAUDE_CONFIG_DIR` alone** is each enough
for *"Not logged in"*. That measurement is real and reproduces.

**The inference from it was wrong, and it nearly shipped as a fact.** I wrote *"the ruled operator
isolation makes the agent unrunnable on this host, full stop"* into four carriers plus the tool's own
`--help`. A session-open checkpoint on the follow-up refuted it in one command: the stored login is
reached **through `HOME`** — a fresh home simply has none — and `isolatedEnv()` **carries the operator's
whole environment through** (`...base`), so a credential exported as a **variable** reaches an isolated
arm untouched. Measured under full isolation with a **fake** token: *"401 OAuth access token is invalid"*
rather than *"Not logged in"*. **The token had been reaching the arm all along; nothing needed building.**

Three things follow. The cost is **the operator having no token exported**, which `claude setup-token`
fixes — so `--stop-probe --operator-env isolated` now **refuses with that remedy** instead of paying for
a launch to discover it. The recorded run stays what it was, taken under `inherit` on his ruling, and is
not retroactively a ruled-arm run. And **6d has three doors, not two**; the cheap one is a re-run under
`isolated`, which is `acceptedUnder.reRunWhen` and now has an owner.

_Two more corrections the checkpoint forced, both in evidence I had already written down: the credential
is **not** per-user-and-not-per-HOME — the login keychain is located **through** `HOME` — and my
file-copying tests landed at paths the CLI does not read, since with `CLAUDE_CONFIG_DIR` set it reads
`$CLAUDE_CONFIG_DIR/.claude.json`. **A true conclusion from a test that did not test it** is the same
instrument error this handoff already records twice._

**The probe's first cut answered anyway, and that was the worse bug.** It returned `hook was NOT invoked`
when the agent had exited 1 without completing a turn. `compile` warns that a missing hook *fails open*;
an arm whose hook is unreachable silently becomes arm B. Reporting *not invoked* on evidence that no stop
occurred is [`../memory/a-checker-must-refuse-what-it-cannot-check.md`](../memory/a-checker-must-refuse-what-it-cannot-check.md)
inside the instrument built against exactly that failure — and had the credential not been fixed it would
have **retired the scenario on a login state**, which is what `corpus.md`'s *"without reopening the
question"* forbids. It now exits 2 with what the agent said.

**4 invocations has a measured cause, and the first draft of this paragraph guessed at a flattering one.**
It offered *"consistent with the arm's Stop gate intervening in the agent's loop, which would be the
treatment biting"* — session 6a's retracted-claim shape, one page earlier in this milestone, written by me
while the mechanism was one command away. Run: the hook delegates to `stop-gate.mjs`, which blocks three
times on *"no handoff dated 2026-08-29"* — an arm has no handoffs — and releases at its per-reason cap of
three on the fourth. Three blocks and a release is four stops.

_A second opinion proposed a deeper cause still — that the gate fired only because the probe's own strays
made the arm dirty — and **it does not reproduce**: measured on two freshly constructed arms with
independent session ids, the **clean** arm blocks identically. Recorded because adopting a plausible
mechanism without running it is the same defect as the claim being corrected._

## A live defect found in passing, and it is not this session's

The host rejected two of the three deny rules `compile` emits for the constitution gate, on **this
repository's own** `.claude/settings.json`, Claude Code 2.1.240:

> Permission deny rule (.claude/settings.json): `Write(./docs/vision.md)` is not matched by file
> permission checks — only `Edit(path)` rules are.

`Edit(./docs/vision.md)` binds and the gate holds, so this is **not an open hole** — but two of three
emitted rules are decoration and the host warns on every start. Reported to the maintainer for filing;
nothing here was changed for it.

## Two things a reader should not take from this

**The register does not carry the source path count**, deliberately. It moves whenever a session writes
a record, and a byte-compared file holding it would red the `ab` rail on work that never touched the
arms. Measured mid-session: the count went 276 → 277 when the `ab` recipe was added and the register did
not move.

**The arm is machine-bound, and that is now measured rather than repeated.** Five hooks, every one an
absolute path into this checkout. `--construct` prints the figure.

## For the next session

**6c owns the graders.** Everything they need exists: `nonceFor()` derives the attribution nonce from
the scenario definition and a harness seed and never from arm output, `SCENARIOS` carries the corpus
with the retired four and their reasons, and `armsDifferOnlyByTreatment()` is the construction-time
assertion. What is **not** built is any grader, any minimal pair, and the inversion fixture — and
`corpus.md` is explicit that a grader which cannot separate its own pair is *red, never skipped*.

**Operator isolation has a cost, and it is smaller than this section first claimed.** A fresh `HOME`
carries no stored login — that reproduces. But a credential exported as a **variable** reaches an
isolated arm, because `isolatedEnv()` carries the environment through, so the cost is **the operator
having no token exported** and `claude setup-token` fixes it. The probe now refuses with that remedy.
**So 6d has three doors and the cheap one is a re-run under `isolated`** — that is
`acceptedUnder.reRunWhen`, it is reachable today, and **6d owns it**. Nobody has yet watched the ruled
arm answer, which is the thing still owed.
