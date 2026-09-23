# Handoff — 2026-09-23: the boot skill reads its pointer and pack steps only where they apply

**What landed.** The maintainer's later ruling on proposal
[`0036`](../proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md), given at 17:07 UTC on a
question put to him at 13:44, and the move it allows. Step 2a of the boot skill, resolving a pointer
manifest, now sits in [`pointer-manifest.md`](../../plugin/skills/portulan/pointer-manifest.md), and step
3a, what declared packs deliver, in [`packs.md`](../../plugin/skills/portulan/packs.md). The skill keeps
each step's heading and one instruction: where the condition holds, read the file and follow it, and a
denied read is step 1's case. 0036's *keeps its procedure* sentence carries the amendment as an
annotation, and the ruling is recorded there with his words. No mechanism changed.

**Measured on `74a2a31`, before and after.** [`SKILL.md`](../../plugin/skills/portulan/SKILL.md) went
from 17,813 to 8,451 bytes, which is all a boot on a workspace that is not a pointer and names no pack
now reads of it. A workspace naming packs reads 14,732 with `packs.md`. This repository and the demo both
name two, so their boot read-sets went from 95,602 to 92,521 and from 36,195 to 33,114 bytes. A pointer
reads 12,899 with `pointer-manifest.md`, and one whose workspace names packs reads both files, 19,180
bytes, 1,367 more than before: the two stubs and two headers are the price of the on-read path. At 0036's
estimate of 2.99 bytes per token, a boot on a workspace with neither saves about 3,130 tokens, and this
repository's boot about 1,030.

**How "moved, not deleted" was checked.** #432's clause-level comparison, run over three files: of the
old skill's 229 clauses, 108 stayed in the skill, 56 moved verbatim to `pointer-manifest.md` and 63 to
`packs.md`, and 2 were given an antecedent (*the `packs` note below* is now *step 3a*, and *the slots
above* is now *step 3's slots*). None is missing and none sits in two files. The skill's intro and the
header of [`rationale.md`](../../plugin/skills/portulan/rationale.md) now say where steps 2a and 3a are.

**One limit, kept rather than rounded off.** The two files sit in the bundle beside the skill, so a
session whose reads are scoped to the project, the case step 1 measured, is denied them as it is denied
the kernel. Before this change such a session still had steps 2a and 3a in context; now it says the step
did not load. Its boot was already incomplete at step 1.

**Checkpoints.** No session-open or fresh-context pre-commit checkpoint ran: skipped by his instruction
of 2026-09-23 12:38 (no fresh-context runs unless he asks). The coordinator session reviewed the diff
before the commit; his review is on the PR.

**Green in this container needs a non-root run**, as the earlier handoffs record: `tests` ran as a
non-root user on a copy of this tree, and every other recipe ran as root.

**Next action.** 0036's order resumes at change 1, `core/operating/context.md`. The Stop-gate's named
demotion, relaying failing lines only, needs nothing before it.
