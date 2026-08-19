# Handoff — the artifact says which world compiled it

**Post-M7 hardening, session 24 continued. Full lane.** No milestone row moves. Closes
[#264](https://github.com/sleepy-panda-srl/portulan/issues/264). Baseline `db45202`, suite
**1733 → 1745**, fourteen recipes green. Implementer Opus 5.

## The defect had already stopped being hypothetical

#264 said the tree's copy of `rituals/checkpoints` and the host cache's "are about to stop agreeing".
**They already had.** Measured on this host, with no doctored fixture:

- cache carries `"action": {"shell": "git commit --no-verify"}`
- tree carries `"action": {"none": …}` — proposal 0029's deliberate repair, which removed that matcher

So an unpinned `compile` here emits `.claude/settings.json` containing `"Bash(git commit --no-verify:*)"`
— a matcher the tree deliberately removed — and the pinned rail then reds. **No file in the tree carries
that matcher as live enforcement**: measured at `db45202`, seven occurrences across six files, every one
of them prose. _(An earlier draft of this handoff said "six occurrences, all describing its removal".
Both halves were wrong: seven, and two of them — `handoffs/2026-07-29-…:59` and `docs/milestones/m06.md:90`
— describe the matcher's ADDITION, from the milestone where it was introduced. The pre-commit checkpoint
caught it. The load-bearing fact survives the correction: no live carrier, so a reader diffing the
repository cannot find the rule the artifact enforces.)_ And the RED named the cache **zero** times: no
`cache`, no `discovered`, no `plugins`, no pack, no version.

## What ships

**Arm 4 — the artifact records what compiled it.** `$portulan.packs` carries, per declared pack, the
origin it resolved from and the version its manifest declares (from `portulan.version`, which is where
a pack actually keeps it; absence recorded as `null` rather than blank, because *declares no version*
and *I did not look* are different facts).

**Origins, never root PATHS, and that refusal is the design.** A discovered root is an absolute path
under somebody's home directory. Recording it would make a tracked artifact machine-dependent and red
`verify/compile.sh` for every developer and CI — trading a silent hazard for a permanent false one,
which is worse than the hole.

**The resolver's THREE tags collapse to two, and that is the control that keeps this honest.**
`resolutionRoots` tags roots `named | derived | discovered`. The pinned rail spells its root (`named`)
while a bare run derives the same directory (`derived`) — two documented-correct spellings of one
world. Recorded raw they emit different bytes and the recipe reds on a tree nothing is wrong with. So:
`discovered` iff discovery answered; otherwise `tree`; and a **named root outside the repository** is
`outside-tree`, never flattened into `tree`, because calling somebody's `--pack-root /elsewhere` "the
tree" would be this field's first lie. Demonstrated: pinned emit and bare emit on a cache-less host
produce byte-identical provenance; the shadowed host produces `discovered 0.2.0` against `tree 0.2.1`.

**Arm 2 — `doctor` reports the shadow, and says what differs.** Both halves: the version difference and
whether the gate fragments differ once parsed. Reporting only *that* a shadow exists would not retire
this issue — silence about the shadowed copy is the part that makes the drift unreproducible. An
unreadable shadowed copy is reported as **could-not-compare in so many words**, never as silence. A
report, never a verdict: an installed pack shadowing a tree copy is a fact about the machine, which is
the boundary `doctor` already states for discovered roots.

**Arm 3 — the remedy no longer loops.** The drift RED named the difference nowhere and prescribed
"Recompile", which typed bare is the act that caused it. It now names emitter-origin against
checker-origin at the moment of failure and gives the pinned spelling. Read **defensively**: the
artifact on disk is a file a human may have edited, so anything unparseable leaves the plain sentence
standing rather than turning a drift report into a crash.

## Honest limits

- **Provenance rides in the Claude Code artifact only.** `github-ruleset.json` emits to a fixed
  external schema with nowhere to carry a `$portulan` block; its provenance is the one line it can
  carry, in `name`. Both backends compile from one root plan per run, so the recorded origins describe
  the ruleset's inputs too — they are simply not readable in its file. `doctor`'s shadow report is the
  surface that covers both.
- Nothing **forces** the emit to be pinned. This makes an unpinned emit legible; it does not prevent
  one. The pin remains a habit, now with a rail that names it when the habit lapses.
- The shadow report fires where discovery answered. A pack present only in the tree, or only in the
  cache, is not a shadow and is not reported as one.
- **Two sentences that were false when first written, both caught in review.** `recordedOrigin`
  trusted the `derived` TAG instead of testing the path, so a manifest whose `tree` points outward
  (`tree: "../../elsewhere"` → `/elsewhere/packs`, measured) recorded `outside-tree` work as `tree`;
  a tag says where a root came from, and only the path answers the question this field exists to ask.
  And the shadow report's fragment clause claimed more than it compared, **twice**: first projecting
  `[id, tier, action]` while promising byte-identity — so two copies differing in `reason`, or in any
  field a later Pack Definition adds, read as agreeing — and then, once the whole fragment was
  compared, still saying *byte-identical*, which `JSON.stringify` of a parsed value cannot promise
  because it normalises the manifest's whitespace away. The comparison was widened where widening was
  right, and the CLAIM narrowed where it was not: reformatting a `pack.json` changes nothing about
  what the pack contributes, so the clause now reads *differ once parsed*.

- **The containment test, and a cycle reached for while fixing it.** `recordedOrigin` first spelled
  *inside the repository* as `!rel.startsWith("..")`, which calls a directory literally named `..foo`
  outside — the class `cli/index.mjs`'s `isInside` docblock records as the **ninth fail-open** in this
  scaffolding *and the first written by the change that cites the class*. This was the second. Reaching
  for that export then closed an **import cycle** (`index.mjs` already imports from `compile.mjs`), and
  this repository has had a cycle exit **13 in silence** before. So the predicate moved to a leaf
  module, `cli/inside.mjs`, re-exported from `index.mjs` — one implementation, no new edges. The first
  attempt used a bare `export … from`, which re-exports without binding the name locally; 104 tests
  said so immediately, which is the suite doing its job.

## Instrument

Sibling sweep, as it ran (BRE alternation — a `-E`-less bare-pipe grep returns 0):
`grep -rn -- "pack-root\|resolutionRoots\|discoverPackRoots" cli/ .portulan/verify/ .github/`
