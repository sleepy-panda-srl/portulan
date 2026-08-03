# Handoff — the authoring surface, and a checker that opens what it used to count

**Milestone 7, session 2.** The row's authoring half is built: `new` scaffolds six kinds into a layer the
user owns and refuses `core/`, the five core templates it scaffolds *from* are authored, and `doctor`
now **opens** a pack's skills and personas instead of counting their paths. **Milestone state: M7 still
in progress.** `vendor`, `upgrade`, `feedback`, the residence switch, the legibility score, pack-cache
discovery, verify composition, clause (a)'s wire, clause (b)'s parity, the interview loop and all six
demonstrations are untouched. Nothing here claims otherwise.

## What landed

`cli/new.mjs` + `cli/new.test.mjs` (written first); `core/templates/{skill,persona,pack,workspace,gate-policy}.md`;
`doctor`'s validation half; `new` and `feedback` in `SUBCOMMANDS`; the #151 reword; the #155 fix in both
sites; row 7's amendment with its argument in `docs/milestones/m07.md`; and a staleness sweep across
`spec/README.md`, `spec/pack.schema.json`, `cli/README.md`, `.portulan/identity.md`, `CHANGELOG.md` and
the boot skill. Suite **896/896**, up from 861. Eight recipes green. `npm pack` **81 files, all 81
byte-identical** to the git tree, so session 0's no-build-step property survives seven new files.

## Six rulings opened the session, before a file was written

All to the maintainer, all answered. **(1)** Go for the M7 close at full bar — nothing amended out of
row 7; the session count bends, not the criterion. He was offered narrowing the row to fit and declined
it. **(2)** [#150](https://github.com/sleepy-panda-works/portulan/issues/150) resolves **broad**.
**(3)** [#151](https://github.com/sleepy-panda-works/portulan/issues/151) resolves by **rewording**.
**(4)** The residence switch's verb: **widen `vendor`'s `vision.md` gloss** — his edit, drafted for his
hand, and it belongs with PR 2 where `vendor` lands. **(5)** `init` owes a **TTY interview loop**; flags
and `--answers` stay the headless path. **(6)** **No npm publish** for the close — it demonstrates
`npm pack` → install → run. #148 stays open rather than being forced by a milestone close.

## The three defects a reading could not have found

**Every one came from running the tool.** This is the fourth consecutive session where that is the
sentence, which is starting to look less like a coincidence and more like the shape of the work.

- **The symlink rule was wrong, not merely its code.** `collisions()` walked the path chain to the
  filesystem root and refused any link on it. On macOS `os.tmpdir()` resolves under `/var`, which **is**
  a symlink — so every scratch directory in the suite was refused, and so would be every user whose
  destination sat under a linked mount or home volume. The fix is not a longer allowlist: a symlink
  among the **ancestors of the path the user named** is a fact about their filesystem, and they named
  that path, so resolving it is obeying them. A link **at or below** the named path is the escape
  `init` paid for twice at session 1. **The boundary is the named destination**, and that sentence is
  the rule — the previous framing had no boundary at all, which is why it was wrong in a direction
  nobody had thought to test.
- **The Prohibited check false-redded this repository's own supervisor persona.** Its reach section says
  *"**Prohibited is not a reach** and does not appear here"* — a file obeying the rule by explaining it,
  flagged by a matcher that could not tell disclaiming from claiming. Caught on the check's **first run
  against the real tree**, not by a fixture. A false red is the failure that gets a whole recipe
  switched off (`json.sh` cost exactly that at milestone 2), so this one mattered more than a missed
  detection would have. Narrowed to an affirmative mention, **with the limit stated in the code**: it is
  a prose heuristic, prose can defeat it, and the structural fix is a declared reach *field* the way
  `tools:` is a field — a contract change, and not an implementer's to make.
- **The scaffolds failed their own validation.** A scaffolded pack carried `{recipe-id}` and
  `{propose | gated | prohibited}` as placeholders, which fail `$defs/slug` and the tier enum — red on
  the run after it was written. A scaffolded workspace was red under `doctor` because the schema
  **requires** a `verify` block. Both are session 1's shape arriving one tool over. The pack template
  now ships a validating subset with the rest shown in prose beside it, and the workspace scaffolds a
  recipe that **exits 2** — *could not run* — because the author has not said what green means yet, and
  a stub exiting 0 would put a false green under every gate on the day the workspace was created.

## Decisions a later session would otherwise re-derive

- **A user's own skill lives in a pack they own, and that is forced by the schema rather than chosen.**
  The Workspace Definition has **no `skills` slot**. Packs are the cascade's middle layer and already
  carry `contributes.skills`, so `new skill --into <pack>` is the only placement that does not invent a
  slot. This is what makes demonstration 2 coherent: `new pack`, then `new skill`/`new persona` into it.
- **`new workspace` composes no pack; `init` composes one by default.** Not an inconsistency. Clause (a)
  requires the cycle arrive **opt-out**, so `init`'s draft is loudly red until a pack root is named —
  ruled, and kept. `new workspace` is for a workspace somebody is authoring by hand, where a red first
  run would be a red the author did not cause and cannot act on.
- **`new` has no exit 1**, for `init`'s reason: it renders no verdict about a workspace. 0 wrote, 2
  could not run.
- **`new` never edits a manifest it did not write in the same run.** A manifest is curated; a generator
  that rewrites one eventually rewrites the wrong one. The cost is a file nothing references, so the
  cost is paid out loud — each run prints the wiring step the author still owes.
- **The entry point carries eight, not six, and the licence is the row.** `docs/vision.md` names six and
  is human-owned; row 7 names `new` and `feedback` in its own ratified text. The existing test asserting
  the six was **split rather than widened** — the property it guarded was never "there are six", it was
  that the human-owned list is authoritative and its order is not an implementer's to rearrange. A
  `deepEqual` against the new eight would have kept passing while giving that up.

## Undemonstrated, named

- **The persona↔agent binding** row 7 names is **not** in this diff. The four other validation families
  are. Said here because a session that shipped three quarters of a clause and let the fourth go unsaid
  is the shape dod condition 4 exists to refuse.
- **The `SKILL_DEPTH` bound is three levels**, matching `cli/plugin-lint.mjs` so two walkers over one
  declared key cannot disagree. A skill nested deeper is not found — and the walk **reports the
  directories it did not descend into**, so this is a stated bound rather than a silent one. _(Both
  halves of that sentence were false when first written: the bound was 1, citing a task that sets 3 for
  a different tool, and the walk returned silently. The pre-commit checkpoint measured a bad skill
  passing as "0 skill(s)" and both were fixed.)_
- **Nothing here demonstrates row 7's demonstrations.** A scratch directory scaffolding into a workspace
  `doctor` calls green is the floor beneath demonstration 2, not the demonstration.

## What session 3 picks up

PR 2 as scoped at session-open: `vendor` **and the switch** (the verb is `vendor`, ruled — the
`vision.md` gloss edit is drafted for Marius and must land with it), `upgrade`, verify-recipe
composition, clause (a)'s wire and clause (b)'s parity, `feedback`, and `init`'s interview loop. Then
PR 3's demonstrations and the close.

**Two things the session-open checkpoint said that should not be rediscovered.** Clause (a)'s wire needs
**both** runners moved into the shipped `cli/` surface — `stop.mjs` **and** `gate.mjs`, which
`cli/compile.mjs:951` emits from the same unshipped directory into four `PreToolUse` hooks; shipping one
and reasoning about the other is #91's class, which session 1 hit twice. And moving them **breaks this
repository's own five live hooks** in `.claude/settings.json` unless the same change recompiles them.

**The close owes six demonstrations, not four** — amendment 4's composed-recipe demonstration and clause
(c)'s parity clause are row-owed and were missing from this session's first plan; the checkpoint found
both. Subjects are settled: D1 onboards `sleepy-panda-works/sleepypanda-site`, measured ungoverned and
already checked out locally; D4's feed end is the real `portulan-internal`; D3's send is **Gated** and
goes to Marius with its exact payload before it leaves the machine.

## The pre-commit checkpoint returned REQUEST-CHANGES, and it was right

**It defeated the one property row 7 states in the imperative, two ways, on the maintainer's own
platform.** Both reproduced by hand before being fixed, because a finding taken on trust is a finding
nobody verified.

- **A case-variant spelling walked into `core/`.** `--into <repo>/CORE/templates/x` exited 0 and created
  a directory inside the shipped `core/`. macOS is case-insensitive and `realpathSync` does **not**
  canonicalise case, so a case-sensitive compare was not a compare at all. Folded now, with the cost
  stated: on a case-sensitive filesystem a directory genuinely named `CORE` is also refused, and that
  asymmetry is the argument — refusing costs one corrected path, permitting costs an edit to a shipped
  layer.
- **A symlinked ancestor plus a leaf that does not exist yet walked into `core/`.** `realOrSelf` caught
  `realpathSync`'s failure and returned the **unresolved** path — and that catch is not the rare branch,
  it is the ordinary one, because a scaffolder's destination usually does not exist. The header promised
  "resolves first and compares after" and delivered it only when the destination already existed, which
  is the case that matters least. It now realpaths the nearest existing ancestor and re-appends the tail.

**Two more were false claims this session had already written down as true.** The walk comment said "the
bound is reported when it stops" while `walkSkills` returned silently — so a skill below the bound, with
a bad name *and* an empty description, passed as *0 skill(s)*. And `SKILL_DEPTH` was 1 citing a task that
fixes 3 for a different tool. The bound is 3 now, matching `plugin-lint` so two walkers over one declared
key cannot disagree, and it reports the directories it did not descend into. Four carriers repeated the
false sentence; all four moved.

**And the third instance of this session's own recurring shape:** the scaffolded pack declared
`personas/{role}.md`, which *passes the schema* — it is a well-formed relative path — and then fails the
check that **opens** it, added in this very diff. `new pack` → `doctor` was exit 1. Fixing schema
validation of a scaffold and forgetting the opening validation is the same mistake one layer along.

All thirteen adjustments were folded, required and optional, on the maintainer's instruction that the
optional set be addressed too. Also fixed: the shipped tool told users `feedback` is named in
`docs/vision.md`, which contains the word **zero times** — it comes from row 7 — and no test asserted the
string, which is why it survived; one does now. The Status column of row 7 still listed `new` and
`doctor`'s validation half as unbuilt, falsified by the diff committing beside it, and its first repair
**breached the 500-byte Status budget** at 1482 bytes — the scoreboard rail doing its job on the session
that was repairing the scoreboard.


## The loop record — two rounds, both defects this pull request introduced

**Round 1: three threads, all real, and one whose *reason* was wrong.** Copilot said `found += null`
produces `NaN` and corrupts the skill count. Measured before accepting it: `null` coerces to `0`, so the
count was never corrupted — it was quietly **understated**, which is the worse of the two, because an
understated count looks like a root with fewer skills rather than like a walk that failed. The conclusion
was right and the mechanism was not, and separating them changed what the fix had to do: the top-level
caller already treated *could-not-look* as UNREAD, and the **recursive** call swallowed that signal, so
the guarantee held only when the unreadable directory happened to be the root itself. The other two: an
`inside()` that answered *"is not there"* to an `EACCES` — the only-ENOENT-means-absent rule broken inside
the function written to enforce it — and `director(y/ies)` reaching a user-facing line.

**Round 2: four suppressed notes, two of them one defect, and it is this session's own shape a third
time.** `new workspace --kind pointer` was advertised in the help screen and **could not emit a valid
pointer**: the scaffolder wrote the governing shape unconditionally and never `governed_by`, so `doctor`
refused what the tool had just created. Copilot offered build-it or drop-the-kind; built, and demonstrated
green under the real `doctor` rather than asserted.

**Why both were fixed rather than triaged at the two-round bound:** every finding was a defect this pull
request introduced, which is the stated ground on which the bound bends. A finding that is not this
change's fault would be the one to triage, and neither round produced one.

## State at handoff

[#156](https://github.com/sleepy-panda-works/portulan/pull/156) is **open, not merged** — merging is the
maintainer's. `workspace-verify` and `pr-labeled` are green; one review thread is unresolved and
`required_conversation_resolution` waits on him rather than on the bot, which cannot resolve threads.
Suite **902**, eight recipes green, `npm pack` byte-identical.

**CI caught one thing this machine could not.** The case-variance test asserted a refusal unconditionally,
passed on macOS and went red on Linux — and the failure was the *test's*: on a case-sensitive filesystem
`CORE` is a genuinely different directory, holds no `engine.md`, and escapes nothing. The filesystem is
probed now rather than inferred from `process.platform`, because case-sensitivity belongs to the volume.
