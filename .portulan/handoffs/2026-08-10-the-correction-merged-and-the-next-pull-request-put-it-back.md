# Handoff — the correction merged, and the next pull request put it back

2026-08-10. Row 7's Status cell in [`docs/plan.md`](../../docs/plan.md) disagreed with the record the
milestone-7 close will grade it against. Routed here as a separate session on the maintainer's
instruction, so the live "Portulan Milestone 7, Session 6" carries none of it.

**State.** Amended, one line of `docs/plan.md`, plus these records. `main` was `159df14` at session-open
and had not moved since the finding was measured; the cell was **not** already trued, so this is an edit
rather than a no-op record.

**Amended 2026-08-10, after [#206](https://github.com/sleepy-panda-works/portulan/pull/206) merged and
this branch rebased — see "The reconciliation" for how many times and onto what.** The findings below stand exactly as measured — they are what the
cell said at `159df14`. What changed is **which of them this pull request still lands**: #206 restructured
the same cell and trued findings 1 and 2 independently, and landing D3 moved the count past this branch's
figure. **Only finding 3 survives as work.** The original text is left as written rather than edited to
match today, on the same forward-only principle this handoff applies to `m07.md` below; this note carries
the difference. See "The reconciliation" at the end.

## What was wrong, re-measured rather than inherited

The brief named two disagreements. Both reproduce, and a **third** was found while measuring.

1. **`verify composition` sat in `Left`** although [#197](https://github.com/sleepy-panda-works/portulan/pull/197)
   merged it on 2026-08-09 at 16:00:44Z. Verified in the tree, not from the log: `cli/recipe-set.mjs`
   exists and is imported by all four readers — `.github/workflows/verify.yml`, `cli/doctor.mjs`,
   `cli/vendor.mjs`, `cli/stop-gate.mjs` — and `packs/tools/github/` ships the demonstrating recipe.
2. **`five of six` demos** contradicted the same cell's `D4 done` plus #197's `D6`. The count is pinned
   at **six** in [`m07.md`](../../docs/milestones/m07.md) §"The demonstration count, pinned", D1–D6
   enumerated from row 7's own text. D4 done (s3, `docs/plan.md:1943`) and D6 done (#197) leaves
   **four**.
3. **`s4: discovery`** — discovery is **s5** work. `cli/discover.mjs` first landed 2026-08-09 in
   `c36c2c4`; M7 session 4 is dated **2026-08-07** and delivered `0020` doctrine
   ([#168](https://github.com/sleepy-panda-works/portulan/pull/168)), which moved no row 7 clause. The
   cell's `s0`–`s3` match the Session log's session numbers exactly, so `sN` does track the log and the
   cell was off by one from `s4` on. Found by reading the log's own session labels against the cell.

## The mechanism — a conflict resolution, and a round that saw it and said nothing

**[#195](https://github.com/sleepy-panda-works/portulan/pull/195) overwrote #197's correction of the same
cell.** #197 merged at **16:00:44Z**; #195 at **16:40:23Z**. `git show 3cf47e9 -- docs/plan.md` shows #197
adding `s5: verify composition … **D6 done**`, striking `verify composition` from `Left` and setting
`**four of six**`. `git show 47bc92b -- docs/plan.md` shows #195 putting all three back.

**It was not merge order alone — a rebase resolved a same-line conflict the wrong way.** All **eight** of
#195's commits carry `committedDate` **16:34:32Z** against authored times spanning **14:11:01Z–16:34:31Z**,
which is the signature of a rebase, and it happened *after* #197 merged.
_(Corrected 2026-08-10 at the post-rebase checkpoint: this read "all four … from 16:10Z on". The count came
off a `tail -4` of the commit list — a truncated listing read as a total, which is the same instrument error
that first put Copilot's last round at 16:14Z. The first commit message on this branch carries the
superseded figure and cannot be edited; the tree is the carrier that counts.)_ `47bc92b^` therefore carries #197's corrected
cell verbatim — checked, not assumed. So the merge-base had moved, both branches had edited line 67, and
the resolution kept the branch's side. #195 carried one *correct* refinement — `(b) parity` → `(b)
parity's **adopter** half`, because it landed the bundle half — and the rest of the line was an
unintended revert.

**`m07.md` escaped**, because #195 never touched it — its whole diff is `cli/plugin-lint.mjs`, its test,
that one line, and the boot skill. Which is why `m07.md:405` still read `four of six` while `plan.md:67`
read `five of six`: one fact, two carriers, and the survivor is the one the close does **not** read
first. `0020`'s two-carrier pattern, arriving by conflict resolution rather than by anyone writing a
wrong sentence.

**It was presented once and missed — not structurally invisible, and the first draft of this handoff had
that wrong.** Because the rebase moved the merge-base past #197, #195's own diff showed the revert as
minus-lines carrying `**D6 done**` and `**four of six**`. Copilot's final round read it: **16:38:57Z on
head `b0ff5083`**, *"reviewed 4 out of 4 changed files … and generated no new comments"* — `docs/plan.md`
among the four — with the derived `copilot-reviewed` check green at 16:39:21Z and the merge at 16:40:23Z.
The half that **is** structural is the rail's: `docs.sh` checks the cell's *size* and *shape* and never
whether a line agrees with another carrier. A rail for "this PR reverts a merged change to the same line"
would need the merge-base rather than the diff — but a human or a reviewer reading that diff could have
caught this one, and one did read it.

## Decisions + why

- **Re-derived every `Left` item against the tree, not the log** — because the log is one of the two
  carriers in dispute. **As measured at `159df14`:** `upgrade` and `feedback` — `cli/portulan.mjs:34`
  said both "has not landed", and neither `cli/upgrade.mjs` nor `cli/feedback.mjs` existed, with
  [#206](https://github.com/sleepy-panda-works/portulan/pull/206) then open. `legibility`:
  `cli/doctor.mjs:21` — "never scores agent-legibility". `persona↔agent`: no binding check in `doctor`.
  `interview`: `cli/init.mjs:51` — "There is no interactive interview yet." `index rail`:
  `cli/init.mjs:675` leaves the freshness rail to the adopter's own recipe. `(b) parity's adopter half`:
  [#184](https://github.com/sleepy-panda-works/portulan/issues/184) **open**. All seven stood; only
  `verify composition` came out.
  **Re-measured on `d8f6821` at round 2 — and re-confirmed unchanged on the final base `dd7e372`,
  whose only commit is the librarian's pass, records-only — because a promoted note caught this bullet reading present
  tense:** #206 merged, so **`cli/feedback.mjs` exists** and `feedback` is off `Left` — and the
  `upgrade` carrier moved with it, from `cli/portulan.mjs:34` ("both") to **`:37`** (`upgrade` alone,
  under a heading now reading *One of the eight is not built*). The other five are unchanged at the
  same lines, re-run rather than assumed, and #184 is still open. **A citation is a figure**: this one
  went stale because the file it points into was edited by the pull request that made half its claim
  false, which is the class this whole change is about, landing inside its own record.
- **Kept #195's `adopter half` precision** — because it is more exact than #197's bare `(b) parity`, and
  the repair is a merge of the two carriers, not a revert to either.
- **The 500-byte Status rail decided what the cell could keep.** The first amendment came to **637
  bytes** against `PLAN_STATUS_BUDGET=500` and went red. The rail's own docblock says the cell is *"a
  verdict, not a narrative"*, so the bytes cut were the mechanism — `to plugin.json skills`, `one
  carrier, four readers`, `tools/github composed` — and never a correction. Final cell **494 bytes**.
  The mechanism already lives in `m07.md` §"What the composition clause delivered" and in the s5 log
  entry, which is where a narrative belongs.
  **Both figures are the rail's own instrument** — `awk`'s `length($6)` on the raw table field, padding
  spaces included, which is what `docs.sh` prints when it reds. The trimmed content is 492, and quoting
  637 beside 492 would have paired a rail measurement with a hand one. Named because this branch is
  about exactly that.
- **The inherited `s3` cut is kept, and it is a loss rather than a tidy.** #195 also dropped `**D4
  done**`'s *on the real feed*, and this cell keeps that shorter form: restoring it costs 17 bytes
  against 6 of headroom. Left deliberately, because `docs/plan.md:1943` carries the evidence in full —
  *"**D4 done** on the real `portulan-internal` checkout"* — so nothing is unrecoverable. Recorded so
  the "bytes cut were the mechanism" sentence above is not read as a complete inventory.
- **``s4: none — `0020` doctrine (#168)``** rather than ``s4: `0020` doctrine`` — because a row 7 Status
  cell naming a deliverable reads as row 7 progress, and `0020` is not one of row 7's clauses. Nine bytes
  for a sentence that cannot be misread.

## Deliberately not touched

- **`m07.md:356` and `m07.md:405`.** They read `five of six` and `four of six` respectively, and **both
  are correct as dated records** — 356 is the discovery clause's "the row is not thereby closed" written
  before D6, 405 is the post-D6 list. Rewriting a dated section to match today destroys the record; the
  plan's own forward-only precedent covers this. `m07.md:405`'s `clause (b) parity` is likewise correct
  for its date — #195's bundle half landed after it.
- **The residency truth-up sweep** — the stale "public" claims at `.portulan/README.md:58`,
  `gate-map.md:194`, `plan.md:1433`. Separate arc, separately tracked, out of this session's fence.

## Open questions

- **Is a merge-base rail worth building?** The clobber class — a PR reverting a merged correction on the
  same line — *was* in a diff a review round read, and that round returned no comments, so the gap is
  attention rather than visibility. A rail comparing a PR's touched lines against what merged into the
  merge-base since the branch forked would make it mechanical instead. Not proposed here: it is a
  doctrine question and belongs to the maintainer, not to a records fix.
- **What defends the cell next time?** Nothing added here does. The cell this change trues can be
  untrued by the next same-line conflict resolution, and the record now shows that the one round which
  had the revert in its diff read all four files and raised nothing.

## The reconciliation — the same lesson, with this branch as the one at risk

**Added 2026-08-10 on rebase, after #206 merged. This branch was rebased FOUR times the same
afternoon** — onto `43f1e54` (#206, six commits), `d8f6821` (#211·#214, five), `dd7e372` (the
librarian's pass, one) and `90abeb4` (#210 and the residency truth-up, four). `main` moved
**16 commits under a one-line change**; the count is `git rev-list --count 159df14..<base>` and the
base is whatever `origin/main` was at the last push, named in the commit message of that push rather
than only here.

_Each rebase falsified the base named in this very paragraph, and each correction is a round of the
same defect: **a figure that cites a moving reference goes stale without anyone editing it**. #211
recorded the identical thing when its rebase moved a repaired site 222→223, and `main` itself landed
**"a citation by line number is a claim about a tree"** (`90abeb4`) while this branch was in review.
Left visible rather than smoothed into a single final number, because the recurrence **is** the
finding — and the fourth correction is why the sentence above now carries a command instead of a
fifth literal that would go stale on the next merge._

This pull request is about a branch that replayed a stale cell over a merged correction. On rebase it
became that branch: **six commits behind at the first rebase** (`git rev-list --count 159df14..43f1e54`),
then five, one and four more at the next three, while carrying two of its own — holding a cell whose count read **four of
six**, against a `main` that reads **three** because
D3 landed with #206. Replaying it would have re-introduced exactly the staleness this change exists to
remove — the defect reproducing inside its own repair, which is this project's dominant class and the one
`m07.md` warns recurs there.

**How the conflict was resolved, and the rule used.** `main`'s row 7 is the base, taken whole — its
restructure into `s0-s4 / s5 / s6`, its `three of six`, its `Evidence:` pointer, and its longer criterion
text all survive untouched. Onto that, **one** re-applied change: `discovery at the boot (#134)` moved out
of the `s0-s4` clause and into `s5`, where the Session log dates it. Nothing else from this branch's cell
was carried across. The anchor was asserted before the substitution rather than assumed, so a silent
no-match could not pass as a clean resolution, and the result was measured against the rail — **493 of
500 bytes**.

**One more delta than "one", named rather than glossed.** A character-level diff of main's cell against
the resolved one returns **three** opcodes, not two: the two that jointly move `discovery`, and a third
replacing main's `and` with a comma between `verify composition (**D6**)` and `` `compose` `` — because
`s5` now lists three items and every other list in this cell is comma-only. It reverts nothing and comes
from no earlier version of this branch's cell. Recorded because a change whose subject is an unnoticed
extra delta may not ship one unnamed, however cosmetic.

**What #206 landed independently, and this branch therefore does not claim.** Findings 1 and 2 above —
`verify composition` in `Left`, and the demo count — were trued by #206's own restructure of the cell.
They are still correctly *recorded* here as what was measured at `159df14`, because they were; they are
simply no longer this pull request's repair. Finding 3 is.

**Next action.** Branch rebased onto `90abeb4`; every review thread answered and resolved on the
maintainer's explicit instruction of this date. Hand to Marius. **Do not merge** — that stays his.
