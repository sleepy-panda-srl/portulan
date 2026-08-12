# Handoff — the path that worked because someone typed it

**Milestone 7, session 8. Full lane.** Task
[`0014`](../tasks/0014-the-registrable-set.md). Row 7 clause (b)'s **adopter half**,
[#184](https://github.com/sleepy-panda-works/portulan/issues/184).

## What this session was handed

The maintainer was offered the four open items of row 7 and chose **#184** — *the generator that
derives a plugin's `skills` from a workspace's `packs`* — with #228's two performance notes folded in
**only if the work already opened those files**. `upgrade` and the three demonstrations (D1, D2, D5)
are untouched and M7 stays open by his ruling of 2026-08-11.

## The finding worth carrying forward

**The design was already written down in the tree; nobody had read it as an instruction.**
`spec/pack.schema.json`'s description of `contributes.skills` said, in its own words, *"Reaching
parity means reading this key, so the row has undertaken to open it."* `doctor` opened the key to
**validate** the skills behind it and nothing folded it into **registration** — which is exactly the
declare-only state `contributes.verify` sat in until session 5, with the repair already established
one milestone earlier: one carrier, and the readers reach it. So the shape of this work was not a
judgement call. It was a sibling of `cli/recipe-set.mjs`, and reading that file end to end first was
worth more than any amount of designing.

## Four things that cost something, in the order they did

- **The suite was green over a check it never exercised.** The pre-existing `compose` fixtures in
  `plugin-lint.test.mjs` build a pack whose `pack.json` declares **no `contributes` key at all**, so
  the new declaration-side check derived nothing, found nothing, and 135 tests passed without once
  running it. Sixth measured instance here of *a harness inherits the blind spot of the change it
  checks*. The fixtures that drive it now force it red four ways.
- **The first cut resolved packs through the wrong root.** It used the carrier's own resolver, which
  derives roots from the workspace manifest's `tree`. That is right for a workspace on disk and wrong
  inside `plugin-lint`, whose authority is the **bundle's** `./packs/` — the directories it had
  already walked and contained. Every fixture bundle declares no `tree`, so the suite said so
  immediately. The deeper problem was the one the suite could not say: that version also made a
  composed entry **without a `pack.json`** a failure, which is a second answer to *what is a pack*
  beside `doctor`'s — the exact rule this file refuses in its own comments. Absent is now skipped and
  unreadable still fails.
- **The one a passing suite could never have told me.** The derivation emitted a path for any pack
  inside the plugin root; the declared side recognised one only under `<pluginRoot>/packs`. On any
  layout where those differ — an ordinary adopter's `tree` — `--check` reported the same drift forever
  while telling the user to run `--write`, and `--write` appended a duplicate every run. **This
  repository's layout is the one arrangement where the two coincide**, so the live test, the
  byte-identity check and the 31 unit tests written before the fix all ran inside the blind spot. Found at the pre-commit
  checkpoint by a supervisor who **built the layout** rather than reading the code. The partition is now
  derived from where packs actually resolved, so it cannot diverge by construction.
- **A claim in the task file outran the code, and it was mine.** The plan said the rewiring meant
  *"one rule losing a second implementation"* — proposal `0020`'s repair. Reading the code, it is not
  true: the walk asks what is in the **tree** and the carrier asks what the pack **declares**, from
  different evidence, and a pack whose declaration and tree disagree is a finding only both of them
  together can produce. The check was **added**, not consolidated. Corrected in the task file rather
  than shipped, because a doctrine citation that does not fit is worse than no citation.

## What to know before touching this next

- **`--write` regenerates `.claude-plugin/plugin.json` byte-identical to the committed file.** That
  equality is the session's central evidence and it is pinned by `skills-set.live.test.mjs`: the
  hand-typed path and the derived one are the same string. If it ever stops being, the two have
  parted — which is the silent state #184 was filed about, made loud.
- **`HOST_SKILL_DEPTH` moved** from `cli/plugin-lint.mjs` to `cli/skills-set.mjs`, because that file
  now imports the carrier and exporting the constant back would have made a cycle. It is a
  **platform measurement** (Claude Code 2.1.224, re-measured 2.1.226), not a derivation, and a host
  that changes it makes every derived path wrong with nothing here to detect it. Re-measure at the
  next host upgrade — the mandate travelled with the constant rather than being restated.
- **The fourth outcome is the adopter's, and this bundle never takes it.** A pack resolving *outside*
  the plugin root — the case `--pack-root auto` exists for — resolves fine and has no path expressible
  relative to the plugin root. It is reported, excluded from the set, and moves no exit code. The
  unit suite exercises it; a live assertion pins that nothing in this repository resolves that way, so
  a future in-tree change that starts to is visible rather than silent.
- **`plugin.sh` runs two checks now, not one**, and its header says so. `skills-set --check` is asked
  of `PLUGIN_ROOTS` only: a payload root ships packs rather than composing them, so it has no `packs`
  array to derive from and the question does not apply.
- **What did NOT land, so the close is not held to it.** D5 — a composed pack's skill **invoked**
  through a host — is still owed by a session that runs and records it. Derivable is not demonstrated.
  #184's second half (*a workspace cannot inherit another*) is untouched, so **the pull request must
  not close #184**. And nothing here writes an adopter's manifest from nothing: only the pack portion
  of a `skills` key in one that already exists.

## The review loop, and the pattern it exposed

**Five rounds to empty.** Round 1: two inline comments. Round 2: **no inline comment at all** — the
whole round arrived through the suppressed low-confidence channel. Round 3: one inline comment (data
loss) and one note. Round 4: no inline comment, two notes, **one of them refused with a measurement**.
Round 5: empty, verdict APPROVED, `NOTES_STATE: none`.

Two things this loop found that the three fresh-context checkpoints did not, and both are patterns
rather than incidents:

**Three fixes landed at one site of an operation and not at its sibling.** Round 2 split read from
parse in `skills-set`'s `workspace.json` arm and left the identical conflation in `plugin-lint`'s
`pack.json` arm. The pre-commit re-check added the ownership guard to the resolved-pack arm and left
the fallback arm open — where `--write` then **deleted two hand-written `skills` entries and exited 0**,
announcing that it wrote nothing. Each time the review found the sibling, never the session that had
just written the fix. That is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) committed three times inside
the change that cites it, and the operative lesson is procedural: **after fixing a diagnostic or a
guard, grep for the same operation elsewhere in the diff before pushing.**

**Three tests could not fail for the reason they existed.** The tautological
`assert.ok(0 <= HOST_SKILL_DEPTH && 1 <= HOST_SKILL_DEPTH)` (pre-commit), the live test that iterated
only the depth-1 shape so the depth-0 case asserted nothing (round 1), and the key-order fixture with
`skills` already last, which would have matched a `--write` that moved the key (round 4). A vacuous
test is worse than none: it reports coverage it does not have, and all three were written by the
session whose stated subject is harnesses inheriting blind spots.

**One note was refused rather than fixed**, with the measurement in the reply: the claim that
`{ ...value, skills: next }` re-inserts an existing key at the end is false — re-assignment keeps the
insertion position. The fix for its sibling note (the vacuous fixture) is what makes that refusal
checkable rather than asserted.

## Fidelity

Session-open ran in a fresh **Fable 5** context (the standing instruction, since the session's records
step edits `docs/plan.md`) and returned **APPROVE-WITH-ADJUSTMENTS (8)**. All eight were folded and are
recorded as numbered items in [`0014`](../tasks/0014-the-registrable-set.md) rather than edited
invisibly into the plan they graded — including the two that changed the design (the constant's home,
and the fourth outcome) and the one that removed scope (#228 item 1, dropped because nothing here
opens `cli/doctor.mjs`).

**Eleven recipes green; suite 1415 pass / 0 fail**, against a measured baseline of 1357 at `f30ab2d`.
Seam scan clean over the staged diff, the branch name and the commit message, run term by term rather
than as one pattern.

Pre-commit returned **REQUEST-CHANGES** — one real defect and seven adjustments, all folded, recorded
as numbered items in [`0014`](../tasks/0014-the-registrable-set.md). The defect is the one worth
carrying: **`--check` and `--write` never converged on any layout but this repository's**, because the
derivation and the declared side partitioned "which entries are mine" two different ways. Reachable
with no flags, from an ordinary adopter's `tree`. Every green passed over it — the live test included —
because this bundle's layout is the one arrangement where the two partitions coincide.

**That is the seventh measured instance of a harness inheriting the blind spot of the change it
checks, and the second in this session.** The first was caught by fixtures; this one was caught only
because a supervisor built the layout instead of reading the code. The suite now carries a fixed-point
test and a sub-tree layout, and the tree was frozen and the checkpoint re-run over the whole diff,
records included, since the first pass graded a tree that grew from 10 files to 14 underneath it.

The re-check returned **APPROVE-WITH-ADJUSTMENTS (6)**, all folded, and **two of them were defects in
the fix itself** — the kind only a second adversarial pass finds. The fallback owned set was still
layout-dependent, so a workspace that had stopped composing kept a stale entry forever on any layout
but this one; and a resolution root containing the plugin root made every declared path read as a pack
path, so `--write` **deleted** a hand-written `./core/skills/`. Both are refused or corrected and
demonstrated on rebuilt layouts. **A fix for layout-dependence shipped with layout-dependence in its
fallback** is the sentence to carry out of this session.
