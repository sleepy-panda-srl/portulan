---
tier: on-path
paths:
  - "docs/plan.md"
  - "docs/milestones/**"
  - "CHANGELOG.md"
  - "changes/**"
  - ".portulan/handoffs/**"
  - ".portulan/proposals/**"
  - ".portulan/memory/**"
  - "package.json"
  - "evals/releases/**"
description: The plan, the changelog, handoffs, proposals, memory records and releases, and the form each takes.
---

# Writing the plan, a record or a release

You are on a path where this repository keeps its record. A change's record is its commit: a subject that
says what changed, a body of a few lines that says why, and a `Seam-scan: clean …` trailer.

- **The plan.** `change-the-plan` is Propose. The Status column of `docs/plan.md` moves when the work
  moved milestone state, and only then. The `plan` check keeps each row to its five cells, free of
  amendment arguments and session notes, with its Status within 500 bytes; history goes to
  `docs/milestones/`, moved verbatim.
- **The changelog** is one fragment per change, `changes/<slug>.<section>.md` holding one top-level
  bullet, and `CHANGELOG.md`'s `## Unreleased` holds none of its own.
- **A handoff** is written only when a session ends with work not committed and pushed, and names what
  is open.
- **A proposal** is `.portulan/proposals/NNNN-slug.md`, records its outcome under `**Decision.**` or
  `**Status.**`, and names by full URL the pull request that filed it.
- **A memory record** carries its provenance and a `Retire when:` condition, within the manifest's
  per-record budget, and `node cli/index.mjs --pack-root packs .portulan examples` regenerates the index
  the `index` recipe byte-compares.
- **A release** is Gated, the tag and the publish alike, and carries an eval result,
  `evals/releases/<version>.json`, which the `release-eval` recipe checks. Read
  `.portulan/gate-map/gated.md` under *Releases*, and `.portulan/identity/stack.md`, first.
