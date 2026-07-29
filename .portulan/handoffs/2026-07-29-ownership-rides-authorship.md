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

Where nobody is present, machinery: `librarian.yml` now labels its weekly pull request `workspace`
(fatal on failure — the gated area label) and then `agent-driven` in its **own best-effort call**,
split in this pull request's round one so the optional ownership label can never take the required
one down — first natural demonstration is Monday's pass, 2026-08-03. This paragraph said "in the
same App-raised call" until round two's suppressed note caught it describing the coupling the same
pull request had already removed — the stale-carrier class, caught in the record that was writing
it down. Where a session is present, convention with a home: the
gate map's Propose tier now says an agent-driven pull request carries `agent-driven` **beside its
area label, never instead of one**, applied in the session's own `gh pr create`.

## The stitch, deferred and then landed where it said it would

The gate map's ownership paragraph — the one that posed this question — lived on #95's branch until
#95 merged, so recording the ruling inside it could not happen from this branch at first. The pull
request body named the deferral; the strict-mode rebase push after #95's merge landed it: the ruling
sentence sits in that paragraph now, the Propose paragraph's citation was upgraded from a #95 link to
the section that carries the measurement, and round three's triaged wording fix rode along (the
librarian's failure message now says create-then-apply, since a missing label defeats a bare
apply-by-hand). Both rebases resolved as predicted: #96's relocation against this branch's
tail-appended entry, #95's `librarian.yml` tail against this branch's label-call edit — non-overlapping
in both directions, the handoff index regenerated rather than hand-merged.

## Fidelity

Session-open APPROVE-WITH-ADJUSTMENTS (5) — branch from `main` not from #95's branch, label #96 as
the sibling, record the ruling verbatim without invented gloss, word the Propose sentence so
`agent-driven` can never read as satisfying at-least-one, attribute the maintainer-credential label
writes. Pre-commit APPROVE-WITH-ADJUSTMENTS (3) — the citation made true on this tree, the unvouched-Monday clause into the log entry, and the create-time obligations. All folded in. Seam scan clean across
diff, commit message, and branch name.
