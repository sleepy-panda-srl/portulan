# Handoff — ownership rides authorship, and the label makes it filterable

**Date:** 2026-07-29 · **post-M5, no milestone row touched** · Branch
`agent-driven-ownership-label` · [#99](https://github.com/sleepy-panda-works/portulan/pull/99)

**State.** The maintainer ruled on the ownership question #95 refuted (verbatim: *"go with option B,
wire the agent-driven label"*) — the machine-user route declined, authorship confirmed as the
ownership carrier, and a declared label as the filterable mark. This session wired it. Suite 635,
eight recipes green.

## Where the label lives, and where it deliberately does not

`agent-driven` is a **third vocabulary** in `labels.json` — `ownership`, beside `labels` and
`intake` — because it answers a third question: *who drives this pull request*, not *what part of the
repository it touched* and not *what kind of report arrived*. Folding it into `labels` would have let
a pull request satisfy the at-least-one policy by carrying `agent-driven` alone, the exact fold-in
the file's own `$intake` comment warns about. `pr-labels.yml` reads `.labels[].name` and nothing
else, so the checker and every workflow-filters fixture are untouched — verified by the suite, not
asserted.

## What was applied live, and by whose hand

The label was created with `gh label create` (declaring in the file does not create it — the recorded
lesson), then applied to open [#95](https://github.com/sleepy-panda-works/portulan/pull/95) and
[#96](https://github.com/sleepy-panda-works/portulan/pull/96), the two open agent-driven pull
requests — forward-only, no backfill of merged ones. Those two label writes were the agent's hand
under the maintainer's credentials, executing his dated ruling; each pull request carries a bot
comment saying exactly that, the in-artifact attribution the identity table requires. Labeling
neither re-triggers a Copilot round (`labeled` is not in `copilot-review.yml`'s trigger list) nor
disturbs `pr-labeled` (it re-runs and re-greens; the policy refuses only the unlabelled).

## The wiring, split the way the repository splits everything

Where nobody is present, machinery: `librarian.yml` now labels its weekly pull request
`--add-label workspace --add-label agent-driven` in the same App-raised call — first natural
demonstration is Monday's pass, 2026-08-03. Where a session is present, convention with a home: the
gate map's Propose tier now says an agent-driven pull request carries `agent-driven` **beside its
area label, never instead of one**, applied in the session's own `gh pr create`.

## One stitch deferred, named rather than hidden

The gate map's ownership paragraph — the one that posed this question — lives on #95's branch, not on
`main`, so recording the ruling inside it cannot happen from this branch without riding #95. That
sentence lands in this pull request's strict-mode rebase push after #95 merges, and the pull request
body says so. Known-benign adjacencies, stated: #96 rewrites `docs/plan.md` (relocation) while this
branch tail-appends one entry — clean either order, and the handoff index regenerates; #95 appends to
`librarian.yml`'s end while this branch edits its label call — non-overlapping hunks.

## Fidelity

Session-open APPROVE-WITH-ADJUSTMENTS (5) — branch from `main` not from #95's branch, label #96 as
the sibling, record the ruling verbatim without invented gloss, word the Propose sentence so
`agent-driven` can never read as satisfying at-least-one, attribute the maintainer-credential label
writes. Pre-commit APPROVE-WITH-ADJUSTMENTS (3) — the citation made true on this tree, the unvouched-Monday clause into the log entry, and the create-time obligations. All folded in. Seam scan clean across
diff, commit message, and branch name.
