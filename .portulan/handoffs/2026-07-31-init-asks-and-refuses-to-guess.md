# Handoff — `init` asks the one question it may not answer

**Milestone 7, session 1.** The row's first unbuilt subcommand is built: `init` drafts a workspace for a
repository that has none, in either residence, and `doctor` is green on what it emits — **the in-repo
one with `--pack-root` named**, because the draft composes a pack by default and nothing discovers one.
That condition travels with the claim everywhere it is made, here and in `docs/plan.md`: a green whose
precondition lives only in a test comment is a green that will be quoted without it. **Milestone state:
M7 still in progress** — `vendor`, `upgrade`, `new`, `feedback`, `doctor`'s validation half, the
legibility score and verify composition are all untouched, and the row's four demonstrations are unrun.

## What landed

`cli/init.mjs` + `cli/init.test.mjs` (written first), wired into `SUBCOMMANDS`; `init`'s exit-2 path and
its place in the entry point's unbuilt-subcommand loop are gone. Suite **859/859**, up from 774 — 84 new
`init` cases, **20 of them written after the pre-commit checkpoint**, each red against the code as it
stood. Eight recipes green. `npm pack` is **74 files, all 74 byte-identical to the git index**, so
session 0's no-build-step property holds across the two files added.

## The pre-commit checkpoint found six real defects, two of them destructive

Recorded here in full, because the shape of what a *reading* of this diff would have missed is the
reusable part. **Every one was demonstrated by running the tool, not by reading it.**

- **A hand-written file was silently overwritten.** The residence check keys on `workspace.json`, which
  correctly answers *is this repository governed?* — and the tool was treating that as an answer to *is
  it safe to write here?* A `.portulan/` holding a hand-written `gate-map.md` and no manifest answers
  **no** to the first and must still stop the second. It now refuses on any collision, naming each path
  and why. **Two questions, one key: that is the whole defect.**
- **A partial write wedged the retry.** `workspace.json` was written **first**, so an I/O failure
  mid-loop left a torso the residence check then read as a governed repository — and the retry was
  refused with a sentence that was false. The manifest is written **last** now, and the collision check
  means the common cause never starts.
- **`--summary ""` produced a manifest `doctor` rejects.** `??` does not catch the empty string, so it
  reached the manifest where `minLength: 1` failed it — a workspace red on the run that reported
  writing it successfully. Empty values are now refused for **every** flag, at the command line, since
  none of them has a meaningful empty value.
- **The drafted `verify/README.md` claimed a Stop-gate and CI the adopter has neither of** — and
  contradicted the `README.md` beside it, which said correctly that nothing compiles to a working Stop
  hook. Two files in one draft disagreeing, in the artifact meant to teach adopters honesty about
  limits.
- **The drafted README said "three starter rules" over a policy carrying five.** The count never caught
  up with the two floor-reaching rules added earlier the same session — a wrong figure in a record,
  this repository's most-named defect, written into every adopter's tree. It is derived now.
- **`init` alone omitted the `?? ""` on `process.argv[1]`** that every sibling tool carries, so
  importing it threw at module load — against its own header's promise, two hundred lines up, that an
  unreadable schema must not throw while loading.

Also folded, from the same pass's minor set: the answers file's **values** are type-checked, not only
its keys (`"cycle": "false"` is a truthy string and would have composed the pack the adopter was
switching off); `--feed ""` is refused like every other empty value; both stranding refusals now name a
next step; and `cli/README.md`'s claim that `init` is *exercised through the entry point* was soft —
the only entry-point coverage was the run-export check — so the claim was made true with a real
dispatch test rather than softened to match.

## The loop record — eight rounds, and the bound bent only where session 0's precedent allows

**Round 1, one thread, real.** `resolveAnswers` returned `packRoots` unnormalised, so an answers file
giving `"pack-root"` as a single string — which the value check accepts, like every other string key —
reached `packResolves` and died on `.some`. A valid answers file became `could not run — roots.some is
not a function`: a real answer refused with a message about somebody else's bug. Normalised at the merge,
where one shape is established for everything downstream.

**Round 2, one suppressed note, real.** The write-order test called the async `run()` without awaiting.
It observed the right order only because `run` reaches the write loop with nothing suspended — an
accident of today's code. **The failure mode is the part worth keeping:** the moment `run` gains an
`await` before writing, the `finally` restores `fs.writeFileSync` first, `written` is empty, and
`findIndex` returns `-1` on nothing. A regression guard that stops guarding exactly when the code it
guards changes shape. Awaited now, with a vacuity assertion so an empty list can never satisfy it.

**Round 3, two suppressed notes, both real, both taken over the two-round bound — declared in the open,
on session 0's precedent that the bound bends for defects the change itself introduced.**

- **`scratch()`'s docstring said the directories cleaned themselves up, and nothing did.** Measured when
  the note landed: **2375 leaked directories** under `os.tmpdir()`. A comment claiming a behaviour the
  code does not have, in a file whose whole subject is checking claims. `cli/doctor.test.mjs` already
  carried the correct pattern — one exit handler for all of them, because the per-directory form trips
  node's ten-listener limit — **and a comment recording that a defect in an exemplar becomes a defect in
  a family.** This file proved that from the other side by not being modelled on it. Now zero leak,
  measured across a full run.
- **The same test monkey-patched `fs.writeFileSync` globally.** Correct today, because tests within a
  file run sequentially — but that makes the suite's correctness rest on a scheduling property no
  assertion states. Moved to `t.mock.method`, which scopes the substitution to the test and restores it
  even when an assertion throws first.

**Round 4, one THREAD — the most serious finding on this pull request, and I nearly missed it.** `collisions()`
used `existsSync`/`statSync`, and **both follow symlinks**. So a repository containing a `.portulan`
symlink took the entire drafted workspace *out of the repository*: measured, **nine files written into
an unrelated directory, reported as success**. The refusal that exists to protect a curated layer walked
straight through the one arrangement that defeats it. `lstatSync` now, with a symlink anywhere on the
chain treated as a collision rather than resolved and permitted — resolving it would mean judging
whether a destination is "really" inside the repository, which is a containment judgement with a bad
failure mode, where refusing has none. `doctor` and `plugin-lint` already held this rule; it arrived
late at the one tool that **writes**, where it matters most.

**How it was nearly missed is worth more than the fix.** I checked round 4 for new inline comments
filtered on the login `Copilot` — and this thread is authored by `copilot-pull-request-reviewer`. **One
actor, two logins**, depending on which endpoint you ask; the filter I reached for was the wrong one, and
the round looked empty because the sweep asked the wrong question rather than because there was nothing
there. **Sweep threads via GraphQL `reviewThreads`, never by filtering `/pulls/N/comments` on an author
name.** The rule this repository already had — survey *both* channels — is not enough on its own if the
survey of one of them is keyed on a name that endpoint does not use.

Fixing the escape also made the refusal unreadable — one symlinked `.portulan` blocks all ten drafted
files, and the message named the same cause ten times. Grouped by cause now: a refusal nobody finishes
reading is a refusal that failed to explain.

**Round 5, one suppressed note, real: options accepted and then ignored.** `--feed` and `--governed-by`
were accepted with `--residence in-repo`; `--pack-root`, `--checkpoints` and `--no-cycle` with
`--residence pointer`. All silently dropped — in a file whose header says it *refuses rather than
emitting what it cannot act on*. Same class as `--summary ""` reaching a manifest: an answer accepted and
then not honoured, leaving a caller to believe an option had an effect it never had. Refused now, keyed
on what was **given** rather than on the resolved value, because `cycle` and `checkpoints` have defaults
and a default that tripped the refusal would be the tool objecting to its own choice. One existing test
had asserted the *harmlessness* of exactly this — it passed `--pack-root` beside a pointer and checked
the manifest came out clean, which it did, by ignoring the flag. That assertion moved from "harmless" to
"refused".

**Round 6, one thread: the same escape from the READ side, which round 4's fix did not close.**
`residenceAt` used `existsSync`/`readFileSync` and ran *before* the symlink-aware collision check — so a
`.portulan` symlink pointing at somebody else's workspace made `init` read a manifest **outside the
repository** and announce *"this repository already carries a `repository` workspace"*, naming a
workspace that is not in this repository at all. An out-of-repo read and a refusal that misdescribed
what it found, in one sentence.

**The lesson is about the shape of the round-4 fix, not about symlinks.** Guarding the write path left
the guarantee reachable only when the read path happened not to fire first — and *a guarantee that
depends on which check runs first is not a guarantee*. `residenceAt` now walks `.portulan` and
`workspace.json` with `lstatSync` before it reads anything, and reports `symlink` as its own state.
**This is the sibling class this repository already has a rule for** ([#91](https://github.com/sleepy-panda-works/portulan/issues/91)'s
shape: a fix that misses its siblings), and the sibling here was one function away.

**Round 7, a thread and a note that are one defect in two places: both walkers read *any* `lstat`
failure as "absent".** Only `ENOENT` means nothing is there; `EACCES` means the question could not be
answered, and answering *no residence here* to an unanswerable question is **"nothing looked" recorded
as "nothing wrong"** — the fail-open this repository names more often than any other, arriving inside
the two functions whose entire job is to refuse before the first byte. `ENOENT` alone is absence now;
everything else refuses.

Fixing it immediately produced the round-6 defect one layer out: the refusal told a user with a
permissions problem to **repair their JSON**. A refusal that misdescribes what it found is worth less
than no refusal, because it sends the reader somewhere real and wrong. `residenceAt` now carries *which
kind* of unreadable it met, and the two cases get different sentences.

**Round 8, one note, minor and still real.** The usage-screen test's `find` returns `undefined` when the
formatting moves, and `assert.doesNotMatch(undefined, …)` throws a **TypeError** — a failure that tells
the next reader about assert's argument checking rather than about the missing line. An `assert.ok` in
front of it. Small, and it is the same principle as everything above: a check whose failure does not say
what is wrong has spent its cost without buying the thing checks are for.

**Why rounds 3–8 were fixed rather than triaged:** every one is a defect this pull request introduced.
Round 3's first was a false claim in a comment; round 4's was a write outside the repository; round 5's
was the module contradicting its own stated stance; round 6's was round 4's own fix, incomplete; round 7's was a fail-open in both walkers at once. The
bound exists to stop the loop growing on *new* input. It was never meant to let a session ship its own
falsehood, its own escape, its own contradiction, or its own half-fix because the counter ran out.
**What would be triaged is the first finding that is not this change's fault** — and none of the eight was.

## The four rulings this session opened with

All to the maintainer, before a file was written, and all answered.

- **The Stop-gate runner: not this session.** Clause (a) wants the session-end gate *wired*, and
  `cli/compile.mjs` emits a `Stop` hook naming `.portulan/compile/stop.mjs` — a 414-line file that ships
  in no artifact an adopter receives (`files` is `cli/ core/ spec/ packs/`; `npm pack` carries no
  `.portulan/`). **Measured, not inferred:** compiling the drafted policy in a scratch repository emits
  that hook, and `.portulan/compile/` then contains `github-ruleset.json` and nothing else. A missing
  hook fails open. He ruled decide-when-real — the same posture he took on the switch's verb — so the
  draft **binds** the ritual and the records conventions and **names where the wire arrives**.
  **Clause (a) is therefore partly owed, and this session does not claim it.**
- **The interview: decide at close.** What ships is the substrate — flags and `--answers` — because a
  prompt loop cannot be run by CI, by a test, or by a headless host. Whether that satisfies
  `docs/vision.md`'s *interview + codebase scan* is his call when the demonstration is actually run.
- **[#150](https://github.com/sleepy-panda-works/portulan/issues/150) and
  [#151](https://github.com/sleepy-panda-works/portulan/issues/151): both stay open.** Neither moves
  this session — see the correction below.

## The stale referent, corrected rather than repeated

**#150 does not move session 1's scope, and three carriers said it did.** #150 says "the *next* session
takes `doctor`'s validation half"; the previous handoff's closing line says the validation-scope
question "moves **session 1's** own scope". Both were true under session 0's original plan — package
**and** `init` in session 0, validation next — and both went stale when session 0 under-delivered and
`init` slid to session 1. The material point: **#150 changes what `doctor` must *validate*, never what
`init` must *emit***, and today's `doctor` is the demonstration instrument either way. So the answer is
owed before the doctor-validation session opens, and owed by nothing here. Caught by the session-open
checkpoint, which refused to let the plan carry the sentence forward verbatim.

## The defect the demonstration caught and a reading could not

**The drafted gate policy parsed cleanly and compiled to a floor no rule reached.** The first draft
gated `gh pr merge` and declared a floor on `main`; `compile.mjs` refuses a floor no rule reaches, and
`doctor` surfaced it as a **FAIL on the adopter's very first run** — a red they did not cause, in the
artifact meant to welcome them. The fix is two Gated ref rules (`git push --force`, `git push --delete`)
which are the two the floor backend can express, and which are the right two to start with anyway: both
destroy a ref rather than adding one.

**The test that missed it asserted `parse()`.** Parsing is not the bar — a policy can parse and still be
refused by a backend. The test now exercises **both backends**, and the group that found it in the first
place is the one that runs the real `doctor` against real directories. *Read the tool, and you check
what it says; run it, and you check what it does.* Same lesson as session 0's symlink, one layer out.

## Decisions a later session would otherwise re-derive

- **`init` has no exit 1, and that is deliberate.** It renders no verdict about anybody's workspace, so
  it has no red to report. Two codes: 0 wrote, 2 could not run.
- **`tree: "../"` is not optional.** `doctor` fails a `repository` workspace that omits it — a
  constraint that lives in `doctor` rather than the schema, because the declared subset has no
  `dependentRequired`. Exactly the kind a generator forgets, and it is asserted.
- **The drafted floor declares no `checks`, on purpose.** `doctor` FAILS a floor requiring a status
  check no workflow job reports. A fresh repository reports none, and a real one reports something else,
  so any name drafted here is a red somebody did not cause. The consequence is named in the drafted gate
  map: with no checks declared, every Propose rule compiles to nothing in that backend.
- **The drafted verify recipe exits 2 and must keep exiting 2.** The adopter has not said what green
  means for their repository. A stub exiting 0 would put a false green under every gate on the day the
  workspace was created — `verify-preconditions-fail-closed.md`, arriving through the onboarding path.
- **Absent and invalid are different answers.** `--governed-by ""` was *given*, so telling the adopter
  to pass the flag they just passed sends them to the wrong place. It takes the slug refusal, which
  also keeps `init` from ever emitting the shape
  [#141](https://github.com/sleepy-panda-works/portulan/issues/141) still mis-reports.
- **An unreadable manifest is could-not-run, never a licence to overwrite.** Reading a parse failure as
  "no workspace here" would make a corrupt policy layer the one case this tool overwrites — the case
  where it knows least and overwriting costs most.

## Swept, because the change made them untrue

`cli/portulan.mjs` (four counts in its own prose), `cli/portulan.test.mjs` (the unbuilt loop, and a
literal `3` that became wrong the hour `init` shipped — now derived from `SUBCOMMANDS`), `cli/README.md`
(head, table, usage block, exit codes), `.portulan/identity.md` (two rows, and eight test files → nine),
`README.md`, `.portulan/repos/portulan.md`, `CHANGELOG.md`, `spec/README.md`.

**One was false before this session touched anything.** `plugin/skills/portulan/SKILL.md` told every
booting agent *"There is no CLI, so nothing drafts a workspace"*, and listed `compile` and `index` as
arriving later — they shipped at milestones 4 and 5, and the entry point at milestone 7. It contradicted
`README.md` and the CHANGELOG on `main`. Found by the session-open sweep, which is the only instrument
that catches this class; fixed here, with what it said recorded in place.

## The default draft is RED under a plain `doctor` — put to the maintainer, and ruled

Clause (a) says the checkpoint binding is **opt-out**, so `init` composes a pack by default. Nothing
resolves a pack ([#123](https://github.com/sleepy-panda-works/portulan/issues/123)), and `doctor`
**fails** a declared pack it cannot resolve rather than reporting it unverifiable — so the adopter's
literal next command after `init` is red, on a workspace the tool just wrote.

**What this session did about it:** said so, loudly, in both places the adopter looks — the run prints
the exact `doctor --pack-root <dir>` line before it exits, and the drafted README names the state as
**RED** rather than as merely unchecked. The first draft of that sentence said "validation takes the
pack's location as an argument", which is true and understates what happens when you do not give one.

**Ruled 2026-07-31: keep composing, keep it loud.** Put to the maintainer with two alternatives — compose
only when a root resolves, or refuse to run without either `--pack-root` or `--no-cycle` — both of which
would have made every draft green on a plain `doctor`. He took neither, on the ground the question was
framed around: clause (a) says *out of the box, opt-out*, and both alternatives narrow that to *out of
the box when you can point at the pack*, which is a criterion change. **So the red stays and the tool's
job is to predict it rather than to avoid it.** The cost is named rather than designed away: an adopter
who ignores three lines of output gets a red first run. It closes when discovery does
([#123](https://github.com/sleepy-panda-works/portulan/issues/123)) — at which point this becomes an
ordinary green and no criterion moved to get there.

**Ruled the same day: a `.portulan/` with files and no manifest is NOT a residence, and is still never
written over.** The two questions keep separate keys — *is this repository governed?* on the manifest,
*is it safe to write here?* on every path the draft touches. The alternatives he declined were treating
any non-empty `.portulan/` as an adopted workspace (which would call something a residence that carries
no manifest — a claim the tree cannot support) and adding a `--force`/`--merge` escape (*"a flag that
overwrites files is the flag that eventually overwrites the wrong ones"*). A person clears the directory
and re-runs; nothing is destroyed to save them a step.

## Undemonstrated, named

- **Clause (a)'s wire.** The binding is drafted; the session-end gate is not enforceable in a drafted
  workspace, and the drafted README says so rather than implying otherwise.
- **The handoff-index freshness rail.** The manifest declares where the index goes; no index is written,
  and no recipe compares it. The obstacle is not the session-end gate's — `cli/index.mjs` ships and
  generates it — it is that a drafted recipe has no stable spelling for invoking the CLI before the
  package publishes ([#148](https://github.com/sleepy-panda-works/portulan/issues/148)). The drafted
  README now says the index **does not exist yet**; the first cut described it in the present tense.
- **Row 7's four demonstrations are unrun.** In particular *a never-seen repo onboards to a validated
  workspace in one afternoon* — what is shown here is that a scratch directory onboards to a workspace
  `doctor` calls green, which is the floor beneath that demonstration and not the demonstration.
- **Nothing resolves the composed pack.** `init` names one and, given `--pack-root`, refuses to bind one
  that is not there. Discovery is still [#123](https://github.com/sleepy-panda-works/portulan/issues/123).
- **The scan is shallow by choice.** `package.json` scripts, Makefile targets, and presence-only for
  four other ecosystems. Everything else is written down as *not determined*, because an invented build
  command is a workspace that disagrees with its repository on the day it was created.

## What the compose-default ruling costs elsewhere, named rather than absorbed

**It raises [#123](https://github.com/sleepy-panda-works/portulan/issues/123)'s practical priority.**
Discovery was a convenience while nothing composed a pack by default; now every workspace `init` writes
is red until someone names a root, so the issue that closes it is on the critical path of the row's own
first demonstration — *a never-seen repo onboards to a validated workspace in one afternoon*. Nothing
about #123 changed; what changed is who is waiting on it. Worth knowing before that demonstration is
scheduled rather than during it.

**And the adopter's first run is now the house ritual, which is the reading worth keeping.** A red that
prints the exact line which turns it green is red→green with the workspace itself as the subject. That
is not a defence of the red — it is why the red is affordable while discovery is open, and it stops
being affordable the moment an adopter meets it without the line.

## What session 2 picks up

`doctor`'s validation half — **read [#150](https://github.com/sleepy-panda-works/portulan/issues/150)
first, it is that session's scope question and it is still open** — plus `new` and the legibility score.
`vendor`, the residence switch, `upgrade`, `feedback` and the demonstrations follow. The switch still
owes a verb, on the same decide-when-real footing, and so does the Stop-gate runner's residence.

**Contingent, and worth scoping before it surprises the close: the interactive interview.** The gloss
question was deferred to milestone 7's close, and the likeliest reading there is that *interview + codebase
scan* means a human at a TTY — because the demonstration the close measures is *a never-seen repo onboards
in one afternoon*, which is a claim about a person's experience rather than about a flag surface. **Plan
the prompt loop as session-2 work contingent on that reading** rather than discovering the obligation at
the close. The substrate is built and an interview drives it; what is missing is the loop, not the answers.

**Also on a clock: [#151](https://github.com/sleepy-panda-works/portulan/issues/151).**
`core/operating/verification.md:47-48` names milestone 7 for the Stop-gate's repo-card and task
resolution steps, and no row carries them — so if M7 closes with the steps unbuilt **and** the sentence
unreworded, the close reds it under dod condition 4, in the file whose own subject is condition 4. It
must resolve **before the M7 close checkpoint**, either way round. Recorded on the issue itself on the
maintainer's instruction, so the deadline travels with the thing it constrains.
