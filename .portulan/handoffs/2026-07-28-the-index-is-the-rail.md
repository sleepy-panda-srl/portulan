# Handoff — the index is the rail, and the store had nothing to consolidate

**Date:** 2026-07-28 · **Milestone 5 (Memory lifecycle & librarian), session 0 of 1–2** · Branch
`m5-the-index-is-the-rail`

**State.** Clauses 1–3 of the row, in one pull request: `cli/index.mjs` + its suite, the eighth verify
recipe `index.sh`, `core/skills/consolidate/SKILL.md`, spec 2.2 → 2.3, and `doctor`'s three new checks.
Suite 442 → 490. All eight recipes green. Clauses 4 and 5 — the scheduled librarian's first real PR,
and proposals-as-PRs — are session 1.

## Decisions, and why

- **Two budget axes, not one.** The maintainer's call, asked because the row's words name only the
  index. An index budgeted in lines rails record *count*; a store whose count never moves can double in
  bytes with the index unchanged, and the directive behind the sharpening was "memory growing too
  large". So `index.budget.lines` and `store.budget.kilobytes`, plus `index.budget.columns` to stop one
  enormous line absorbing what the line budget counts. Nothing defaulted — the `floor` object's rule
  from 2.2, for the same reason.

- **The numbers are the maintainer's: 40 lines / 120 KB against 23 records and 88.8 KB**, and they were
  set twice. He first chose 60 / 200 from three options, then reversed to the recommended 40 / 120 when
  the consequence was flagged back at him — that 60 / 200 is a **ceiling** several milestones away
  rather than a rail that fires on its own. Recorded as a reversal rather than presented as a first
  answer, because the reasoning is the useful part: a rail nobody reaches teaches nothing, and the cost
  of setting it too tight (an interrupted session with nothing to consolidate) is smaller and more
  visible than the cost of setting it too loose (a store that grows for a year while a green check says
  it is fine). At 40 / 120 the index sits at **72%** of its budget and the store at **74%** of its own —
  the two axes bind at about the same time, which is the property to keep if either number moves again.

  The demonstration is still **forced**, and every record says so: 29 lines under a budget of 40 is not
  a rail firing naturally, and no arithmetic makes it one.

  Applying the reversal exercised the coupling this change documents. The line budget is written into
  the index header, so changing it **staled both indexes** and the recipe went red until they were
  regenerated — the budget could not move without dragging the generated file it governs into the same
  diff. That is the whole of what stands behind the no-raise rule, and it was observed rather than
  assumed.

- **Titles come from filenames, not from headings.** The plan had them derived from each record's H1.
  The session-open supervisor found that **24 of the 27 live records have no H1** — the template
  prescribes none — so the rule as drafted would have failed nearly the whole store on its first run.
  Filenames are already the title every cross-reference in this repository uses. A record that *also*
  carries an H1 must carry the same title in it: two carriers of a name are tolerable, two answers are
  not, and comparison normalises away punctuation a filename cannot hold so a comma is not a
  disagreement.

- **The index sits beside the store, not in it.** `doctor` walks every `.md` in `slots.memory`, so an
  `INDEX.md` there would be counted as a record, sized into the KB figure, and — measured — would have
  turned `tests` red immediately, because `doctor.test.mjs` binds both live stores to the rule that
  every record states a retirement condition. The alternative was to exempt the index's filename from
  the walk. Rejected: an exemption by name is a door any record could walk through, and eight fail-opens
  of that shape have been found in this repository's own scaffolding. A siting rule has no door, so
  `doctor` **refuses** a manifest that sites an index inside its own store.

- **The conditional requirements are `doctor`'s, not the schema's.** The declared keyword subset has no
  `dependentRequired`. The count went one → three in a single MINOR, and `spec/README.md` names that as
  the thing to watch rather than absorbing it quietly.

- **The generator writes an over-budget index rather than refusing to.** The remedy is consolidation and
  consolidating needs the artifact to consolidate *from*. So writing can return `1`, which is where
  `index` differs from `compile` and is worth knowing before reading either.

## The demonstration, and what it does not show

The row asks for red→green where the green comes from consolidation, never from a budget raise.

**A survey of all 23 retirement conditions against the tree found no live consolidation candidate** —
not one condition has fired, and no two records state one fact. (`repo-is-private-until-flip-clearance`
already consumed its fired condition by in-place supersession on 2026-07-27; the two review-loop records
are deliberately separate halves of one subject.) Reporting that either way was pre-registered at the
session-open checkpoint, so it is reported rather than papered over with a merge nobody needed.

The pass therefore ran on a purpose-built twelve-record store where the moves are genuinely correct:
two records whose conditions had fired, retired; two pairs that each state one fact, merged with **both
parents' provenance carried forward**. 18 lines → 14, budget **untouched at 14**, green.

**And the same run shows the road not taken.** Raising the budget 14 → 18 goes green as well, and
nothing stops it. Refusing a raise needs a check that reads git history, and a check that reads history
is a false-red generator in a shallow CI checkout — the failure this repository holds to be worse than
no check at all. So the breach is machinery and the remedy is a human-gate rule, and both sentences are
now in the tree instead of one of them being implied by the other.

Thirteen forced observations against a scratch copy of the real tree are recorded in
[`../verify/README.md`](../verify/README.md). One is worth repeating here because it surprised its own
author: **editing a record's prose leaves the index green.** The index carries a title, a path and a
type, all derived from the record's name and one field, so it goes stale on the record *set* rather
than on record content — which is what keeps an ordinary edit from churning a generated file.

## What the pre-commit checkpoint found, and it was a defect this session wrote

**APPROVE-WITH-ADJUSTMENTS**, five required, all folded in. It replayed the red→green on its own
scratch store rather than reading the transcript, re-ran the retirement survey and reached the same
answer, and forced twenty-odd probes including several this session had not thought of — an unreadable
record, a broken `GIT_DIR`, `grep` off the `PATH`, deleting the `memory` object entirely.

The finding worth carrying: **the heading check was a false-red generator, and it would have shipped.**
`headingOf` matched `#` at the start of *any* line, so a record with no heading at all but a shell
comment at column 0 inside a fenced block — `# regenerate the thing` — came back as carrying that
comment as its title, and the check failed a record whose filename was never in question. Two live
records already contain fences. It now reads the **first non-blank line only**, with the residual limit
written down rather than left to be found. The irony is the point: this is a check whose job is to stop
the store holding two answers about a record, and it was inventing a second answer out of a code
comment. And the class is one this repository has already named — a false red is not a milder failure
than a false green, it is the one that gets a whole check switched off.

Three more were straightforward and all real: a shipped `core/` skill linked into **this workspace's**
memory, which is thesis 6 broken inside the layer that exists to hold it; the "a raise shows in two
diffs" claim is true of the `lines` budget only, because that is the one number written into the index
(measured — lowering `columns` or `kilobytes` produces a lone budget red with no staleness beside it);
and *thinnest of the eight* was said of a recipe that is second-largest at 100 lines.

**Recipe-count siblings, fixed in the same stroke.** Five places restated a count of verify recipes or
test suites far from the one dated carrier in `verify/README.md` — four already stale before this
change, one made stale by it. The numbers are removed rather than corrected: `affordances.md` claimed
in one breath that a suite could be added *"without this bullet changing"* and hard-coded the figure in
the next, which is the argument for deleting it rather than resetting it. A sixth was found by this
session's own sweep and missed by both checkpoints — `affordances.md` still told an agent that
**memory has no generated index**, in the file whose whole purpose is telling an agent what it may rely
on.

## Open questions

- **Should a workflow-layer check refuse a budget raise in the same pull request that takes the index
  red→green?** The supervisor's suggestion, and it is buildable there — the PR's base is available, so
  it needs no history read from inside a recipe. Not owed by the row. It should become an issue rather
  than a sentence in a README claiming the raise is unrailable in principle, because it is not.

## Next action

Session 1: the scheduled librarian (reindex; staleness — the sealed-stamp re-validation nag and the age
half of the store report `doctor` cannot give, which is where git history legitimately gets read;
proposal nagging; demotion drafts) filing its **first real PR**, and proposals-as-PRs live. It starts
from a store that now has both an index to regenerate and a written consolidation procedure to run.

**Recoverability.** Everything is on one branch; nothing outside the tree was changed, and the
demonstration ran in scratch directories under `/tmp` that hold no repository state.
