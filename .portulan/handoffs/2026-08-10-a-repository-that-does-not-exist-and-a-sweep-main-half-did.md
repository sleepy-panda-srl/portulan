# Handoff — a repository that does not exist, and a sweep `main` half-did underneath this branch

2026-08-10, off the milestone row. Both defects were found in passing during
[#214](https://github.com/sleepy-panda-srl/portulan/pull/214) and deliberately left out of it as
different classes; both are named in that pull request's body under *What this PR does not touch*.
**No criterion moves. No milestone row changes status.**

Every figure below is stated against the tree it was measured on. This branch was cut at `159df14`
and **rebased three times** — onto `dd7e372`, `e4d3f44`, then `27705ae` — because `main` moved under
it all day, and each rebase falsified citations the previous pass had verified. That is not incidental
to the session; it is most of what the session cost. _(This line has now been wrong in both
directions: it said three when the reflog held two, was corrected to two, and the third rebase then
made three true. A count of this branch's own history, inside the paragraph explaining why citations
go stale, is the defect naming itself — and it is why the maintainer commissioned a rail for this
class rather than another sentence about it.)_

## The repository that does not exist — this branch's, start to finish

`gh repo view sleepy-panda-srl/portulan-workspace-template` → **404**, and an org listing that
returns private repositories carries five — `portulan`, `portulan-internal`, `tipar`, `.github`,
`sleepypanda-site` — so the absence is absence rather than a visibility artefact. Two live carriers,
both in `docs/plan.md`: locked decision 1, and the Repo topology block. _(A third mention exists at
`docs/plan.md`'s #214 Session-log entry and a fourth in that pull request's handoff. Both are dated
records naming this very defect as found-and-not-fixed, and both stand: forward-only.)_

**The maintainer ruled it abandoned.** The scaffolding it would have carried is milestone 7's `init`
and `new workspace`, and no milestone row ever owned creating it. Decision 1 takes the file's own
`*(Amended <date>; original: "…")*` bracket with the removed clause quoted verbatim, the way decision
2's 2026-07-27 amendment does; the topology line is deleted rather than marked, because *abandoned*
is not *deferred*. Keeping it as planned would have needed a not-yet-created marker the topology
block has no idiom for — every other entry in it resolves against the tree.

## The recipe sentence — fixed on `main` while this branch was open

The second defect was `.portulan/repos/portulan.md`: *"Seven more are declared … and all eight run in
CI, because CI runs every recipe the manifest declares"*, then a list of seven. Three faults — the
manifest declares **nine** (`control-chars` missing), **CI runs ten** (`recipe-set.mjs` yields the
nine plus `tools/github:actions-pinned`), and the *because* clause was the wording milestone 7's
composition amendment retired.

**[#206](https://github.com/sleepy-panda-srl/portulan/pull/206) merged at 08:50:17Z and repaired it
independently** — commit `387bef5` — along with `verify/README.md`'s *five of the nine invoke `grep`
zero times*, in `9ffd2f4`. This session had re-measured and corrected both before learning that. Both
of this branch's **defect repairs** to those two files were **dropped rather than merged**; `main`'s
versions are the merged ones, and reverting a just-merged fix on a preference is not a session's
call. _(This branch still edits `verify/README.md`, for an unrelated one-line reason: a paragraph
about not counting recipes said "a seventh recipe joins this paragraph", and eight now name `node`.
The number is gone rather than corrected, which is that paragraph's own moral.)_ _(An
earlier draft of this handoff credited #211. It was wrong: #211 merged twenty minutes later and
touched neither file. Corrected by the pre-commit pass, which read the commits rather than the
merge times.)_

**The fork worth the maintainer's eye.** `main` repaired the card by *re-arming* the figures — "Eight
more … **ten** run in CI … The declared eight beside `docs.sh`: …" — where this session had removed
count and roster and pointed at `workspace.json` and `cli/recipe-set.mjs` instead, on the argument
that a hand-maintained figure is precisely what failed there twice. Both are defensible; `main`'s is
in the tree and this note is the only place the alternative is recorded.

## What this branch carries: the carriers `3cf47e9` left standing

`3cf47e9` — the change that landed composition — repaired `spec/README.md` and
`.portulan/verify/README.md` and left the same retired sentence standing elsewhere. That is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s defect class found inside
the repair of another instance of it. **Each was re-verified stale on `e4d3f44` after the last
rebase**, not carried across it:

- `CONTRIBUTING.md`, `cli/README.md` — the sentence nearly verbatim
- `README.md` — the root layout table, spelled *"every verify recipe the workspace **declares**"*.
  **Three sweeps across two branches missed this one**, because every instrument keyed on *manifest
  declares* and this carrier says *workspace declares*
- `.github/workflows/verify.yml` — the **step name**, displayed on every CI run, above a body
  `3cf47e9` had already rewritten to the yields story
- `plugin/skills/portulan/SKILL.md` — the worst of them, and it carried the rule **twice**. Its packs
  note asserted *"A pack's verify recipes are declared, not composed"* and cited the Pack Definition
  for it, whose key now records the opposite; its four-things frame counted the landings wrong as a
  consequence. And **step 3 — the boot instruction itself — said to read `verify.recipes` and called
  those "the executable checks that decide *done* here"**, which is the same falsehood in the
  imperative, aimed at every booting agent. The third pre-commit pass found it *contradicting the
  bullet this diff had already fixed eight screens below*: one file, one rule, two carriers, repaired
  at one. `0020` inside the repair of `0020`, for the second time in this change
- `.portulan/identity.md` — the **count/list** class, invisible to a wording grep: the `node` roster
  named seven and missed `control-chars.sh`, and *"the only one that stops there"* is false of the
  runnable set, since the composed recipe needs neither `node` nor `git`
- `spec/slots.md` — *"CI reads `verify.recipes` from the manifest and runs each one"*
- `.portulan/dod.md` **condition 1** — found by the first pre-commit pass, and the one with teeth: it
  instructed *run each recipe `workspace.json` declares*, which is nine, while a session must run
  ten. A composed recipe could go red with condition 1 satisfied
- `.portulan/proposals/0004` — the **minting carrier** of the retired wording, the file a grep lands
  on first. Appended a dated supersession note; title and Decision untouched, because a decided
  proposal keeps the words it was decided in, and `spec/pack.schema.json`'s own key is the precedent

## Three instrument lessons, all against this session

**The shortlist filter was blind.** It grepped the retired *sentence*; three carriers contain none of
its words, being counts and rosters. A re-sweep keyed on enumerations and numerals found those — and
still missed `README.md`, which a fresh-context pass found by sweeping for the *rule* rather than any
of its spellings.

**The counter lied twice.** Measuring the `grep` figure, two successive one-liners returned *zero for
every recipe* — including `docs.sh`, which the same page calls "built out of `grep` throughout". The
cause was `\b`, which is not ERE on BSD grep. Only the absurdity of the result caught it; a plausible
wrong number would have shipped.

**And the records were wrong three times while every recipe stayed green.** First a base that had
moved; then an attribution to the wrong pull request, and a commit count of eleven where
`159df14..dd7e372` holds **twelve**; then a rebase count of three where the reflog holds **two** —
that last one written into the very sentence tallying the first two. Nothing in the tree can see any
of it, which is the honest measure of how much of this change no rail covers.

## Found and deliberately not fixed

- **`verify.yml`'s fail-closed message** still says *"the manifest declares no verify recipes"*.
  Left, and the reason is that it is **accurate where it fires**: composition is additive, so an
  empty yield implies an empty declaration, and `recipe-set.mjs` refuses that case first.
- **`identity.md`'s glossary line** for *Verify recipe* — "the executable check that decides 'done'",
  linking `verify/`. Left: it defines the **term**, and does not enumerate the set. Named here so the
  next sweep knows it was read rather than missed.
- **Dated records** — Session log, handoffs, milestone files, `CHANGELOG` — keep their figures.
  Forward-only, no backfill.
- **`.portulan/dod.md`'s "CI runs all of them"** is a sufficiency claim and true; only condition 1
  needed the fix. **`verify/README.md`'s "All nine run through the same loop"** sits in the forced-red
  register, which scopes itself to the nine this directory owns, and does not claim only nine run.
- **No rail is proposed.** A rail reading prose counts is a design question and the maintainer's, not
  something to slip into a truth-up. The mineable shape, if wanted: a card's recipe roster against
  the manifest, tree-against-tree.

## State

Rebased onto `27705ae`. Ten recipes green, run individually. Seam scan clean over diff, message and
branch, against the explicit list including both artifact URLs. Suite untouched: this is prose, and
no test covers any of these sentences.

**Both pull requests this handoff once listed as open have merged** — [#221](https://github.com/sleepy-panda-srl/portulan/pull/221)
at 11:57:39Z and [#215](https://github.com/sleepy-panda-srl/portulan/pull/215) at 12:22:02Z, the
latter bringing `0025` and eight commits. #215's only real collision was the Session-log tail, resolved
by **keeping both entries**, its own first: a log is append-only and both sessions happened.

**The prediction this section used to make is now a measurement.** It said #215 adds and removes no
recipe *so the counts survive its merge*; re-run on the merged tree,
`node cli/recipe-set.mjs --workspace .portulan --repo-root .` still yields **ten** — the nine declared
plus `tools/github:actions-pinned`. Predicted, then checked, rather than asserted twice.

_(Three drafts of this section have now been falsified by the world between writing and commit: one
naming only #215, one naming two open pull requests that are now both merged, and one rebase count
wrong in each direction. Nothing in the tree saw any of it. That is the evidence behind the rail the
maintainer commissioned, and it is recorded here rather than smoothed away.)_
