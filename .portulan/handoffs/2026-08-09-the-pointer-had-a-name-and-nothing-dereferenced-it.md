# Handoff — the pointer had a name and nothing dereferenced it

**Milestone 7, session 5.** Issue [#134](https://github.com/sleepy-panda-works/portulan/issues/134)'s
still-open half: *a feed-installed workspace is invisible to `/portulan`*. The other half — *a workspace
cannot inherit another* — was answered by proposal
[`0017`](../proposals/0017-one-repository-one-governing-workspace.md) and the `pointer` kind at Workspace
Definition 2.7. **M7 stays open**; this session lands one of its outstanding deliverables (row 7's
2026-08-03 amendment, the pointer half) and touches none of the other five.

## What was wrong, and why it was invisible

The repository said which workspace governs it — `kind: pointer`, `governed_by.workspace`,
`governed_by.feed` — and **nothing anywhere turned that name into a directory.** The boot skill said so
in as many words: *"Do not fetch it… nothing here discovers one."* `doctor` said the same:
*"the roots are named rather than found (milestone 7)."* Both sentences were true when written. The
consequence was that a workspace **installed on the machine** was invisible to the thing booting beside
it, and the boot's honest report was *not installed here* about something that was.

## The shape, which row 7 fixed and this session did not choose

Row 7's 2026-08-03 amendment: *"the boot is a skill, and real resolution stays the CLI's."* So resolution
is `cli/discover.mjs` and the boot reports its answer. **No ninth `portulan` subcommand** —
`docs/vision.md` names eight and is human-owned — so the resolver sits beside `plugin-lint` and
`librarian` as a tool that runs from `cli/` and is deliberately absent from the entry point's list.

**Four verdicts, because three of them are not *no*.** `resolved` · `not-installed` · `ambiguous` (two
or more installs answering to one name: **refused and both named**, never ranked) · `could-not-look` (a
record that would not parse). A resolver with two answers spends *could not look* as *not installed*,
which is the fail-open this repository keeps minting rules about.

**Three limits, asserted rather than written down.** The match is on the **governing manifest's `name`**,
never a plugin's — the two agreeing on this machine is a coincidence of naming, not a contract. The
candidate locations inside a payload are a **named pair** (`workspace.json`, `.portulan/workspace.json`)
rather than a walk — which is what keeps the demo and the deliberately-drifted fixture out of reach *by
construction*, since neither sits at one, so step 2's guard is not weakened by the exception. _(Stated
precisely, because the checkpoint caught the loose version: this bundle's **own** `.portulan/` **is** in
reach wherever the plugin is installed. That is the correct answer to a pointer naming `portulan` rather
than a hole — but *"all three manifests stay out of reach"* would have been a stronger claim than the
mechanism makes.)_ And **nothing is fetched**: the record is read from disk and no path here touches the
network.

**Reported, never graded.** No discovery outcome moves `doctor`'s exit code, and a test asserts all four.
A pointer whose governor is uninstalled is a *correct* pointer — a fresh clone is in exactly that state,
and so is every CI run — so failing there would red an honest manifest and make a verdict about a
workspace into a fact about somebody's laptop.

**`--pack-root` is deliberately NOT defaulted from the same record.** That is
[#123](https://github.com/sleepy-panda-works/portulan/issues/123)'s half: it changes what a `packs` array
resolves against on every existing run, and #117 established that a **named root replaces** the derived
one, so *"this pack resolved from the feed"* cannot be satisfied by a copy in the local tree. The row
fixes the only safe direction — add a root where none was named, never replace one that was — and this
change adds no root at all.

## Demonstrated, not asserted — the red first

1. **The red.** A throwaway worktree at `46e7b81`, the same scratch pointer, this machine — where the
   governing workspace **is** installed. `doctor` printed *"the roots are named rather than found"*, and
   `cli/discover.mjs` did not exist at that commit.
2. **The seam.** On the branch, `node cli/discover.mjs --json <pointer dir>` returned `state: resolved`
   against the **real** `~/.claude/plugins/installed_plugins.json`, naming the install root, the plugin,
   the marketplace and the pinned version. `doctor` on the same pointer printed the same answer and
   stayed GREEN; `doctor` against the resolved root graded the workspace itself GREEN.
3. **A real `/portulan` boot.** Headless, from the scratch pointer repository, with the plugin loaded
   from this working copy (`--plugin-dir`) so the payload under test was the change rather than a
   published one. It resolved the pointer, loaded the governing workspace's **identity, principles, gate
   map and definition of done**, named the plugin and its **pinned version**, named the resolved
   manifest's **spec MINOR skew** against this bundle's, **selected the repo card for the repository it
   booted in** rather than reading the directory, and reported the workspace's declared pack as **still
   unresolvable** — which is the correct answer and the boundary above, holding. That is the acceptance
   criterion, exercised.

**Every state was run by hand, not only asserted in a suite** — five commands, five exit codes read
without a pipe: `resolved` **0** (the real host), `not-installed` **1** (an empty config dir),
`could-not-look` **2** (a record that will not parse), `ambiguous` **1** (two installs answering to one
name, both printed, neither chosen), and a governing manifest answered rather than refused, **0**. On the
ambiguous host `doctor` on the same pointer still printed **GREEN**, which is the *reported, never
graded* boundary demonstrated rather than argued.

**Nothing was installed into the maintainer's plugin config, and it was read back unchanged afterwards.**
The first attempt used an isolated `CLAUDE_CONFIG_DIR` with a local marketplace added; that config has no
credentials, so the run stopped at *not logged in*. `--plugin-dir` against the real config replaced it,
which needs no install and leaves nothing to remove. The isolated config was deleted regardless.

**One measured aside worth keeping.** A local-directory install records the repository's `gitCommitSha`
while copying the **working tree** — so on that path the recorded SHA is not evidence of the payload. It
is what made the isolated attempt usable at all, and it would be a trap for anyone reading that field as
provenance.

## What is left, and what belongs to the maintainer

- **Two decisions, neither an agent's — and both were ruled on 2026-08-09, hours after this was written.**
  Row 7's clause (b) parenthetical named clause (b) as closing #134 while the same Status cell lists
  `(b) parity` as *Left*; the maintainer licensed an agent to **draft** the narrowing for his review, and
  it is drafted in this change — the parenthetical now closes the **pack-registration half** and points at
  [#184](https://github.com/sleepy-panda-works/portulan/issues/184).

  **#134 was then closed twice, and the first close was wrong.** The first carried the residue honestly to
  #184 and closed on the ruling — and the maintainer refused it: *"I don't want #134 simply closed. I want
  it closed by addressing the issue truthfully."* He was right, and the previous comment was its own
  evidence: it closed an issue while listing two of that issue's bullets as still true. Reopened, then
  answered claim by claim with measurements, then closed on those.

  **What the second pass found is that most of the residue was already addressable, and one part already
  addressed.** `plugin-lint` has failed a skill resolved more than one level below its declared root since
  2026-08-07, naming #134 in its own header as the reason — so the depth trap was a rail and nobody had
  said so on the issue. Reproduced from scratch both ways rather than cited: `./packs/rituals/` gives
  **lint exit 1** and a host inventory of **Skills (0)**; `./packs/rituals/checkpoints/skills/` gives
  **exit 0** and **Skills (3)**. And #134's *false choice* — a working `/portulan` **or** a single policy
  layer — is what the pointer plus discovery removes, by two of the three shapes #134 itself proposed.
  What is left is clause (b) **parity**, which is all #184 now carries.

  _The lesson worth keeping: a residue carried to a new issue reads as diligence and can still be a way of
  not doing the work. The check is whether the closing comment answers the issue's own claims in the
  issue's own order — the first one listed them instead._
- **The Status cell was trimmed to fit its 500-byte rail** — 496 → 478 with `s4` added. What came out:
  *"which found a `compile` parity breach, fixed"* (recorded in session 3's handoff) and *"six is pinned
  in `milestones/m07.md`; this cell said seven"* (recorded in `m07.md`'s own count section, which says in
  as many words that it is the carrier). Nothing lost a home; a cell at 96% of its budget cannot take an
  addition without one.
- **`#123` is untouched and still owed** — a pack root is still named by hand, in either residence, so it
  is not a residence asymmetry.

## State

`discovery-resolves-a-pointer-at-the-boot`. New: `cli/discover.mjs`, `cli/discover.test.mjs`, this
handoff. Changed: `cli/doctor.mjs`, `cli/doctor.test.mjs`, `plugin/skills/portulan/SKILL.md`,
`spec/README.md`, `spec/slots.md`, `spec/workspace.schema.json`, `cli/README.md`,
`.portulan/identity.md`, `.portulan/proposals/0017…`; the carriers and hermeticity the checkpoint found —
`cli/init.mjs`, `cli/index.mjs`, `cli/compile.mjs`, `cli/portulan.mjs` and its suite,
`cli/vendor.test.mjs`, `cli/init.test.mjs`; and the records — `docs/plan.md`, `CHANGELOG.md`,
`.portulan/handoffs-index.md` (regenerated, never hand-edited). Suite `main` **1059** → branch **1103**;
**all nine recipes green**, run individually and read without a pipe. Seam scan clean on diff, message,
branch and paths.

**Eleven carriers denied the capability**, because condition 4 of [`../dod.md`](../dod.md) cuts both
ways: a document *denying* a capability that exists is the same defect as one claiming a capability that
does not. **Ten corrected in place** — the doctor comment, the `cli/README.md` row, the `spec/README.md`
coverage row **and** its residence-parity paragraph, `spec/slots.md`'s *what nothing checks*, the schema's
`governed_by` description, the identity glossary's *checks form, never truth*, and three the pre-commit
checkpoint found by grepping where I had stopped: `cli/index.mjs` and `cli/compile.mjs`'s *"discovery is
deliberately NOT built"* (true of pack roots, unscoped as written), and — the one that **ships**, into
every adopting repository — the drafted pointer README `cli/init.mjs` writes, which told an adopter *"a
host does not discover the governing workspace on its own"*. That site has failed this way before; the
plan's own log records *"three false sentences `init` shipped into every adopter's drafted README"*. The
eleventh is proposal
[`0017`](../proposals/0017-one-repository-one-governing-workspace.md), which named this very asymmetry and
promised its closure; it gets a **dated follow-through note at its Decision** and its body is left exactly
as written, because a proposal is the record of a ruling taken on the state of that day and rewriting it to
suit a later change destroys the record to flatter the rule. `cli/portulan.mjs`'s *"the **two** tools that
are off the list"* was a twelfth of a different kind — not a denial but a count, and wrong twice over,
since it also said *"a seventh subcommand"* against a list that has held eight since 2026-08-03.

## The pre-commit checkpoint found a fail-open, and it found it by building one

`readCandidate` accepted **any** JSON object with a string `name` as a workspace manifest, while its own
docblock promised the opposite. The supervisor built a plugin payload carrying an Nx-style
`workspace.json` — `{"version": 2, "name": …, "projects": {…}}`, no `portulan`, no `kind` — and the
resolver answered `state: resolved`, exit 0, pointing a boot at it. `workspace.json` is a common filename
in the wider ecosystem, so that is an ordinary file and not a contrived one. The gate is now `portulan`
**and** `name` — the Definition's identity minus `kind`, which is read for the pointer refusal and left
to `doctor` otherwise, because this is deliberately not a second schema validator. Two more from the same
pass, both found by typing rather than reading: `--jsonn` printed prose and exited **0**, so a typo
degraded the machine-readable contract into the half the skill is told never to read (unknown options are
now refused); and exit 2 can arrive with **empty stdout**, which the skill's table had no row for and now
does. And two suites had quietly lost hermeticity — `cli/vendor.test.mjs`'s `green()` and
`cli/init.test.mjs`'s `doctor()` grade pointer directories and were reading the developer's real host
config, which is exactly the reasoning `cli/doctor.test.mjs` had already written down one file away.

## The loop, and where it stopped

[#181](https://github.com/sleepy-panda-works/portulan/pull/181). **Seven rounds, five answering pushes** —
the bound held for the first four, the fifth ran on the maintainer's grant rather than past him, and rounds
6 and 7 were siblings of that fix — three sites it had not reached, each found by the round that reviewed it. _(This
read "three rounds, two answering pushes, and the bound held rather than being argued past", which was true
of the session that wrote it and stopped being true when a second session was told to finish the pull
request. Amended rather than left, in the file whose closing line is that a record must not assert a total
that can still move.)_

- **Round 1**, one thread: `green()` in vendor's suite spread the injected `env` **first**, so any caller
  passing `env` replaced it and got the real host back — a helper whose comment called the injection
  load-bearing while the code made it a default. Fixed; the sibling sweep found the other three injection
  sites already safe, and `emptyHost()` is left unhardened **on purpose**, said in its docblock so the
  omission reads as a decision.
- **Round 2**, three suppressed notes, all real. `{"plugins": []}` read as a healthy record with nothing
  installed — `typeof [] === "object"` — so a malformed file collapsed into *not-installed*, which is
  *could not look* spent as absence, in the function whose docblock argues those states are kept apart;
  the guard **one clause away** already had `Array.isArray`. `readCandidate` still admitted a bare
  `portulan: {}`, the same fail-open one tightening later, now gated on `portulan.spec` — what the
  Definition requires of that block — with the pattern left to `doctor`. And `options.discover` was called
  synchronously inside an `async` function, so a promise-returning hook would have produced a report about
  a Promise rather than about a host, green and silently wrong.
- **Round 3, triaged rather than pushed** — [#182](https://github.com/sleepy-panda-works/portulan/issues/182).
  A blank `governed_by.feed` constrains discovery to a marketplace named `"   "` and answers *not installed*
  about something installed: real, and a **sibling** of `configDir`'s blank handling one screen up, which
  rule 4 exempts from the bound — but the same clause holds that an extension past two is **the
  maintainer's to grant and never the session's to assume**, so it is filed with its fix identified. The
  second note claimed a malformed injected resolver *crashes* `doctor`; measured four ways, three of them
  exit **2 — could not run**, which is this tool's designed answer to a defect inside itself. The residue
  is one cosmetic `undefined` in a fallback sentence.

- **Round 4**, two suppressed notes: item 1 again in stronger terms, and the exit-code contract saying
  *"0 resolved"* while `run()` also exits 0 for `resides-here`. Both triaged, the second as #182 item 3.
  Round 4 is where the **taper** showed — one repeat and a help-text wording — which is the signal rule 4
  leaves to a human, and the reason the extension was worth asking for rather than assuming.
- **Round 5, on the maintainer's explicit grant**, and it **spends** the bound: items 1 and 3 are siblings
  under the narrow test, item 2 is not, and one non-sibling makes it a spending round. Recorded that way
  because the grant and the exemption are different licences and `a-review-loop-needs-a-bound.md` is
  explicit that blurring them is the thing not to do. All three of #182's items fixed —
  and the fix's **first draft was wrong in the finding's own class**: it trimmed `feed` and `workspace`
  rather than only blank-testing them, so a padded pointer matched an unpadded name on disk while the
  reverse still missed, turning a `resolved` into a `not-installed`. The pre-commit checkpoint built the
  padded case instead of reading the diff. `configDir()`, the sibling this fix cites, blank-tests and
  hands `path.resolve` the raw string — so *"mirrors `configDir()`"* was a licence to trim that
  `configDir()` never gave. Item 3 turned out to have **three** carriers rather than the two the thread
  named, the third being the boot skill itself.

## The packaged path, run rather than reasoned about

Milestone 7 had demonstrated the boot with `--plugin-dir` against a working copy. The untested path was
*install through a marketplace, then boot*, and it now has evidence — Claude Code **2.1.226**, with
`CLAUDE_CONFIG_DIR` pointed at a scratch directory throughout, and everything installed removed afterwards:
`claude plugin marketplace add ./` (bare `.` is refused), `claude plugin install portulan@portulan`, then
**the installed copy's own `cli/discover.mjs`** — the command step 2a actually ships — resolving a pointer
to `<installPath>/.portulan`, `matches: 1`, exit **0**. The **negative control** is what makes that
evidence: the same command against an empty config directory answers `not-installed`, exit **1**, so
`resolved` shows the record was consulted rather than guessed.

Two things this deliberately does **not** claim. `gitCommitSha` in the record is the repository's HEAD while
the install copies the **working tree**, so that field is not evidence of the payload — the payload was
checked by grepping it. And `Skills (7)` is a packaging sanity check and nothing more: **the same count
reproduces from a directory carrying no workspace at all**, re-measured here, so it cannot demonstrate row
7's clause (b), whose subject is a composed pack in an adopting workspace.

_The prose above was written before the loop; the counts were added in the final push, which is rule 2
read the way it means: a record must not assert a total that can still move._
