# Handoff — the suites that never swept their scratch

**Milestone 7, session 14. Full lane.** No task file, on the structural ground alone: `dod.md`'s "not
required" list excludes one for *triage*-lane work, and nothing in `dod.md`, `gate-map.md` or
`docs/plan.md` makes a task file a full-lane condition. **The precedent argument that was drafted
beside it was false and is withdrawn rather than quietly dropped** — "sessions 7–12 created none" is
inverted, six for six. **Its own evidence needed correcting too:** `0013`–`0016` state their session
in-file (7, 8, 9, 10); `0017` and `0018` do not, and are matched to sessions 11 and 12 by their
subjects corresponding to those Session log entries. `0019` is session 13's and exists on
`refs/pull/237/head`, not on this tree. It reached this file from the session-open verdict and was carried without
being checked, which is the priming defect the checkpoints exist to catch, landing in the record of a
session whose whole subject is instruments that measure less than they claim.

**Checkpoints: session-open A-W-A (13), then pre-commit FIVE times — REQUEST-CHANGES (5),
REQUEST-CHANGES (7), REQUEST-CHANGES (6), REQUEST-CHANGES (5), and APPROVE-WITH-ADJUSTMENTS (7) once
the mechanism was confirmed correct and complete and only prose remained.** Every adjustment folded,
optional included. **Every one of the five folds introduced a fresh defect inside itself**, which is
why the count is five and not one: the fold repairing five naked sweepers missed an eighth; the fold
repairing the comments put a grep artifact in as a measured count and claimed non-empty of an empty
directory; the fold repairing *those* **deleted rationale from four files that three others cite**,
including a measured figure (`2375` leaked directories) that then had no carrier, and carried a
blast-radius list across the rebase without re-measuring it; and the fold repairing *that* left three
numbers and one file-permission claim standing beside their own corrections — `0o500` called
unsearchable when `r-x` is exactly searchable, a stale *31*, a *six* that is seven, and one instrument
given two different ordinals in the two records. **Three of those five folds went wrong on a number,
one on a mode, one on a sentence left beside its correction** — and all five were invisible to
re-reading and visible only to measurement. *A fold is a change and needs grading like one.*

A defect filed and not fixed since session 13 — *"`cli/feedback.test.mjs` leaks a temp dir per run"* —
taken up, and found to be six suites rather than one.

## The finding worth carrying forward

**The instrument the task shipped with could see 59% of the leak it was written to check.** The
brief's recipe was `find "$(node -e '…tmpdir()')" -maxdepth 1 -name 'portulan-*' -type d | wc -l`,
before and after a suite run, asserting a delta of 0. That instrument cannot see `skills-set-*`,
`recipe-set-*`, `compile-*`, `index-*` or `vendor-bothroots-*` — **32 of the 78 directories a run
leaks**, leaving 46 visible. A delta of 0 under it would have been reported as a fix while 32
directories per run kept accruing, and the report would have been *true* about what it measured.

_Figures re-measured against **`d9be6e3`**, the base this branch was rebased onto mid-session when
#237 merged: 78 leaked, by file `feedback` 46 · `skills-set` 18 · `recipe-set` 5 · `compile` 5 ·
`index` 3 · `vendor` 1. On the previous base the same run leaked **77** (`skills-set` 17); main added
one case. The old numbers were true of a tree that no longer exists — the mistake this session made
twice with suite totals — so the base is named rather than assumed._

The general form, and the reason this is the class `portulan-build` already names as dominant: **an
instrument keyed on a naming convention measures the convention, not the phenomenon.** The prefix was
never the thing; *a directory this suite created and did not remove* was. The repair is an instrument
that needs to know no prefixes at all — snapshot every directory in `os.tmpdir()`, run the suite,
diff the name sets. It cannot miss a prefix because it never enumerates one, and it attributes a
non-zero delta by name rather than by count.

**Attributing by name is not a nicety, and it paid for itself on the final run.** The diff came back
**1** rather than 0. Because the instrument yields names, the culprit was legible on sight —
`MSBuildTemp…`, dropped by an unrelated process on this machine, alongside seven `.keychain` and
`.fl*` files — foreign to the suite, confirmed by a clean re-run at 0. A whole-tmpdir diff on a live
machine *will* pick up strangers; the design answer is not to narrow the instrument back to a prefix
(that reintroduces the original defect) but to make every hit nameable, and to say in advance that a
non-zero delta gets attributed and re-run rather than waved off. Predicted at session-open, and the
prediction was needed.

**Corollary, paid for twice this session.** My own static audit — grep for `SCRATCH.push` within three
lines of each `mkdtempSync` — over-reported by five sites, and then by a sixth *that my own edit
created*, when a two-line comment pushed the registration outside its window. Five suites clean up in
vocabularies the grep did not know: `after()`, `try/finally`, a local `scratches` array, and in one
case the house idiom four lines down. **The static audit was a claim; the tmpdir census was the
measurement, and only the census could referee.** Neither instrument alone was right.

## The second finding: `force: true` does not mean what the sweeper assumed

Every existing sweeper in `cli/` was `for (const dir of SCRATCH) fs.rmSync(dir, { recursive: true,
force: true });` — a naked loop. `force` suppresses **ENOENT, not EACCES**. Eight suites chmod a
scratch directory and restore it in `finally`, so a case that dies before its `finally` leaves a
directory `rmSync` cannot enter.

**Which modes actually block removal, measured rather than assumed** — the distinction decides which
files get the repair and what each comment may claim:

| child mode | empty | non-empty |
|---|---|---|
| `0o000` · `0o100` · `0o200` · `0o300` (no **read** bit) | **blocks** | **blocks** |
| `0o400` · `0o500` · `0o600` (readable, missing write and/or search) | removes | **blocks** |

So the discriminator for an **empty** directory is the **read** bit — removal has to enumerate it
first — and a **non-empty** one additionally needs write and search to unlink what is inside. *Missing
write bit* is the wrong rule and was written here first; `0o100` blocks while empty and has no read
bit at all. The errno follows **readability, not position** — which matters when reading a
failure, and which this handoff first got wrong: an **unreadable** root gives **EACCES**, while
everything else, a locked child or a readable-but-unwritable root alike, gives **ENOTEMPTY**.
`plugin-lint`'s own hazard is a root at `0o600` with three entries, and it throws ENOTEMPTY.

Two cases the first fold cited as hazards are not — `feedback`'s `0o500` `feedback/` and `index`'s
`0o500` locked-output directory are both empty when locked, and readable. Each comment now says so
explicitly, because **a hazard claimed where none exists is the same defect as a hazard missed**. The
per-file targets were measured by wrapping `chmodSync` and recording mode, target type and entry count
at the instant of each call, rather than read off the source — the fourth instrument this session
needed, after two source-reading ones proved unreliable and a shape-keyed sweep found the last carrier.

Inside a `process.on("exit")` handler that throw does not cost one directory — **it aborts the loop
and abandons every directory after it.** Demonstrated directly rather than argued: three scratch
directories, the first locked, naked loop → **3 of 3 left behind**; per-directory `try` → **1 of 3**,
the locked one only. So the hardened form converts a total sweep failure into a single-directory
failure. `collisions.test.mjs` had already elaborated its own handler for the neighbouring reason.

**Applied at eight files, and the scope was wrong TWICE — each time for the reason this handoff is
about.** The first draft hardened `feedback` and `index` only, on the ground that they were "the two
files that actually contain a directory chmod". The pre-commit pass falsified that by reading the
other suites: `init`, `librarian`, `doctor`, `new` and `plugin-lint` all chmod directories and all
carried the naked loop. **Then the fold that repaired those five missed an eighth** —
`cli/upgrade.test.mjs`, which chmods a scratch child to `0o000`. **The claim written here about it was
itself a fourth instance of the same defect and is corrected rather than dropped:** it said "43 scratch
roots, the widest blast radius of any carrier", and 43 was `grep -c 'scratch()'` — a count of source
occurrences, including the function's own definition line, reported as a count of directories. Measured
by counting every `mkdtempSync` call landing directly in `os.tmpdir()` — the hermetic host included,
which seven of the eight also create — every one but `feedback` — upgrade creates **67** and is **sixth of the eight**; the widest
is `doctor` at **260**, then `init` 135, `index` 127, `plugin-lint` 127, `librarian` 93, upgrade 67,
`feedback` 46, `new` 23. A grep standing in for a measurement, inside the paragraph naming that habit.
_(Those figures are `d9be6e3`'s. The first set published here — 256/127/126/126/92/66/46/22 — was
`975dab0`'s and was carried across the rebase unre-measured, **which is this same defect once more, in
the sentence correcting it**. The ordering and "sixth of eight" survive both.)_ It escaped because the sweep that found the other seven grepped
for `SCRATCH`, and this file's array is named `scratches`: **the same measure-the-convention-not-the-
phenomenon defect as the brief's `portulan-*` instrument, committed twice more inside the change
whose subject is that defect** — and the second time in the very fold correcting the first. The
vocabulary trap is listed in this document's own corollary, three paragraphs up, and I walked into it
anyway. What finally found it was a sweep keyed on the *shape* — any `for…of` over any array calling
`rmSync` — rather than on a name.

None of the eight leaks today, because their `finally` blocks restore — **equally true of `feedback`
and `index`, so the hazard was identical at all eight**, and the diff had cited
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) for the *registration*
scope while breaching it on the *hardening* scope: one rule repaired at two of eight carriers, inside
the change that cites the proposal naming that class.

## What landed

23 registrations across 6 files. Three files (`compile`, `index`, `vendor`) already carried the house
sweeper and merely missed `SCRATCH.push` at sites added later; three (`feedback`, `recipe-set`,
`skills-set`) had no sweeper at all. Two sites needed more than a push: one consumed its
`mkdtempSync` inline inside a `path.join(…)` with no handle to remove it by, and one was an
expression-bodied arrow.

Scope came from the ruling of 2026-07-27 (PR #43) — *the defect class sets a fix's scope, not the
task's literal boundary* — and `proposals/0020`. Fixing only the file the brief named would have left
32 directories per run and this file's own siblings knowingly unswept.

## What is NOT demonstrated

- **The abort path is not exercised by the suite.** A green run only proves the happy path sweeps; it
  reports 0 whether or not the per-directory `try` is present. The `try` is justified by the direct
  demonstration above, not by any test in `cli/`.
- **No rail stops the next one.** Nothing fails when a new `mkdtempSync` goes unregistered — this
  session found 23 by hand and the 24th will be found the same way. A `verify` check could enumerate
  call sites and require registration, or a run could assert its own delta. Deliberately not built
  here: it is an arguable change with a real false-positive surface (five sites clean up in four
  different vocabularies, all correct), and smuggling it into a cleanup would be the ceremony
  `dod.md` guards against. **Raised as the obvious next move, not as a defect of this one.**
- **The 43,986-directory backlog is untouched** — offered to the maintainer, not taken. Empty
  directories, some predating this session.

## For the next session

**This branch conflicts with [#237](https://github.com/sleepy-panda-srl/portulan/pull/237) in four
files, not one — measured at the second pre-commit pass, the first draft having reasoned about it
rather than running it.** With `git merge-tree` against `refs/pull/237/head` (`0c3546d`):
`cli/recipe-set.test.mjs`, `cli/skills-set.test.mjs` and `docs/plan.md` conflict, and
`.portulan/handoffs-index.md` is a fourth by construction since both regenerate it. The two test
files collide because **#237 inserts its `HERMETIC_HOST` block at the identical anchor** these
suites' new `SCRATCH` blocks take — the first import-adjacent line. `docs/plan.md` collides because
#237 is session 13 and this is session 14, both appending. **This is now history rather than guidance: #237 merged
mid-session, and this branch was rebased onto it.** All four conflicts resolved by keeping both
sides — every one was an insertion-order choice with no semantic content, and the two blocks compose:
the hermetic guard neutralises the host the suite reads, the scratch list sweeps what it writes. The
first draft of this handoff claimed one file and was corrected by the pre-commit pass, which measured
it with `git merge-tree` instead of reasoning about it; the prediction then held exactly, which is
the only reason the rebase was uneventful.
