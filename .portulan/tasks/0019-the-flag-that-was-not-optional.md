# Task 0019 — the flag that was not optional

**Lane:** full · **Opened:** 2026-08-13 · **Verify recipe:** `tests` · **Status:** IN REVIEW

> The ruled disposal of milestone 7's one REQUEST-CHANGES. Row 7 says discovery makes `--pack-root` and
> its siblings **"optional where discovery finds a root"**; it was not. The maintainer ruled a
> **behaviour change rather than a row amendment** — the row's word stands and the implementation meets
> it.

## What was measured, before anything was changed

On the workspace `portulan init` drafts by default (`--residence in-repo`, composing
`rituals/checkpoints`) plus one pack of the adopter's own (`new pack --category tools --into packs
mine`, composed into `packs`). Host: `portulan-checkpoints@portulan-internal 0.2.0` installed, flat
shape, record readable.

| tool, unasked | exit | what happened | with `--pack-root auto` |
|---|---|---|---|
| `doctor <ws>` | **1** | `rituals/checkpoints` FAILS; `tools/mine` resolves | **0 GREEN**, both resolve, each naming its root |
| `recipe-set --workspace <ws>` | **2** | could-not-run: the composed pack's recipes could not be read | **0**, 2 recipes |
| `skills-set --check --workspace <ws>` | **2** | could-not-run | 1 — a drift *report* |
| `compile --workspace <adopter>` | 0 | pack **UNRESOLVED, contributes nothing** — its **2 gate fragments** absent from the compiled policy | 0, fragments composed |
| `index --check <ws>` | 0 | (this draft has no composed persona in the index) | 0 |

**Three of five tools were unusable unasked, two of them at a hard refusal.** The close's own sentence
named `doctor`'s red; the clause was violated more broadly than that. And clause (a) of the row says the
drafted workspace **binds a checkpoint ritual** — the `compile` row is that binding composing into
nothing.

**A second defect the same measurement found, which nobody was looking for.** `doctor examples` exited
**0** and `doctor --pack-root auto examples` exited **1**. `examples` declares no `tree`, so it derives
no root; `doctor` FAILED an unresolved pack whenever `roots.length > 0`, and a discovered root satisfied
that. So the count-based key **already** let host state flip a workspace's verdict, before this change
existed. Making discovery the default would have moved that flip onto the bare invocation — red on a
laptop, green in CI.

## The three changes

**1. `resolutionRoots`' unasked arm consults a wired `discovery` thunk** and returns the union,
discovered-first, tagging `origins` as the forced branch does. **One union order, built once**, reached
from both arms — two orders keyed on whether a flag was typed would make the flag change the *meaning*
of resolution rather than its inputs, and two matching literals are a convention while one function is a
guarantee.

**The asymmetry between the arms is the whole reason they are two.** Asked-and-could-not-look stays
**could-not-run, exit 2** (ruled 2026-08-13, [`0018`](0018-discovery-that-could-not-look-is-not-a-green.md)).
Unasked-and-could-not-look **degrades to derived-only with the diagnostic reported** — never an empty
set, never exit 2 — because nobody asked, so the readability of a host's record cannot be a precondition
for grading a repository. Reusing the `forced` branch as the unasked default was the one implementation
that had to be avoided: it would have made every CI runner exit 2, or hand it an empty root set and go
green by not looking, which is the fail-open the previous session spent itself closing.

**The switch is the thunk's presence**, not a second flag. An API caller wiring none keeps the hermetic
behaviour on every arm. A per-tool opt-out was considered and refused: it would be a second carrier of
the precedence rule — the three-tools-two-semantics defect `cli/compile.mjs`'s `namedRootsOption`
records — and **it could not reach `vendor` at all**, which never builds a plan.

**2. `doctor`'s fail/note distinction is re-keyed on a root's ORIGIN.** FAIL only where a
**named-or-derived** root exists — a root the caller or the workspace claimed. Where only **discovered**
roots exist, or none, an unresolved pack is a **note**. So discovery may turn a note into a resolution
and **never a miss into a failure**. A *hit* is graded whatever its origin, and a resolved-but-invalid
copy fails with its origin named, because that is a claim the pack's own files make.

The note gained a second sentence: *"there is no packs root to search"* is false for a discovered-only
miss — there was one, and it was looked in. `stats.unverifiable` still counts it, because the pack
genuinely was not graded and a check class that disappears in silence is what that counter exists
against.

**3. `init`'s resolvability check and closing advice consult discovery unasked**, so the check keeps
predicting the `doctor` run that follows the draft. Two things about `init` are not negotiable and are
implemented as such:

- **On the unasked path a pack that does not resolve is ADVICE, never a refusal.** `init` drafting on one
  host and refusing on another would make the *existence of files* a function of the machine. Named and
  `auto` keep their refusals: a caller who said where to look and was wrong is owed one.
- **The drafted files are byte-identical on every host** — advice may vary, files may not, which is
  [`../../docs/vision.md`](../../docs/vision.md)'s *no auto-generated curated context*. Hashed over every
  drafted file on a host carrying the pack and one without.

**And the advice names the residence that actually answered.** It claimed the host's plugin cache for
every unasked resolution, including one that came out of `<repo>/packs` — found by trying to write the
test for the degrade, not by reading the branch. Where the pack came from the cache it also says so:
*that root is this machine's, not the repository's — pin `--pack-root <dir>` in CI.*

## What the session-open checkpoint found that the plan had not

A fresh Fable 5 context returned **APPROVE-WITH-ADJUSTMENTS (9)**, ruled all three questions put to it,
and found four things the plan missed. All nine were folded, the optional ones included.

- **`vendor` is a SIXTH tool**, and it acquired the new behaviour without a line of it being edited:
  `verdict()` calls `doctor`'s `inspect`, which builds its own plan and wires its own thunk. It passed no
  `env`, so every vendor run — the suite's included — would have read the real machine. Plumbed, at
  **both** `verdict` call sites: the old-residence one was a bare `{}` and is exactly the sibling a fix
  at one site leaves standing.
- **`init`'s call-site gate** (`answers.packRoots.length`) made the new arm **dead code**. Dropped.
- **Three more stale sentences** the plan's grep did not match: `cli/compile.mjs` twice and
  `cli/discover.mjs` once, all three claiming the thunk is what keeps `compile --check` host-independent.
- **A fourth test pinning the behaviour under disposal**, and a sweep of every host-injecting test before
  any code changed.
- **The CHANGELOG lines I called per-release records are all inside `## Unreleased`.** One of them states
  a *current property* that would have shipped false in its own release section. Amended in place.

## The seam nobody had asked for: the suite was reading the machine

**Measured rather than reasoned about.** After the change landed, the full suite was run twice — once
against the real `CLAUDE_CONFIG_DIR`, once against another — and the failure lists were **diffed**. Nine
cases failed only on the maintainer's machine. They are tests whose fixtures declare a pack the host
happens to carry, and every one of them would have passed or failed by accident of inventory.

**Only `doctor` had an injection seam; six other call sites read `process.env` directly.** Threading
`env` through all of them was tried and **reverted at five**: no test reached those parameters, and a
parameter that reads as a capability and has no caller is the defect this repository has been bitten by
twice ([`0014`](0014-the-registrable-set.md), and `recipe-set`'s own `discovery`/`forced` pair). `env`
is kept where a test uses it — `doctor` (pre-existing), `init`, `vendor`.

**The containment is a rail rather than diligence.** One line per test file pointing
`CLAUDE_CONFIG_DIR` at an empty directory that *exists* — so discovery **answers** `absent` rather than
being unable to look — plus a sweep in
[`../../cli/pinned-roots.live.test.mjs`](../../cli/pinned-roots.live.test.mjs) over the **derived**
closure of test files whose tool can reach the record. Derived, because a hand-written list would have
held the five obvious files and missed `upgrade` and `vendor`, which never mention discovery. With the
guards in place the two-host comparison returns **identical** failure lists.

## What this does NOT do

- **It does not certify provenance, and `auto` stopped doing that on 2026-08-12.** Each pack's resolution
  names the root that answered and whether it was discovered or derived; a green certifies resolution.
- **It writes no adopter's CI.** A workspace composing a cache-installed pack resolves it on a developer's
  machine and reports it unresolved on a runner with nothing installed. `init` now says so beside the
  green, which is new; pinning is still the adopter's call.
- **`--repo-root` stays named-only.** No plugin record lists a repository checkout.
- **The plugin version is NOT bumped**, and the staleness window is stated rather than closed: **20
  commits** have edited `plugin/skills/portulan/SKILL.md` since `0.2.0` was cut and none bumped it,
  because the plugin version is this repository's *release* number — railed against `package.json` and
  two `marketplace.json` fields by [`../../cli/portulan.test.mjs`](../../cli/portulan.test.mjs) and
  renamed only at a cut. The checkpoints-pack precedent is a **pack** version, which is independent. So
  an install pinned at `0.2.0` keeps the old sentence until a release is cut. Ruled by the maintainer on
  that measurement.
- **Nothing is fetched, the pointer half is untouched, `stop-gate` still passes `packs: []`**, and the
  named+`auto` refusal still fires at parse time and in the resolver.

## Tests, and the harness that graded them

**17 of 17 properties mutation-tested**: each reverted in turn, with the cases it must break named in
advance, and the harness failing if the suite stayed green *or* if **none** of the named cases broke.

**Its pass criterion is *at least one* named case, not all of them, and that is worth stating because a
reader would infer the stronger rule.** Two entries hit one of two names and passed — legitimately, since
a mutation reverting a shared branch reds whichever consumer reaches it first — but the criterion is the
looser one and the harness prints which names were and were not hit on every run, so the slack is visible
rather than implied. Raised as not-covered by the re-check on the frozen diff.

It found four things:

- **Three properties nothing was binding.** `init`'s unasked degrade keeping the derived root; the advice
  naming the right residence; and — recorded rather than repaired — **vendor's old-residence `env`, which
  no test can bind**, because a pointer's resolution is deliberately *reported and never graded* and
  `verdict()` discards notes. Kept for the sibling rule; priced as unbound, out loud.
- **A harness that failed to bind its own subject.** It matched only column-zero TAP `not ok` lines, so
  every case inside a `describe` reported its parent's name and nine mutations looked unbound.
- **A mutation whose premise was wrong.** The closure test severed `librarian.mjs`'s import of
  `index.mjs`, but librarian imports `doctor.mjs` too — both direct members — so nothing changed. The
  route count of every second-hop member was then *measured*, and `stop-gate.mjs` used instead, which has
  exactly one.
- **An assertion that cannot be forced red and is labelled as such.** `recipe-set`'s *no thunk, nothing
  discovered* is a tautology in a hermetic environment. The binding version lives at the resolver; this
  one states the contract where an API caller reads it, and says so rather than being counted twice.

**Four existing tests pinned the behaviour under disposal and are rewritten into the property they were
reaching for, never deleted** — session 12's lesson about a case that pinned a collapse:

- `discover.test.mjs`'s two spy cases → the **no-thunk hermetic** case, which is what they were
  protecting, plus the new unasked-union case.
- `doctor.test.mjs`'s *"the four arrangements"* → three arrangements, because two are now one answer.
- `doctor.test.mjs`'s *"a malformed host record cannot reach an unasked run's verdict"* → **the property
  survives and its mechanism inverts**: it held because nothing read the record, and now holds because the
  read degrades *while saying so*. The assertion that the diagnostic is absent became the assertion that
  it is present.

**One discriminator was measured against the path it must exclude** before being trusted:
`Discovery could not look`, not `could not be read`, which appears in the unresolvable-pack sentence too
— the defect this repository has now committed three times.

## What the pre-commit checkpoint found — A-W-A (5), all five folded

- **must-fix: the rail I added against `0020` had `0020`'s defect.** The hermetic sweep mapped
  `<module>.mjs` → `<module>.test.mjs`, which **structurally cannot see a `.live.test.mjs` sibling**, and
  `cli/upgrade.live.test.mjs` was reading the real machine through the new unasked arm — traced
  `upgrade.run` → `doctor`'s `inspect` → `resolutionRoots` → `readInstalls` — while the file's own header
  claimed the sweep would catch exactly that. Membership is derived from the test file's **imports** now,
  which adds four files the filename mapping could not reach and loses none. **The import test is
  line-anchored**, because a substring match made `pinned-roots.live.test.mjs` a member of its own
  closure: it contains the literal `from "./recipe-set.mjs"` as the *data* for the case that severs it —
  an instrument counting its own test data as evidence.

  **And the line anchor was wrong in the other direction, which is the third spelling of this one
  predicate.** Anchored to a single line it silently dropped `compile.test.mjs`, `doctor.test.mjs` and
  `index.test.mjs` — the three whose imports are **multi-line**, and the three that matter most — while
  the sweep stayed green, because those files were guarded anyway. **A rail can lose its most important
  members and report nothing.** Caught by re-running the mutation harness after the fold: removing a
  guard no longer red the sweep. Bounded by the statement's semicolon now, which satisfies both
  directions at once, and the count assertion (`>= 10`, satisfied by a set missing all three) is joined
  by naming the four members whose absence a count could hide.
- **must-fix: a prose overclaim in three carriers, and my sibling sweep found a fourth.** *"Two things
  keep a verdict about the repository off the machine"* is false in two corners the supervisor measured:
  a **bare** run's verdict does move with the host — by design, since `doctor` is a per-host capability
  report — and a discovered copy that resolves and is **invalid** reds a bare run, because origin decides
  whether a *miss* fails, not whether a *hit* is graded. Narrowed in `CHANGELOG.md`,
  `plugin/skills/portulan/SKILL.md`, `cli/README.md` and — the fourth, found by grepping for the claim
  rather than trusting the list — `spec/README.md`'s capability row.
- **optional: `compile`'s union line on the unasked path was unbound.** "Never silently" is the union's
  whole justification and `--check` reaches the union now, so the missing assertion was the one that
  mattered most. Writing it exposed a second thing: **the two arms reach `union()` differently.** `forced`
  unions even when discovery found nothing — you asked, and *nothing installed* is the answer — while the
  unasked arm returns `derived` and puts discovery's sentence in the `why`. The first fixture had an empty
  cache, so it passed the asked half and bound nothing on the unasked one. Recorded in `discover.mjs`.
- **optional: `init`'s `expandRoots` is a second carrier of the precedence rule**, beside
  `resolutionRoots`. Pre-existing, and both were updated consistently here — but the mutation harness
  shows it: reverting the unasked arm in `resolutionRoots` leaves `init`'s cases green, because `init`
  spells its own. It is the class
  [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names and the shape it filed
  [#169](https://github.com/sleepy-panda-works/portulan/issues/169) for — three `collisions()` that cannot
  be merged in the change that found them. Recorded here rather than repaired, because merging two
  resolvers is its own change; **and recorded as a pointer to that issue's class rather than to a
  "ledger", which was the first wording and names a register 0020 does not keep** — it is an accepted
  proposal with a Decision, not a running list.
- **optional: the handoff attested a seam scan over "the commit message"** while nothing was committed
  and no message existed as a scannable artifact. Reworded — and the first rewording said the scan
  *had been* re-run on the message, which was the same claim in the past tense. Both carriers now state it
  forward: the diff and the branch are scanned and clean; the message is scanned when it is written, which
  is the only order the facts allow.

## The Copilot loop

**Round 1 — one finding, taken, and it is this change's own class again.** `discoverPackRoots` returns
`why: null` on its ordinary success path — a record that **read fine** and simply lists no plugin
carrying packs, which is any host with plugins installed and no pack feed among them. The unasked arm
appended it unguarded, so `plan.why` rendered *"discovery was consulted and found no root — null"* and
carried that into `doctor`'s resolution-root note and every unresolved-pack line beneath it.

**The `union` helper one screen above guards exactly this** — `found.roots.length === 0 && found.why` —
and the arm below it did not. One operation, two sites, correct at one, in the change whose own subject
is that class. Reproduced on both unasked arms before fixing, and the guard is now a single `said()`
helper so the two sentences cannot diverge again.

**Nothing else in the diff shares it, and that was checked rather than assumed**: every `plan.why`
interpolation is safe because every `plan(...)` call in `resolutionRoots` passes a non-null string, and
`read.detail` was already guarded at its one site. The new case asserts on **`null` not appearing**
rather than on the rendered sentence, because matching the word would also match a diagnostic that
legitimately contained it.

**Round 2 — nothing inline, and three suppressed notes carrying one finding.** All three arrived through
the promoted-note channel ([`0021`](../proposals/0021-the-suppressed-channel-needs-a-state.md)), which is
that proposal earning its keep again: the inline round was empty and the finding was real.

**The hermetic guard created a temp directory per test file and nothing removed it.** Measured before
fixing: **18 leaked directories per full suite run**, and **4,288** accumulated in this one session —
the notes said "temp dirs on developer machines" and the machine already had four thousand of them.
Copilot named **three** files; the fix is at **all eighteen**, which is the difference between answering
a note and answering the class it is an instance of. Verified by measurement rather than by reading: a
full suite run now moves the count by **0**.

The cleanup is part of the block the sweep asserts, so the next test file cannot copy the two lines that
neutralise the host and drop the one that tidies up — and the path is captured in a `const` rather than
re-read from `process.env` at exit, because several suites save, overwrite and restore that variable
around a case and a handler reading it at exit would remove whatever happened to be there.

_(Rewriting the guard across eighteen files also rewrote **the rail's own `HERMETIC` constant**, whose
value was that same line, turning a single-quoted literal into an invalid multi-line one. Caught
immediately by `node --check`. A mechanical sweep over `cli/*.test.mjs` does not know which occurrence is
the subject and which is the *description* of the subject — the third time in this change that an
instrument could not tell code from prose about code.)_

**Out of scope and filed rather than fixed:** the same measurement found **28,484** `portulan-feedback-*`
temp directories, **7,477 of them older than today** — a long-standing leak in `cli/feedback.test.mjs`
that this change neither caused nor touches. Reported to the maintainer rather than folded in.

## A defect of mine the repository's own rail caught

Two **control characters** — a NUL and a SOH — reached `cli/init.test.mjs` through an edit of mine, as
separators in a digest that were meant to be text. The `control-chars` recipe found both. Recorded rather
than tidied away, because it is the cleanest instance available of a rail catching what review would not:
neither byte is visible in a diff.
