# Handoff — the handoff letter collided twice more, and it cannot be checked as it stands

**Date:** 2026-08-26 · **M8 (Evals & telemetry), session 2, follow-up** · Implementer: Opus 5.

## What landed

**Two of this session's handoffs were renamed off letters another session had already taken**, and the
convention behind them was measured and filed rather than patched.

| Was | Is | Collided with |
|---|---|---|
| `2026-08-25-f-the-dispatch-half-is-observed-and-a-200-is-not-a-request.md` | `…-h-…` | `2026-08-25-f-the-reachability-was-retired-and-the-removal-was-not-taken.md` |
| `2026-08-25-g-the-thursday-cadence-is-ruled.md` | `…-i-…` | `2026-08-25-g-the-round-was-never-missing-the-page-was.md` |

**Mine moved because mine landed later** — established from git rather than assumed: the reachability
handoff first appears in `924f2d0e` at 21:49 and the dispatch one in `097775cb` at 21:55; the
round-was-never-missing one at 22:04 and the cadence one the next morning. Renaming the earlier file
would rewrite another session's merged record to make room for mine.

**Only the second collision was reported. Both are fixed**, which is `0020`: the same defect one letter
along, in files I created in the same arc, is the class rather than a second task.

## The letters are not chronological any more, and that is the honest trade

The dispatch handoff sits at 21:55, between the reachability `-f` at 21:49 and another session's `-g` at
22:04 — so there is **no free letter in its slot**. Keeping strict chronology would mean renaming merged
files that are not mine. Uniqueness is kept, ordering is not, and the letters now say only *these are
distinct*.

## The finding underneath: this cannot be railed as the scheme stands

**It has happened five times on three dates, not once**, derived from `git ls-files` over single-character
segments: `2026-08-19` `-b` twice, `2026-08-20` `-b` **three** times, and the two above. The cause is
structural — a branch cannot know which letter another branch will merge first — and one of those
sessions said so in its own commit subject: *"The handoff letter collided with one that merged while this
branch was in review."*

**And a rail cannot be added without changing the naming scheme first.** A single-character segment after
the date is *either* a series letter *or* the first word of the slug, and the filename cannot say which:

```
2026-08-10-a-correction-reached-three-carriers-of-four.md   ← slug starting "a"
2026-08-19-b-a-client-name-reached-a-public-repository.md   ← series letter "b"
```

A naive uniqueness check over date-plus-first-segment flags **25** of 140 handoffs, nearly all
legitimate (`the`, `a`). **That ambiguity cost three separate measurements while this was being
investigated** — twice inside checks I wrote for it, which is the check-inherits-the-blind-spot class
arriving in the instrument built to find the defect. Filed as
[#353](https://github.com/sleepy-panda-srl/portulan/issues/353) with three candidate schemes and none
presumed; board *When-open*, **blocked on a maintainer ruling**, because which scheme the series uses is
his and two of the three answers rewrite merged records.

**2026-08-19 and 2026-08-20 are deliberately left colliding.** Which of three files owns `-b` is not an
implementer's call.

## The near-miss worth more than the rename

**A blind string replace rewrote another session's link label**, and no rail could have seen it. Updating
`docs/plan.md` I replaced the label ``[`2026-08-25-f`]`` — which matched **twice**, once for my handoff
and once for the reachability one — leaving that entry labelled `-h` while pointing at the `-f` file.

**`docs.sh`'s `links` check passes over that**, because it validates **targets** and never labels. The
target still resolved; only the citation lied. Caught by deriving label↔target agreement across all
**82** handoff links in `docs/plan.md` rather than by reading the diff — and the derivation had to be
made ambiguity-aware before it was trustworthy, since its first form reported twelve mismatches that were
all the `-a` article. Final reading: **82 links, 0 real mismatches.**

That derivation is worth keeping whichever way #353 is ruled, and it is named in the issue for that
reason.

## State

`main` @ `e5eabcf` at branch point. Every recipe the manifest yields is green, exit codes read directly.
Seam scan clean over every path this change touches, the commit message and the branch name, with a
planted-term control reddening. No mechanism changed: two renames, four link updates, a regenerated
index, and this record.
