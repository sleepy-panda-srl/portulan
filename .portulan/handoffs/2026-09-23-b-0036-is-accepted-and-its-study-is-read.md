# Handoff — 2026-09-23: 0036 is accepted, and the study it cited is read

**What landed.** Proposal [`0036`](../proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md)
moves from PROPOSED to ACCEPTED. [#429](https://github.com/sleepy-panda-srl/portulan/pull/429) merged it
with its decision still pending. The maintainer had delegated the ruling to the project's coordinator,
which accepted it with revisions, and he then asked for them to be applied. This change applies them and
nothing else: the cited study stated under *Provenance*, *pointer* defined in rule 1, four accuracy fixes,
and two wording fixes from review. Row 12 of [`../../docs/plan.md`](../../docs/plan.md) takes the one fix
that reached it. **Nothing is built.**

**The study, read.** arXiv 2607.17598 found that a second routing level never helps and sometimes breaks
accuracy, measured on long-document question answering rather than instruction files. So 0036 now says the
study motivates the one-level rule and does not establish it. The new definition makes a file a procedure
always reads, such as the memory index at boot, loaded content rather than a second level.

**Why #429's records keep their words.** Its handoff and its Session log entry say the study was not
re-read, which was true that day, so they stand as written and the finding lives in the proposal. The
handoff's reason for naming the supervisor by role did not hold, because its own commits name the
implementing model in their trailers. It carries a dated correction under the original words, which
stay verbatim above it: the form of the handoff
[`2026-08-10-the-instrument-had-the-blindness-it-was-built-against`](2026-08-10-the-instrument-had-the-blindness-it-was-built-against.md).
Proposal `0018` is why a merged record's correction stays visible rather than applied silently.

**Checkpoints.** No checkpoint ran in a fresh context. After #429's drafting cost 110.3M tokens, the
project's coordinator set its threads to run without them unless the maintainer asks, and it reviewed
this diff itself. The maintainer reviewed the diff before commit. `docs` and `index` ran green.

**Still his.** The scan against his private term list runs on his machine.

**Next action.** The build, in 0036's order of work, one change per pull request.
