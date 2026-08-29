# Handoff — rule 2 was asked to relax, and the measurement said no

**Date:** 2026-08-29 · **Follow-up to M8 session 6a** · Implementer: Opus 5.

## What landed

One paragraph in [`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md)'s
*Why it holds*: **rule 2's second and stronger rationale**. No rule changes, no number moves, 22 recipes
green. Plus [#368](https://github.com/sleepy-panda-srl/portulan/issues/368) and a comment on #93.

## The question, and why the answer is not "insufficient evidence"

Session 6a ended by putting one open question to the maintainer: **both of #366's suppressed findings
came from re-scan rounds that rule 2 would have prevented — rule 2 costs findings.** That framing was
mine and **two of the three measurements under it were wrong.**

- *"No records push introduced any defect"* — **false**. `4c2a496b`, a pure records push, wrote *"the
  bound … was never approached"* into the handoff. The bound had been **exceeded**. Four later Copilot
  submissions passed over it in silence.
- *"Every finding traces to the first commit"* — **false**. The `rule-carriers` finding was about text
  present at the base, already merged: the `exclude` array is byte-identical base to head.

**I nearly rejected the first correction using a line-based grep against a sentence that wraps** — the
same instrument error that produced a false correction of a correct checkpoint verdict one day earlier,
recorded in that session's own handoff. **Third time in two days that line-based matching on wrapped
prose returned a false answer**, and the first two were already written down.

## The conclusion

**Rule 2 stands unchanged**, and #366 is not a null result: it ran the experiment the question proposed.
Violating rule 2 three times **bought one finding and created one false claim** — same file, same
commit — and the created one sat in the loop's own record, the artifact a later reader most trusts.

The premise survives: a push really is the only reliable way to draw a Copilot pass
([#348](https://github.com/sleepy-panda-srl/portulan/issues/348), and *"measured twice"* elsewhere in the
store). **The inference fails**, because it priced only the pass and not the false record the push
writes on its way to buying one.

## What is deliberately NOT a proposal

A proposal exists to **change** the curated layer, and rule 2 is not changing. A numbered artifact whose
Decision reads *"accepted — no change"* is something a later reader mistakes for an amendment — `0020`'s
class in the governance layer itself. So this is an ordinary change to the record's rationale section,
where rule 2's first reason already lives.

## Two limits, named

**The record is now 8190 bytes against an 8192-byte cap.** The budget rail fired three times while this
paragraph was written and each repair was a compression, never a cap raise — which
[`../../core/operating/memory.md`](../../core/operating/memory.md) rules out in the change that breaks
it. **The next edit to this record forces a consolidation**, and that is a state rather than a defect.

**The lane.** One file, no rule change, no new claim about the product, no milestone effect — the gate
map's triage lane. The *content* was specified by a fresh-context supervisor that graded the question
and refuted two of my measurements, so the judgement it carries is not this context's own; no separate
pre-commit checkpoint was run, and that is stated rather than implied.
