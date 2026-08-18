# Task 0014 — the registrable set: a composed pack's skills reach a host by derivation

**Lane:** full · **Opened:** 2026-08-12, milestone 7 session 8, at the session-open checkpoint
**Verify recipe:** `tests` · **Status:** DONE — merged as [#227](https://github.com/sleepy-panda-srl/portulan/pull/227) (`f30ab2d`), 2026-08-12

> Row 7 clause (b)'s **adopter half** — [#184](https://github.com/sleepy-panda-srl/portulan/issues/184),
> *the generator that derives a plugin's `skills` from a workspace's `packs`* — chosen by the
> maintainer at session open over `upgrade` and over the three outstanding demonstrations.
> **M7 does not close this session**, and it has been open by his ruling of 2026-08-11 since he was
> offered a narrowing of this row and declined it.

## The criterion, quoted rather than paraphrased

Row 7 of [`../../docs/plan.md`](../../docs/plan.md), the 2026-07-30 amendment:

> **(b) A composed pack's skills are invocable through a host**, closing the **pack-registration
> half** of #134 — carried by #184 since 2026-08-09 — on the path this row already owns via `vendor`:
> a checkpoint skill from a composed pack is invoked in the adopting workspace **the same way a core
> skill is**, and the demonstration is that **parity**, not the files being present at a path a human
> knows.

The clause carries two separable obligations and
[`../../docs/milestones/m07.md`](../../docs/milestones/m07.md) already splits them:

- **the demonstration** — D5, "a session running and recording the parity demonstration". **Not this
  session**, and not blocked on anyone.
- **the mechanism** — "the clause's wider obligation … still wants the generator that derives a
  plugin's `skills` from a workspace's `packs` (#184), because **today that key is hand-written**."

**This session takes the mechanism only.**

### `clarify` against the row, as [`../gate-map.md`](../gate-map.md) requires

One phrase reads two ways and the reading decides what gets built: *"on the path this row already
owns via `vendor`"*. It is read here as naming the **pack-composition path**, not as assigning the
deliverable to that subcommand — and the ground for that is the milestone file's own gloss of the
same amendment rather than an inference from code. `m07.md` calls it *"the **pack-composition path**
this row already owns **through** `vendor`"*, and places the sibling verify amendment *"beside the
composition path `vendor` already owns"* — whose deliverable then landed as `cli/recipe-set.mjs`, a
standalone carrier `vendor` merely calls. That is the precedent, and it is exact.

Corroborating, weaker, and recorded as corroboration: `cli/vendor.mjs`'s own help text says `--host`
vendors *"for a host that is **not** Claude Code"*, [`../../core/engine.md`](../../core/engine.md)
says *"vendoring resolves nothing"*, and `vendor` writes no `plugin.json` anywhere in the tree.

## What is missing, established from the tree rather than from memory

`packs/rituals/checkpoints/pack.json` already declares where its skills live —
`"contributes": { "skills": ["skills/"] }` — and
[`../../spec/pack.schema.json`](../../spec/pack.schema.json)'s description of that key **already
states this task's obligation**:

> Composition into a host is a different question and is still row 7's clause (b). … Reaching parity
> means **reading this key**, so the row has undertaken to open it.

`doctor` opens the key to **validate** the skills behind it (the 2026-08-03 amendment). **Nothing
folds it into a host's registration.** That is precisely the declare-only state `contributes.verify`
sat in until session 5, and the repair has a precedent in this tree.

Registration is a property of `.claude-plugin/plugin.json` and of nothing else — measured 2026-08-09
on Claude Code 2.1.226 by deleting the `packs` key from the governing workspace and reinstalling,
which changed the host's inventory not at all. So a composed pack's skill is invocable here **by
coincidence of a hand-written path**.

## The deliverable

### 1. `cli/skills-set.mjs` — the one carrier of the registrable set

Sibling of [`../../cli/recipe-set.mjs`](../../cli/recipe-set.mjs). **Not** a ninth subcommand:
`docs/vision.md` names eight and is human-owned, and `cli/README.md` already records the precedent in
`discover`'s own row — *"deliberately not a ninth `portulan` subcommand … joins that list only if the
maintainer says so."* **Not** a widening of `compile`, whose glossary entry is *"Emits restriction
only — never an `allow` rule"*: a skills path is a capability grant, which is the other direction.

- Resolves packs through `compile.mjs`'s `rootPlan` + `resolvePack`, exactly as `recipe-set` does, so
  the precedence rule (**named > discovered > derived, never union**) keeps one carrier.
- For each composed pack, reads `contributes.skills` and emits the path the plugin manifest must
  declare, **relative to the plugin root**.
- Refusals, never silence: a pack that will not resolve, a `pack.json` that will not parse, a `packs`
  that is not an array, a `contributes.skills` that is present and not an array. Exit 2 —
  could-not-run — never a quietly smaller set.
- Standalone printer, as `recipe-set` is:
  `node cli/skills-set.mjs --workspace .portulan --repo-root . --plugin-root .`

### 2. `--check` and `--write`

`--check` compares the derived set against the manifest's **pack portion** — entries under the roots
the composed packs actually resolved from, **not** an assumed `./packs/`. Exit 0 agree · 1 drift · 2
could not run. Entries outside those roots (`./core/skills/`, `./plugin/skills/`) are not this tool's
business and are preserved verbatim. _(This read "inside the plugin root's `packs/`" while the
derivation used a wider rule — the two-partition defect pre-commit finding 1 records. One partition
now, derived from where packs resolved.)_

`--write` rewrites **only** the `skills` array, preserving every other key and the file's existing
form. It carries the three rules the writers before it paid for: refuse a symlink on the destination
chain, only `ENOENT` means absent, and **never create a manifest that is not there** — a workspace
shipping no plugin is a legitimate state, not a hole to fill.

### 3. `plugin-lint`'s `compose` check reaches the carrier

The check gains a **declaration side** beside its tree walk: it asks the carrier what the manifest
must declare, where the walk asks what the tree actually holds. The converse direction (*declared but
composed by nobody*) and the scoping to the governing workspace are untouched.

**This is a check ADDED, not one consolidated** — and the plan claimed otherwise. It cited proposal
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md), *one rule losing a second
implementation*, which does not fit: the two derive from **different evidence**, and a pack whose
declaration and tree disagree is a finding only both together can produce. Collapsing them would delete
that check. Corrected here rather than shipped, because a doctrine citation that does not fit is worse
than no citation — and left visible rather than deleted, since the plan is the thing the checkpoint
graded.

### 4. The bundle's own manifest is held to the derivation

`--check` is wired into [`../verify/plugin.sh`](../verify/plugin.sh) — the recipe that already owns
packaging, so no new recipe and no manifest change. Expected first result: the derived set **equals**
the hand-typed entry exactly.

## The eight session-open findings, folded

The checkpoint returned **APPROVE-WITH-ADJUSTMENTS** in a fresh Fable 5 context. Recorded here rather
than edited invisibly into the plan it was grading. Every one is taken, including those it did not
mark blocking.

1. **The `vendor` reading rests on `m07.md`'s own amendment glosses**, not on `vendor.mjs`'s help
   text. Applied in *clarify* above; the help text is demoted to corroboration.
2. **#228 item 1 is DROPPED.** The maintainer's condition was *fold in if the files are already
   open*. Nothing in this task opens `cli/doctor.mjs` — only #228 item 1 itself would, which
   satisfies the condition circularly. The `legibility()` affordances dedup and the `unreadable`
   unit fix stay in [#228](https://github.com/sleepy-panda-srl/portulan/issues/228). **Item 2 is
   taken**: `personaFiles.includes(name)` inside the loop over `bound`
   ([`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs), the persona↔binding correspondence) is
   O(P·B) and becomes a `Set`. Behaviour-preserving, and this task opens that file.
3. **#184 has a second half this must not be read as closing.** The issue carries *two* remainders of
   #134: pack registration (this mechanism) and **"a workspace cannot inherit another"** — the
   portfolio-layer-plus-something-of-its-own case a pointer cannot express. #184 exists *"so that
   closing #134 drops nothing"*; closing it on the generator alone would drop half 2 by the same
   mechanism. **The pull request does not close #184.**
4. **`HOST_SKILL_DEPTH` is measured, not exported** — a module-local `const` at
   `cli/plugin-lint.mjs:1233`; the exports are `PluginLintError`, `AGENT_DIR`, `parseFrontmatter`,
   `inspect`, `run`. Verified rather than taken on the supervisor's word. Exporting it *from*
   `plugin-lint` would make an import cycle, since finding 3's rewiring has `plugin-lint` importing
   the carrier. **The constant moves into `cli/skills-set.mjs`** with its re-measure-on-host-upgrade
   note, and `plugin-lint` imports it from there — the carrier of the registrable set carrying the
   platform constant its derivation depends on, the way `AGENT_DIR` already flows plugin-lint →
   doctor. `skills-set` imports only from `compile.mjs`/`discover.mjs`, so no cycle.
5. **`--write` stays; the sentence about it was the overclaim.** The criterion's own noun is *the
   generator*, and `--check` alone would police the hand rather than retire it. But wiring `--check`
   into `plugin.sh` does **not** make the bundle's manifest "derived rather than typed" — the entry
   stays typed and is now *held to* the derivation. Fixed here before it could be copied into the
   delivery record.
6. **Three carriers move from the records push to the CODE push**, because each describes the code
   rather than the session: `spec/pack.schema.json`'s `contributes.skills` description (whose own
   2026-08-03 rule is that the note changes in the change that opens the consumer — the
   nine-minutes-stale precedent this task cites and would otherwise have repeated),
   `cli/README.md`'s roster, and `verify/plugin.sh`'s *"One check"* header, made false by finding 4
   of the deliverable.
7. **The handoff index is regenerated in the records push.** `verify/index.sh` fails when a generated
   index is not exactly what its source renders, so a new dated handoff without a regenerated
   [`../handoffs-index.md`](../handoffs-index.md) is a red the plan had not listed.
8. **A pack that resolves OUTSIDE the plugin root is a fourth outcome**, and the contract names it.
   Both packs here resolve in-tree, but the adopter case discovery exists for — a pack resolved from
   the host's plugin cache — resolves fine and has **no path expressible relative to the plugin
   root**. That is not drift (exit 1), not could-not-run (exit 2), and must not be silence: it
   registers through its own plugin or not at all. It is a **named report**, excluded from the
   derived set, leaving the exit code alone.

## The pre-commit findings, folded

**REQUEST-CHANGES**, in a fresh context that re-measured rather than read: eleven recipes run
individually, the suite reconciled test-by-test (31 + 7 + 8 = 46; 1357 + 46 = 1403), the byte-identity
of `--write` confirmed by hash, the new `plugin-lint` rail forced red by a hand-built bundle, and the
import cycle checked by tracing. Attacks on the two-carrier defence, the fourth outcome and the cycle
came back clean. One finding was a real defect and it is the reason this file has this section.

1. **BLOCKING — two partitions of one fact, and neither `--check` nor `--write` converged.** The
   derivation emitted a path for **any** pack resolving inside the plugin root; the declared side
   recognised a path as ours **only** under `<pluginRoot>/packs`. Anything in the gap was derived and
   never recognised as derived: `--check` reported the same drift forever, telling the user to run
   `--write`, and `--write` appended a duplicate entry on every run. **Reachable with no flags at
   all**, from a `tree` pointing anywhere but the conventional place — which is to say from an
   ordinary adopter's layout, the very case this session exists to serve. Reproduced before fixing.
   The partition is now derived from where packs **actually resolved** — two segments up from each
   pack directory, the way `resolvePack` builds it — so it cannot diverge from the derivation by
   construction rather than by a second option somebody keeps in sync. Pinned by a fixed-point test
   (`declaredFor` applied twice changes nothing) and a sub-tree layout in the suite.

   _Why every green passed over it: this repository's own layout makes the two partitions coincide.
   The live test, the byte-identity check and the **31** unit tests written before the fix all ran
   inside the one arrangement where the bug is invisible — **a harness written against blind spots
   inherited this one**, the seventh measured instance and the second in this session alone. (This read
   **36**, which was the count *after* the fix added five partition tests — tests written to break the
   bug cannot be counted among those blind to it. One number, three carriers, in a session whose stated
   lesson is that a count is a claim. Raised at the pre-commit re-check.)_
2. **The Status cell's `Left:` edit was contingent on 1.** Striking *(b) parity's adopter half* while
   the adopter layout was the broken one would have claimed delivery for exactly the case that did not
   work. It stands now that the mechanism works on both layouts, with D5 still listed separately.
3. **The diff was not stable while it was being graded** — it grew from 10 files to 14 mid-review, and
   the supervisor's first suite run was red purely from a mid-write tree. A verdict cannot certify a
   moving target, and the records were never in scope for that pass. **The tree is frozen and the
   checkpoint re-run over the whole diff, records included**, rather than treating the first verdict as
   covering them.
4. **`cli/README.md`'s roster was still wrong after being "corrected".** `rule-carriers` is a fifth
   runnable tool, has been since 2026-08-10, and appeared in that file **zero** times — while the
   parenthetical announcing the correction invoked the sibling-roster rule. A second count in the same
   file said **seven** files have no table row; re-derived by walking `cli/*.mjs` against the table, it
   is **eight** — the list named `stop-gate`, which has a row, and omitted `rule-carriers` and its
   suite, which do not. Both corrected from the measurement.
5. **The writer checked two steps where its three siblings walk the whole chain.** `readManifest`
   lstat'd only the manifest and its parent, so a **symlinked `--plugin-root`** was resolved straight
   through — `init`'s own failure, nine files written into an unrelated directory and reported as
   success. Now the full chain from the named root down, on `cli/new.mjs`'s rule: above the named path
   resolve, at it and below refuse. Tested.
6. **The moved measurement lost its evidence.** `HOST_SKILL_DEPTH` kept its re-measure mandate and
   dropped the date and the observed counts (`./packs/rituals/` → 0 of 3, `./packs/…/skills/` → 3 of
   3). A platform fact nothing can detect a change in needs the numbers a re-measurer compares
   against. Restored.
7. **A claim in the boot skill outran the code**, and was falsified by finding 1: *"in anybody's
   workspace and not only in this bundle"*. It now names the two layouts this is demonstrated on.
8. **A test that narrated instead of asserting.** `assert.ok(0 <= HOST_SKILL_DEPTH && 1 <= HOST_SKILL_DEPTH)`
   restated the line above it and would have kept passing if the derivation began emitting a parent or
   a child. Replaced with the property it was gesturing at.

## The pre-commit RE-CHECK findings, folded

The first pass graded a tree that grew from 10 files to 14 underneath it and never saw the records, so
it asked for a re-run on a frozen diff. That pass returned **APPROVE-WITH-ADJUSTMENTS (6)** over all 14
files, having rebuilt the adopter layouts by hand rather than reading the fix. Two of the six were
defects the first pass could not have found, because they were in the fix itself.

1. **The fallback owned set was layout-dependent — in the fix for layout-dependence.** With nothing
   resolved, `owned` fell straight to `<pluginRoot>/packs`, so a workspace that had **stopped
   composing** kept a stale entry forever anywhere but the conventional layout. `run` now shares the
   roots `rootPlan` produced, and the convention is the last resort rather than the first.
   Demonstrated on a `tree: "../sub/"` workspace: the stale entry is now cleaned.
2. **A resolution root containing the plugin root swallowed hand-written declarations.**
   `--pack-root <pluginRoot>` makes every declared path read as a pack path, so `--check` called
   `./core/skills/` uncomposed and **`--write` deleted it** — the contract's *preserved verbatim*
   turned into data loss, one flag away. **Refused** (exit 2) rather than narrowed: excluding the
   plugin root from the owned set while still deriving under it would put the two partitions back out
   of step, which is the defect the partition exists to prevent. The guard applies only to packs
   **inside** the plugin root — written without that condition it fired on every external pack, whose
   resolution root is `/`, and the fourth-outcome tests caught it at once.
3. **`cli/README.md`'s rowless count was wrong twice, and the second time is the instructive one.** A
   first correction said **eight** and claimed to have re-derived it "by walking `cli/*.mjs` against the
   table" — but the walk matched a filename **anywhere** in the table, so `stop-gate.mjs` counted as
   having a row on the strength of a link inside its test's description. A row is an **anchor at the
   start of a line**; re-derived that way it is **nine**. The method was named accurately and executed
   differently, inside the paragraph that exists to say a count is a claim.
4. **"Thirty-six unit tests" was never the blind number** — it is the count *after* the fix added five
   partition tests, and tests written to break a bug cannot be counted among those blind to it. **31**
   ran blind. One number, three carriers, corrected in all three.
5. **`skills-set.live.test.mjs` shipped stale inside its own diff**, saying the blind-spot phenomenon
   had been measured *five* times while the records in the same diff counted the sixth and seventh —
   both from this session. The file guarding against inherited blind spots undercounted by exactly its
   own session.
6. **The records ended at the first verdict.** This section is that finding.

_What the re-check confirms rather than adjusts: the partition fix holds under every layout it
attacked — several roots at once, a symlinked `packs/`, a `tree` outside the plugin root, mixed
resolved and external packs — and `resolvePack`'s `category/name` grammar is what makes the two-segment
recovery exact. The symlink boundary was verified by hand on a raw macOS `/var/folders/…` path, which
the suite's `realpathSync(os.tmpdir())` sidesteps._

## What this does NOT establish

Written before the work rather than after, so the close is not held to it.

- **Not D5.** Invocation parity through a host is a separate session's demonstration. This makes
  registration derivable; it does not show a skill invoked.
- **Not clause (b) whole**, and not clause (c), which stays ungradeable until (b) is demonstrated.
- **Not #184 whole** — finding 3. The generator discharges the mechanism of the registration half
  only; that half closes when D5 demonstrates, and *a workspace cannot inherit another* is untouched
  and keeps its carrier.
- **It writes no adopter's plugin manifest from nothing** — only the `skills` key's pack portion, and
  only where a manifest already exists.
- **The payload manifest (`packs/.claude-plugin/plugin.json`) is a different derivation.** A payload
  ships packs rather than composing them, so it has no `packs` array to derive from. It keeps
  `plugin-lint`'s existing walk-based check.
- **The host's expansion depth is a measurement, not a derivation.** `HOST_SKILL_DEPTH` was measured
  on Claude Code 2.1.224/2.1.226; a host that changes it makes every derived path wrong and nothing
  here would say so.
