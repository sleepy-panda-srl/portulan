# Handoff — 2026-07-27 · the reviewer was right, and the form it used could not be answered

**State.** Every unaddressed Copilot review comment on **pull requests #1–#48** — the whole repository
at the time, 47 merged and #10 closed — swept in one pass and closed, across doctrine, workspace,
mechanism and record. The sweep found two classes, and only one of them was visible from the
pull-request UI. (#50 merged mid-session and was checked separately: no unresolved threads, no
suppressed comments, nothing owed.)

_(No file count in this line. The first draft said "eight" over a change touching eighteen, and review
caught it — which is exactly what happened to #48's handoff, in exactly this sentence, one day earlier.
A count written by hand into a document that keeps being edited is the same shape as the stale rosters
this repository spent milestone 4 removing. `git diff --stat origin/main...` is the number, and it is
always current.)_

## What was swept, and how the second class was found

Six review threads on `main` were still unresolved. Two of them (#1, #2) already carried a
`Fixed in <sha>` reply and a landed fix — verified against the tree, nothing owed, unresolved only
because nobody clicked the button. Four were real and are fixed here.

The rest of the sweep is the finding. GitHub renders a Copilot comment it scores as low-confidence
**inside the review body**, under `<details><summary>Comments suppressed due to low confidence</summary>`
— not as a review thread. That form has no *Resolve* button, does not appear in `reviewThreads`, never
blocks `required_conversation_resolution`, and leaves no trace in any record of addressed feedback.
Reading all **101** Copilot reviews on #1–#48 by their bodies rather than their threads produced **27
such blocks declaring 31 comments**, across 28 distinct file locations — three of them are second and
third comments re-stating one line. Nobody had ever been able to answer any of them.

Their disposition, counted one by one rather than estimated: **20 already fixed** by later pull
requests that happened to cross the same ground — not by anyone acting on the comment — **9 fixed
here**, **1 with nothing in-tree to fix** (#32's, about a merged pull request's description), and
**1 deferred with its reason stated** (`doctor`'s unsized-record total, which already discloses the
gap). Which is the point: what closed the twenty was luck, and the ten that needed a decision waited
for someone to go looking.

_(Both numbers in that first sentence are scoped deliberately, because the first draft was not and a
supervisor caught it. **101 reviews and 31 comments is #1–#48**, the set this sweep covered. Count
today's *merged* set instead — 47 of those plus #50, dropping the closed #10 — and it is 102 reviews
and 29 comments. Neither is wrong; a count without its population is.)_

## The one that mattered

A comment on **#3**, three days old, said `docs.sh` guarded only `git` while relying on `awk`, `sed`,
`wc` and the rest, and that this could produce "confusing failures or even false greens". It was scored
low-confidence. It was right, and understated.

Removing one command at a time from `PATH` across all six recipes:

- **Eleven false greens** — `docs.sh` on `sed`/`sort`/`wc`, `doctor.sh` on `sort`/`tr`, `json.sh` on
  `grep`/`sed`/`tr`/`wc`, `plugin.sh` on `sort`/`tr`. Exit `0`, over checks whose input was empty
  because the command that fills it was not installed.
- **Five more** that went red overall while individual checks still printed `ok`. The sharpest:
  with `awk` gone, `docs.sh` printed `ok    map — every top-level entry is documented in README.md`
  having enumerated **zero** directories — in a check whose own comment already warns about going
  green over an entry it never looked at.
- Only `tests.sh` and `compile.sh` were clean throughout.

This is [`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md)
a second time, and that rule's provenance is *also* a Copilot review comment. The rule named the case
where a precondition runs and fails; it never reached the case where the precondition was never
installed, which produces the identical empty output and the identical green. The rule has been
extended rather than duplicated: **a dependency is a precondition.**

Every recipe now checks its whole command list before running any check, exiting `2`. The same probe
now returns `2` in all thirty cases, with every baseline still green.

## The rest

- **`cli/compile.mjs`, two defects, both from #31.** A shell target ending in `/` was unmatchable by
  `matchesRule` — it required an exact hit or a following space, which a path prefix never has — while
  the emitted `Bash(target:*)` rule prefix-matches on the host. The two halves the file promises are
  one definition disagreed. **Stated at its real size:** the only target of that shape in
  `gates.json` is `run-a-verify-recipe`, which is `auto`, so it compiles to nothing and the runtime
  gate never reads it. Nothing was mis-enforced; a divergence existed and is now closed by test.
  Separately, an absolute `write`/`read` target was silently rewritten — `/etc/passwd` emitted
  `Edit(./etc/passwd)` and matched any path *ending* `/etc/passwd`. Now refused at compile time, on
  the same "refuse rather than escape" reasoning as the reserved-character check beside it. Five
  tests added; suite 244 → 249.
- **`agents/implementer.md`** told the reader "on this repository, pushing a working branch is Auto"
  one clause after telling them the gate map, not this file, decides. These bindings ship with the
  plugin into repositories whose gate maps this one has never seen, so the sentence was both
  self-contradicting and false for adopters. Its two siblings were checked and carry nothing of the
  kind.
- **`.portulan/labels.json`** pointed at `../memory/…` and `../dod.md`, which resolve to a top-level
  `memory/` and `dod.md` that do not exist. (`../.github/workflows/pr-labels.yml` in the same comment
  was correct and is untouched.)
- **`.portulan/dod.md` condition 5** still justified the seam scan with "this history goes public when
  the flip clearance completes". It went public on 2026-07-27. The clause binds harder now, not less,
  and says so.
- Smaller: the gate map's "can resolve one" read as "only one thread" next to evidence from two;
  `three-workspaces-not-one.md` said "publicly with the repo, public since"; proposal 0008 led its
  status line with `REVISED` rather than with its state; `docs/plan.md` had a double space, a bare
  `.portulan/tasks/0004` for a file with a longer name, and — the one worth naming — the claim that
  #48 "landed twelve commits behind `main`", which cannot be true of anything that merged.

**One collision, handled as #48's was.** The `docs/plan.md:26` "no cockpit" → "no operating cockpit"
follow-up that #41 deliberately left was folded in while the file was open, then taken back out: #49
opened mid-session carrying the identical edit. A second copy of a change another open pull request
already owns is how two branches end up arguing over one line. #49 carries it. Recorded so the next
reader knows it was checked rather than missed. #50, also opened mid-session, appends to the Session
log and touches `gate-map.md` at rows this change does not — expect the usual append conflict on
rebase, and keep both entries with the newest last.

## What is not fixed, and why

- **#32's comment about a thin pull-request description** (a tier change presented as a documentation
  clarification) is about a merged PR's text. The tree already records the change correctly in the
  gate map. Nothing to fix here; noted so the next reader does not go looking.
- **Proposal status lines are inconsistent across the set** — `**Status: X, date.**`, `**Status.** …`,
  `**Status. X …**`. 0008's was fixed because its state was genuinely buried. Normalising the other
  ten would mean inventing a convention nobody has stated and editing ten records of decisions to
  match it. That is the maintainer's call, not a sweep's.
- **`doctor.mjs`'s unsized-record accounting** (#41) prints a KB total that undercounts if a record
  cannot be `stat`ed. It is disclosed — every unsizable record is also unreadable and already
  reported as "unreadable and never assessed" — so the reader is told the accounting is incomplete.
  Left as is.

## Verification

All six recipes green. Suite 249/249. The dependency probe re-run after the fix: `2` in all thirty
— every previously-unguarded command the five recipes now declare, less `dirname` —
cases. `compile.sh` green, so the emitted artifact still matches the policy — the matcher changed,
the emitter did not.

**Supervision: the fresh-context pre-commit checkpoint was run, late and on the maintainer's
instruction.** It was skipped on the first push and recorded here as a gap rather than an exemption;
Copilot's own review then asked for it, Marius authorised it, and a fresh-context **Fable 5**
supervisor reviewed the full diff against `vision.md`, `plan.md` and `dod.md`.

Verdict **APPROVE-WITH-ADJUSTMENTS**, one must-fix — and it was in the record, not the machinery:
*the sweep's own bookkeeping was unscoped*, the single defect class this change exists to remove.
Every substantive claim held under attempted falsification, by execution rather than reading: the
suite at both ends (244 → 249), all six recipes green, the false-green matrix reproduced **exactly**
on the pre-fix tree (the same eleven pairs, the same five red-with-`ok` runs, `ok    map` printed with
`awk` gone), all guard-list removals closing to `2`, and both `compile.mjs` defects demonstrated on the
old code and their fixes on the new. It also proved the guard lists **complete and minimal**, by
running each recipe with `PATH` restricted to exactly its own list — a check this session had not
thought to make.

Its four non-blocking items were all taken: the `..` sibling of the absolute-target refusal (now
refused and tested), the `rm` cleanup-only shape that `tests.sh`'s comment had rounded off, a
`compile.sh` comment naming one dependency where it runs two, and a stale `command -v node` spelling
in this file's own README. The supervisor's own counts came from today's *merged* set rather than
#1–#48; both are now stated with their populations.

Seam scan clean across files, commit message, and branch name.

**Next.** Milestone 4 session 1 still owes the GitHub repository-ruleset export, the per-host backend
matrix, and `doctor`'s degradation report. Unrelated to this sweep, and unmoved by it.
