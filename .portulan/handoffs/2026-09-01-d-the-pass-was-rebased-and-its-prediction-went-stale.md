# Handoff — the pass was rebased, and its one prediction went stale

**Date:** 2026-09-01 · **Triage lane** · Opus 5 implementing · Rebasing the scheduled librarian's
pull request [#378](https://github.com/sleepy-panda-srl/portulan/pull/378) onto `main`.

## What this session did

The cron filed #378 on 2026-08-31 from `a642d551`. Eight pull requests landed on `main` afterwards
(#377, #379, #381, #382, #385, #386, #393, #397), seven of them carrying a handoff, so the branch was
`CONFLICTING` / `DIRTY` and could not merge. This session rebased it onto `116da835` — **three times**,
because `main` moved under it twice more while CI ran — and resolved the same two conflicts each round.
They are the two append points `a-branch-syncs-with-main-before-it-merges` predicts by name.

- **`.portulan/handoffs-index.md`** — a generated, byte-compared file, so it was **regenerated, not
  hand-merged**: `main`'s copy taken whole, then `node cli/index.mjs --pack-root packs .portulan
  examples`. 156 → 158, this session's own handoff being the second. The pinned root is not
  decoration — a bare run **refused**, because `rituals/checkpoints` resolves both from `packs/` and
  from a copy discovered in this host's plugin cache, and the index digests the answering copy's
  memory scope. The checker declining to pick is `a-checker-must-refuse-what-it-cannot-check` working.
- **`docs/plan.md`** — both entries kept, the resolution this repository already has on record. The
  pass's entry is placed **chronologically**, after 2026-08-31's session 6d and before the entries
  dated 2026-09-01, rather than at the new tip. The pass ran at 13:26 UTC on 2026-08-31, before any of
  them; appending at the tip would have put a 2026-08-31 date after six 2026-09-01 dates and added a
  second backward step to a log that has exactly one. Nothing rails ordering — this is judgement, and
  it is recorded here so it can be overruled cheaply.

## The finding worth keeping

**A rebase can falsify a derived record without touching a figure in it.** Every count in the pass's
handoff is a dated snapshot and survived the move intact. One sentence did not: `cli/librarian.mjs:917–919`
emits a fixed prediction — *"Expect the regenerated index in the same pull request to show exactly one
more"* — and the index in this pull request reads **nine** more than the 149 the pass examined: seven
that landed on `main` in between, the pass's own record, and this one. The mechanism was right and the
prose went wrong, which is this repository's dominant defect class arriving by a route nothing here had
met: **not drift at a stale carrier, but a correct sentence invalidated by a merge that changed nothing
it named.**

Repaired with a **dated note, not a rewrite** — the figures below it are left exactly as measured,
because a figure corrected after the fact is a figure nobody ran.

**Authorship was the second half of the same repair.** The note is hand-written prose, and the first
rebase folded it into the pass's own commit, where git would have attributed it to
`github-actions[bot]` while the note's own first clause said it was not the pass's. `librarian.yml`
reasons explicitly about which identity commits what; a record contradicting its own attribution is
the same fault from the other side. So the branch is **two commits**: the pass's, authored by the bot
and carrying only derived content, and this one, authored by the maintainer with the session's
co-author trailer. **It is therefore rebase-merged, not squashed** — a squash would collapse the two
authors into one and falsify the sentence you are reading, in the same commit that lands it.

**Each rebase found this session's own figures already wrong**, which is the finding turned on its
author. *Five merges* was the handoff count standing in for the merge count; the handoff first
collided on its date letter with #397's `-c-`, the hazard
`2026-08-26-the-handoff-letter-collided-twice-more.md` already records; and every count here has now
been re-derived three times rather than adjusted. **The lesson is the cheap one: derive at the base
you are actually on, and re-derive rather than patch.**

**Not repaired, and it is a decision rather than an oversight:** the emitted sentence is unconditional
in `cli/librarian.mjs`, so the next pass that gets rebased will say the same false thing. Making it
conditional, or dropping the prediction and letting the index speak, is a change to a shipped module
and belongs to a session that can grade it. Filed as a note here rather than patched in a rebase.

## Verification

All **27** recipes the manifest yields ran green in this working copy —
`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs` for the set. Seam scan
clean over diff, commit messages and branch name, **control-verified**: the same pattern was re-run
against a planted term and matched, so the empty result is a scan that ran rather than one that could
not. Copilot's round returned **four presentational notes and no correctness finding**; three were
taken (a heading, a split code reference, a missing `cli/` prefix) and the loop was not run again, on
the maintainer's instruction not to wait on it.

## What is owed

The pull request is a **draft-and-nag artifact addressed to the maintainer**, and this session changed
nothing about that: none of its nags is answered by rebasing it. The merge was his explicit
instruction, given in-session; `gh pr view 378 --json state` is the only honest check that it happened.
