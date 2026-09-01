# 2026-09-01 — the payload gets a roster it cannot forget

**Off the milestone row — packaging, [#383](https://github.com/sleepy-panda-srl/portulan/issues/383)'s
first half.** The session before this one removed three modules from the payload and left two gaps
named in its own PR body. This closes the first: **nothing derives payload membership**, so a module
landing in `cli/` joined the published package unremarked. That is how the three got in.

## What landed

[`../../cli/payload.mjs`](../../cli/payload.mjs), its suite, the `payload` recipe (**26 declared, 27
yielded**), a
forced-red drill, and two small exports that exist so this rail can ask rather than re-type:
`HOOK_RUNNERS` in [`../../cli/compile.mjs`](../../cli/compile.mjs) and `packedPaths` in
[`../../cli/pack-identity.mjs`](../../cli/pack-identity.mjs).

Every shipped `cli/*.mjs` falls in exactly one class: **31 = 1 bin · 8 subcommand · 6 imported ·
2 hook-runner · 1 product · 13 unruled**.

## The fourteenth module, which arrived while this was being written

**The best evidence the rail works is that it caught something nobody planted.** Rebasing onto `main`
brought [`../../cli/release-eval.mjs`](../../cli/release-eval.mjs), landed independently in #381 — a
fourteenth unreachable shipped module, joined to the payload unremarked exactly as the A/B trio had.
The frozen class refused it and refused the escape hatch by name.

His ruling made it **`product`**, and that created the class: the rail could record the *absence* of a
ruling and had **nowhere to put its presence** — a gap it exposed in itself on first contact. `PRODUCT`
is where `UNRULED` empties into as #383 is answered, one entry at a time.

**Two holes in that new class were found by forcing them rather than reading them.** A fourteenth name
pushed into `UNRULED` produced **no finding at all**, while the code beside it claimed *the rail asserts
the class is exactly these names* — the overstated-enforcer defect this repository names, written by me
in the same file that refuses it elsewhere. And a module present in **two registers at once** — which
only became representable the moment `PRODUCT` existed — was silent; a ruling that adds an entry and
forgets to delete the one it supersedes would have gone green claiming both *ruled* and *nobody ruled*.
Both are now red, on `eval-bundle.mjs`'s `assertPartition` precedent.

## The design question, and the answer that was not mine

**Three fresh-context supervisors, and the second was asked without being told what the first or the
maintainer had said.** Both ruled the same way and the maintainer's call agreed: build the rail
now with the thirteen recorded as `unruled`, rather than holding it until he rules. The argument that
carried it is [`../principles.md`](../principles.md)'s — *given a choice between a rule an agent must
remember and a check that fails loudly, take the check, even a cruder one* — against a gap already
measured at roughly a module per session when it fires.

**The condition that makes `unruled` honest rather than a fail-open is that it is FROZEN.** The rail
asserts the class is exactly those thirteen names; a fourteenth module may not join it, and the
unclassified finding says so in its own text. An open hole class is the shape
[`../gate-map.md`](../gate-map.md) condemns — coverage-reading machinery over an escape hatch — and the
cheap fix under pressure is exactly to widen it. That is why the refusal is in the message a person
reads at 2am and not only in this file.

**The second supervisor also declined a deletion I had offered him.** The tempting move on #384 was to
delete `../identity.md`'s standing payload figure and let this rail be its single carrier. It is wrong,
and the file says so itself at line 41: *"The pack-file counts below are restated at each cut because a
release is a moment somebody re-measures; a test count has no such moment, so it gets no number."* A
per-commit rail derives **tree membership at a commit**; the figure records **what the registry serves
for a published tag**. Same integer, different subject, and CI never runs on a clean clone of a tag.
#384 stays open and is its own session.

## What the tree told me that I would not have found

**Three of this repository's own rails caught this change while it was being written**, and each was a
real defect rather than a formality:

- `cli-roster.live.test.mjs` and `docs.sh`'s `cli-table` — the new module was in no roster.
- `drills.mjs` — a rail with no forced-red drill. Its `--check` is a correspondence pass and runs
  nothing, so `--only payload --working-copy` is what actually watched it fire.
- `pinned-roots.live.test.mjs` — **the one I would never have thought of.** `payload.mjs` imports
  `compile.mjs`, which put the suite inside that sweep's derived closure, so without a hermetic guard a
  case here would read whatever packs happen to be installed on the machine it runs on. The sweep
  derives membership from **imports** rather than from what a module currently does, on the stated
  ground that an internal refusal is one edit from being relaxed.

**And one test of mine was wrong in the direction that matters.** Dropping a module from the payload
while it stays tracked fires **two** findings, not one — a stale `unruled` entry and an unexplained
absence. I had asserted one. The rail was right; the assertion now names both and says why narrowing it
would have been the mistake.

## Undemonstrated, and named rather than left

- **That the remaining thirteen belong in the payload.** No measurement here supports keeping them;
  they are kept by nobody having been asked. #383 is open and carries `Blocked on: Maintainer ruling`.
- **The walk is static.** It refuses an unaccounted dynamic `import(` rather than following it, so its
  guarantee is *no unexamined edge*, never *the graph is complete*.
- **One known-bad input.** The drill proves the rail fires; it does not prove it catches everything, and
  `drills.mjs` prints that sentence on every green for this reason.
- **The rail cannot verify a ruling's author.** `PRODUCT` says *the maintainer ruled this*; what makes
  that true is his merge over the register, the same and only authority `EXCLUDED` ever had.
- **A rebase is where this session's prose went stale, twice.** The third supervisor found six carriers
  still holding pre-rebase figures, and one conflict resolution had silently dropped `release-eval` from
  the `cli/README.md` roster by taking a whole side of an additive conflict. Neither was caught by a
  rail; both were caught by a reader who re-measured.
