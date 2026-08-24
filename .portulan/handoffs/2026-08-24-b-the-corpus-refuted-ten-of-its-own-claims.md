# Handoff — the corpus refuted ten of its own claims, and found a hole nobody had recorded

**Date:** 2026-08-24 · **M8 (Evals & telemetry), session 0 of 1–2** · Implementer: Opus 5.

## What landed

**Milestone 8 clause (a) — adversarial fixtures per compiled gate — end to end.** Not the row: one
clause of eight, and the change says so in every carrier rather than in one.

- `cli/goldens.mjs` + `evals/goldens/gates/` (20 files, **212 cases**), declared as the `goldens`
  verify recipe. Graded through `compile.mjs`'s own exported `matchesRule` — never a second
  implementation — against the policy the workspace **yields**, at a **pinned** root, with host
  discovery refused internally as well as pinned in the recipe.
- **#71 closed** and **#70 closed**, riding this pull request on the maintainer's instruction.
- `evals/README.md` rewritten: the two senses of "eval" disambiguated, and every unbuilt clause given
  a condition-4 arrival sentence.

## Why the record matters more than the diff

**The rail went red on its first run and refuted ten of my own hand-written expectations.** I wrote
the corpus believing I knew what the matchers do; the corpus is the reason I found out I did not.
That is the clause's whole argument, met on the day it shipped.

**One of the ten was a real defect: a rule whose target is `./` matches nothing at runtime.**
`matchesPath` reduces `"./"` to the empty string and refuses the empty string, so
`edit-on-a-working-branch` and `read-anything-in-the-repository` answer false for every input.
Harmless today — both are `auto`, the compiler refuses `auto` wholesale, and `gate.mjs` reads only
`gated`/`prohibited`, so neither layer ever asks. But a **gated** rule written that way would compile
to a permission rule covering the tree and a matcher covering nothing: hole 3's failure mode by
another road. Now **gate-map hole 8**, asserted as `documented-hole` cases so a repair reds the corpus
until the record is updated. **Deliberately not repaired here** — what `./` should mean at the write
matcher is a policy question, and one of those at a time is the honest order.

**The other nine were my errors, and two were instructive.** `gh release list` is gated by
`gh release` — a shell target is a command *prefix*, so read and write spellings share it, and bare
`git tag` has the same shape. I had written both as "near misses" from the armchair.

## #71 cost more than the issue predicted, in two ways

The issue forecast "exactly one assertion" flips. **It flipped four** — the suite had grown two more
redirection rows since the issue was written. And a strip alone would not have worked: `commandSegments`
splits on `&` and `|`, so `2>&1 git push …` was already in pieces (`2>` / `1 git push …`) before
anything could strip a whole redirection, and `>|` broke the same way. The operators had to stop being
read as separators first — which closed `>|` and `&>`, two spellings the issue's own table never named.
`sudo`/`env`/assignment/`then`/`do`/brace-group are untouched, and the change says in three places that
it licenses no table of command prefixes.

## What the rails caught that I would have shipped

Four, all mine, all found by existing rails rather than by me:

1. **The entry guard.** `import.meta.url === \`file://${process.argv[1]}\`` — this working copy lives
   under a path with spaces, so the first run printed nothing and **exited 0 having run nothing**. The
   **third time** this repository has met that exact false green. The designated form is now copied
   rather than re-derived, and a spaced-path test pins it.
2. **A literal NUL byte** in `evals/README.md` and `cli/goldens.test.mjs` — I wrote `\u0000` as a real
   character while writing prose *about* storing bytes escaped. `control-chars` would have caught it;
   I caught it first only because I went looking.
3. **`cli/README.md`'s module roster** and **`pinned-roots.live.test.mjs`'s pinned roster** both went
   red for the new files. Both rails working exactly as built.
4. **The hermetic-host block** must be copied *verbatim* — my semantically-identical named-import
   spelling reddened the sweep, which is the sweep doing its job.

## Prose carriers repaired in the same stroke (the `0020` class)

- `.portulan/repos/portulan.md` recipe counts read **9-and-11** against a measured **14-and-15** — a
  five-recipe drift accumulated unnoticed. Fixed, **and the hand-copied recipe-name roster deleted**:
  a list that has gone stale five times is a worse carrier than the command that derives it.
- `.portulan/identity.md` enumerated **8** of 13 non-`docs` recipes and omitted `pack-identity`'s
  `npm` from the "one recipe needs a third thing" paragraph. Enumeration deleted, `npm` named.
- `.portulan/verify/README.md`'s file block listed **13** against a declared **14** —
  `version-carriers.sh` had been missing since it landed, **the second time that block has drifted in
  the same shape**. Both swept.

## State

`main` @ `f82fa2e`. **Suite 1870** (from 1801, +69). **All 16 recipes green** in this working copy.
Seam scan clean over **every path the diff touches**, generated files included, plus the commit message
and the branch name; planted-term control reddened. _(This sentence read "all 35 staged paths" until the
final re-measure, when the count was 39 — a figure written before the diff stopped growing, which is a
trap this repository has recorded three times. Restated as a SCOPE, which cannot go stale.)_ Three forced-red drills run by hand against the new recipe — missing fixture, `holds`
regression, `documented-hole` closed — each firing with exit read directly rather than through a pipe.

**Checkpoints.** Both Fable 5, fresh context. **Session-open: APPROVE-WITH-ADJUSTMENTS**, 9 adjustments,
all folded — its two binding findings I had missed entirely (the denominator must be the *yielded*
policy, and an unpinned run *refuses as SHADOWED* on this machine).

**Pre-commit: APPROVE-WITH-ADJUSTMENTS**, 3 adjustments, all folded — and the first is the one that
justifies the checkpoint on its own. **My #71 fix silently narrowed two gates.** The `&`/`|` non-split
reads one raw neighbour and cannot tell `>` the operator from `\>` the literal, so
`echo \>| git push --force origin main` — a **real pipe**, which the supervisor confirmed in live bash
delivering bytes downstream — stopped splitting, and the force-push after it went invisible. `\>&` did
the same across a real background separator. **Both were caught at HEAD and lost by the change whose
whole subject is honest hole accounting.** The segmenter is escape-aware now, the two spellings plus a
`<` sibling and a lease control are in the suite and the corpus, and 212 cases replace 208.

It found this by running a 192-probe differential of the staged matcher against HEAD's, and by probing
`LEADING_REDIRECTION` to 200KB for backtracking. Neither is something reading the diff would produce —
which is the argument for the checkpoint, again, in the same session that already made it once.

## Open for the maintainer

1. **Gate-map hole 8 has no issue.** Filing one is outward and Gated; it is recorded in the tree and
   awaits your word on whether it also becomes a tracker item.
2. **Row 8 has seven clauses left** against a 1–2 session budget. Your ruling stands — *"M7 was closed
   properly at any cost; M8 should follow"* — and is why nothing here was trimmed to fit.
3. **"From milestone 8, releases carry an eval result"** (plan.md → Protocol → Versioning) is a
   milestone-8 carrier that is not one of row 8's eight clauses. Unassigned; named in `evals/README.md`
   so it cannot go missing.
