# Handoff — the cost was paid once, and what the fire could not establish is recorded beside what it did

**Session:** 2026-08-20, continuing the same thread as
[`the cut the prose rail finally graded`](2026-08-20-the-cut-the-prose-rail-finally-graded.md), after
`v0.1.2` was released and he published to npmjs himself. Commission, verbatim: *"Record the packages
visibility finding in Unreleased. I'll go ahead and publish the package on npm."* Then: *"I've
published the package. Please double check."* **No milestone row moves.**
[#326](https://github.com/sleepy-panda-srl/portulan/pull/326).

## State

`v0.1.2` is **fully released on both registries**. npmjs carries 0.1.0/0.1.1/0.1.2 with `latest` at
0.1.2; GitHub Packages carries 0.1.1/0.1.2, `public`. #326 is open with the finding recorded. `main`
was `1e1f753` at the branch point.

## Decisions + why

- **The correction lands beside the claim, and the released entry is left alone.** The workflow header
  carries it because that is live prose a reader acts on. `CHANGELOG.md`'s `## 0.1.2` block is
  untouched: a record of what was measured on 2026-08-18 does not become false because a later fire
  measured something else, and the record layer is excluded from `version-carriers` by path for exactly
  that reason. The `## Unreleased` entry is the correction.
- **Both limits are recorded with the finding rather than after it.** The package was already public
  when this fired, so nothing here tests a **first** publish under a **new** name now that the org
  policy has changed — the half that matters to anyone adding a second package. And for the same
  reason it cannot re-test `--access public`: a flag cannot be shown to govern nothing on a package
  that was already public. Written in because the defect class this repository keeps hitting is a
  measurement true of one case recorded as though true of the class.

## The finding worth carrying

**The published artifact was verified against the tag rather than against the publish log.** All
**76** files were fetched from npmjs and compared byte-for-byte to `v0.1.2`: **76 identical, 0
differing, 0 absent**, and the registry's shasum `06a8981f…` equals the figure the tag message names —
which is only checkable because the tag was cut **before** the publish and named the hash it expected.
That is the whole point of that ordering, demonstrated for the first time here. The README npm froze
reads *"Current release: `0.1.2`"*, so the defect that forced `0.1.1` into existence is absent.

**And a false alarm worth recording, because the instrument was the layout.** `npx
@sleepy_panda_srl/portulan@0.1.2 doctor examples` run **from the repository root** answered
`sh: portulan: command not found`. Nothing is wrong with the package: npx resolved the local package
of the same name and looked for a bin that is not linked in a tree where `npm install` never runs. In
the layout a consumer actually gets — no source tree, no `package.json` — the same command exits **0**
and reports **GREEN**. The repository's own standing rule caught this: *run it in the layout the
consumer gets*. Had it been run only from the root, the release would have looked broken.

## Instruments

- **The seam scan's extractor over-collects, consistently.** Across three commits it flagged `INDEX`,
  `Session`, `Stop`, `EVERY`, `EXCEPT`, `Grep`, `Milestone`, `NEVER`, `Never`, `Ruling`, `THREE` and
  `Neither` — every one ordinary vocabulary present in 3 to 111 tracked files on `origin/main`. Clean
  each time, and loose in the safe direction.
- **`npm view … --json` reports `fileCount` and `unpackedSize`**, both matching the local pack exactly
  (76 / 1673691) — the cheap check before the expensive byte-for-byte one, and it agreed with it.

## Open questions

- **A first publish under a NEW package name is untested** now that the org policy has changed. Nobody
  needs the answer until a second package exists; recorded so that whoever does need it knows it was
  never measured rather than assuming this fire covered it.
- **#325** — `version-carriers` grades the index and its green does not say so. On the board at `Next`.

## Next action

He merges #326. Nothing else is owed by the release arc.

## Recoverability

Nothing partial, nothing outward. #326 is a branch touching two files, one of them a comment block.
Both registry entries and both tags are live and untouched by it.
