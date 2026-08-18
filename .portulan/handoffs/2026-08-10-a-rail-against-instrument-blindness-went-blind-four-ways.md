# Handoff — a rail against instrument blindness went blind four ways while being built

2026-08-10, off the milestone row, commissioned by the maintainer after
[#222](https://github.com/sleepy-panda-srl/portulan/pull/222): *"This needs a well structured change
to stop from it resurfacing."* **No criterion moves.** Stacked on #222, because the rail is green only
on the tree #222 sweeps.

## What was commissioned, and what it turned into

Three defect classes were named, in three separate instructions:

- **A** — one rule, many spellings; every sweep instrument blind to some of them.
- **B** — a counter that lied plausibly (`\b` is not ERE on BSD grep).
- **C** — records asserting things about git and GitHub state that no rail can see.

A fresh-context supervisor graded the draft design and returned **REQUEST-CHANGES**, with the finding
that mattered most: **B is already filed as [#187](https://github.com/sleepy-panda-srl/portulan/issues/187)**,
and re-proposing it would have been the two-carrier defect committed on the deliverable itself. It also
reframed A entirely — see below — and split C three ways.

## The reframing, which is the reason this is not `0020` written twice

`0020` says, and it is accepted doctrine:

> **For the class as a class, no rail is possible.** A rule has no token … the sibling set is exactly
> the thing nobody has enumerated, or the defect would not exist.

That holds and this change does not contest it. **The move is the word *unenumerated*.** An incident
enumerates the sibling set; at that moment the rule *does* have a token — the spellings actually found.
So the rail's job is **not to find carriers**. It is to **keep a completed reduction reduced**.

The supervisor found the evidence that this is a real need rather than a tidy idea: on 2026-08-10 #222
**removed** a hand-maintained count and roster from `repos/portulan.md`, and #206 had already repaired
the same line by **re-arming** them. A handoff on `main` is titled
[`the-correction-merged-and-the-next-pull-request-put-it-back`](2026-08-10-the-correction-merged-and-the-next-pull-request-put-it-back.md).
**Reduction is the repair, and nothing held it in place.**

## What shipped

- [`0027`](../proposals/0027-a-reduced-rule-stays-reduced.md) — the rule, **with a working rail**:
  `.portulan/rule-carriers.json`, `cli/rule-carriers.mjs` + 31 tests, `.portulan/verify/rule-carriers.sh`,
  declared in the manifest. **Eleven recipes now**, with no workflow edit — `0004`'s machinery.
- [`0028`](../proposals/0028-a-records-world-claim-carries-its-instrument.md) — **deliberately no rail.**
  Its rail is contingent on a maintainer ruling `0020` §6 already named and refused: *a fixed record
  form*. It ships the doctrine carrier for a convention the record layer already practises and nothing
  governs, plus B's control-case clause, with B's mechanical half **cited to #187, not re-proposed**.

## Four ways this instrument was blind while it was being built

Every one found by **running or forcing red**, none by reading. This is the part worth keeping.

1. **It exited 0 having run nothing.** The direct-invocation guard compared `process.argv[1]` against
   `new URL(import.meta.url).pathname`. This working copy lives under *Sleepy Panda SRL Projects*, and a URL
   pathname **percent-encodes the spaces**, so the comparison silently failed. A green that was the tool
   never starting. `fileURLToPath` now.
2. **The dead-tell audit was self-satisfied.** Every tell is spelled *in the registry*, so scanning the
   registry made each tell find **itself** and read as alive. It reported green over a tell matching
   nothing else in the tree. **It passed its first demonstration only because the registry was untracked
   in that scratch worktree** — the green was an artefact of the fixture, which is the exact shape of
   *the fixture agreed with the bug* from 2026-08-09.
3. **Markup between the words of a sentence — one trap, three variants.** A markdown link's URL sitting
   inside the phrase, in `dod.md`'s *run each recipe … declares* where the middle word is a link; a
   **line wrap**, in `slots.md`; and **bold markers inside the phrase**, in the record that wrote
   *workspace* and *declares* with emphasis between them. Four of the first seven tells matched nothing;
   two of those
   were also **invented rather than measured**, and the audit rejected them. *Invented is a claim*, and
   the audit is what makes that checkable instead of a maxim.
4. **Four raw NUL bytes in the source** — a map-key separator where the escape was meant, which is
   [#68](https://github.com/sleepy-panda-srl/portulan/issues/68)'s incident verbatim. `file` called the
   file *data*; **`grep` returned nothing for strings that were plainly there**, which is the only reason
   it was noticed. `control-chars.sh` named it in one run. **A rail written against instrument blindness
   was itself silently corrupted, and an existing rail caught it.** Then the *proposal describing that
   bug* acquired a NUL of its own, in the sentence describing it, and the same rail caught that too.

## What the rail does and does not catch — measured, not predicted

**Red on the pre-sweep tree (`27705ae`)**, naming five carriers including the root `README.md` — the one
three human sweeps across two branches missed. **Green on today's tree**, 350 files. All four verdicts
forced: exit 1 by planting a restatement in an uncited file; exit 2 three ways (dead tell, absent
carrier, unparseable registry).

**Two misses demonstrated rather than implied**, because a boundary claimed is not a boundary shown:

- `identity.md`'s **seven-name roster** — no tell reaches a count. That subclass is #187's.
- `cli/README.md` and `verify.yml` carried the rule and are **not** caught, because each cites
  `recipe-set.mjs` elsewhere and the citation exemption is **whole-file**. The declared weakness,
  measured.

## State

Eleven recipes green, run individually. Seam scan clean. Suite +31. Stacked on
`two-claims-the-world-refutes`; **it must not be rebased onto `main` until #222 merges** — the rail is
red on `main`, correctly, because the carriers #222 fixes are still there. That is the stacking
constraint, not a defect. One transient red is named rather than hidden: `tests` failed once with
`EISDIR` on a temp fixture during concurrent runs and passed on a clean re-run with no code change.
