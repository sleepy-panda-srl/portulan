**type:** rule
**dated:** 2026-09-23
**scope:** workspace — every session working in this repository
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/blob/8a33f9b/.portulan/handoffs/2026-09-23-x-records-in-commits.md`
— the maintainer's direction of 2026-09-23, *"let the code do the actual talking and handoff - not the
md files"*, which moved this rule as its retirement condition asked. It was ruled 2026-07-25 on
[#5](https://github.com/sleepy-panda-srl/portulan/pull/5) as *every session ends with a handoff*.

A session that ends with work not committed and pushed ends with a dated handoff in
[`../handoffs/`](../handoffs/): where things stand, the open questions and the next action. Committed
work carries its why in its commit message, so a handoff says nothing the diff or a commit says.

**Why it holds:** the why is the part a later session cannot reconstruct from the diff, and the commit is
where the diff is. Under the rule this replaces every session wrote a handoff, a Session log entry and an
index line, and every pull request open at once wrote to the same two files: all 15 of 2026-09-23's pull
requests that had another merge land while they were open conflicted there.

**A gate enforces it since milestone 4.** [`../../cli/stop-gate.mjs`](../../cli/stop-gate.mjs) blocks the
end of a session whose tree holds uncommitted or unpushed work and has no handoff dated today. It checks
existence and a date, never length or shape, and releases after three consecutive refusals of this
reason.

**Retire when:** something records open work automatically and verifiably, for instance session state the
host keeps and the next session reads.
