# Handoff — 2026-09-23: the boot skill keeps its procedure and moves its reasons

**What landed.** The first of the two demotions proposal
[`0036`](../proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) names.
[`SKILL.md`](../../plugin/skills/portulan/SKILL.md) keeps every instruction; the reasons behind them,
with their measurements and incidents, moved to [`rationale.md`](../../plugin/skills/portulan/rationale.md)
beside it, under the same step numbers, read on demand. No mechanism changed.

**Measured on `bff4f3f`, before and after.** The skill went from 22,774 to 17,813 bytes. The demo
workspace's boot read-set (the skill, the kernel, identity, principles, gate map, definition of done, the
`combcount` card and the memory index) went from 41,156 to 36,195 bytes, and this repository's from
213,717 to 208,756. At 0036's estimate of 2.99 bytes per token, that is about 1,660 fewer tokens per
boot. A boot that also opens `rationale.md` reads 24,699 bytes, 1,925 more than before: its header and
lead-ins are the price of the on-read path.

**How "moved, not deleted" was checked.** The old file was split into 277 clauses and each was looked
up in the two new files: 219 are verbatim in the skill, 42 moved verbatim, 16 were split at a clause
boundary or given an antecedent, none sits in both files and none is missing. The comparison is not a
rail; the own-footprint rail is 0036's change 6.

**Why this lands before 0036's changes 1 to 5.** Its order puts the own-footprint rail and its two
demotions sixth. The demotion needs none of the first five: it moves text and changes no mechanism, so
adopters get it on their next plugin upgrade, and the rail will start from the smaller figure.

**Why so much stayed.** The pointer branch (2a) and the pack limits (3a) are 10,120 of the skill's
17,813 bytes, and they apply only when the manifest is a pointer or names packs. Reading them from files
opened on that condition would take the skill to about 8 KB, but that moves procedure, not reasons, and
0036 says the boot skill keeps its procedure. That is the maintainer's call, not this change's.

**Checkpoints.** No session-open or fresh-context pre-commit checkpoint ran. They were skipped by the
maintainer's instruction of 2026-09-23, 12:38 UTC: no fresh-context checkpoint or review run in this
project's sessions unless he asks. That is not the gate map's *unavailable* case, so the remedy is review:
the project's coordinator session reviewed the diff before the commit, and the maintainer reviews it on
the pull request.

**Green in this container needs a non-root run**, as the previous handoff records: `tests` ran as a
non-root user on a copy of this tree, and every other recipe ran as root.

**Next action.** 0036's order resumes at change 1, `core/operating/context.md`. The second named
demotion, the Stop-gate relaying failing lines only, needs nothing before it either.
