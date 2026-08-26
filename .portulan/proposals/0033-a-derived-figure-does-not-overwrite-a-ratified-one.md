# Proposal — a derived figure does not overwrite a ratified one; it is reported to the person who ratified it

**Incident.** Milestone 8 session 3 built the review-loop meter that clause (c) asks for, and its first
run disagreed with the record it was built to serve.
[`../memory/a-review-loop-needs-a-bound.md`](../memory/a-review-loop-needs-a-bound.md) bounds the loop on
a table measured by hand on 2026-07-28 — **110 submissions over 30 pull requests, 3.7 each, 29% finding
nothing**. Re-derived over the 30 most recently merged pull requests on 2026-08-26:
**140 submissions, 4.67 each**, with 67.1% raising no inline comment.

**And the two windows are disjoint**, which is the half a first draft of this proposal got wrong: the
ratified window is the thirty most recent as of 2026-07-28 and names #44, #49 and #57, while the derived
one runs #301–#354. They share no pull request. So this is not a re-count of his thirty coming out
different — it is the loop's weight a month later, measured in the units his `Retire when:` is stated
in. Saying it the other way would have asked him to rule on a contradiction that does not exist.

The session had a tool in hand that could have rewritten the table, and did not. This proposal is the
rule that made that the right call, written down so the next session does not have to re-derive it under
time pressure — and so that *not* updating a stale figure is not mistaken for an oversight.

**Proposed rule.** *Workspace altitude.* **A figure an agent derives never edits a figure a human
ratified. It is reported alongside it, dated, with the derivation named.** Where a generated register
exists, the ratified record may cite it; replacing the ratified number with the derived one is the
human's act, not the deriving session's. Three consequences, because the rule is otherwise easy to obey
narrowly:

1. **A disagreement is a finding, not a defect to fix.** The session reports the delta and stops. It
   does not rewrite the record, does not annotate it, and does not soften the original figure's wording.
2. **A tool may not be pointed at a ratified record as its output target.** `--write` writes the
   register; nothing writes the rule.
3. **The stale figure keeps standing until he moves it.** A ratified number left in place is the rule
   working, and a later reader finding both must be able to see which is which — so the register carries
   its capture date and the record keeps its own.

**Enforcement.** *Prose, and the argument for it is that the alternative is worse.* A rail here would
have to know which figures are ratified, and nothing in a memory record marks that — provenance records
where a rule came from, not which of its sentences a human personally set. Inventing such a marker to
rail this would put a second, weaker carrier of *ratified* beside the record's own provenance line,
which is the defect this repository names most often. What **is** railed is the half a rail can reach:
[`../verify/review-loop.sh`](../verify/review-loop.sh) holds the derived register byte-identical to its
snapshot, so the derived figure cannot drift either — and a derived figure that could drift would make
this rule pointless in the other direction.

The honest limit, stated rather than left for a reader to find: **nothing stops a session editing the
table.** This is a rule the human gate holds, exactly as
[`../../core/skills/consolidate/SKILL.md`](../../core/skills/consolidate/SKILL.md)'s *"the one move this
pass may not make"* is, and it is written the same way — a mandate presented as a rail it does not have
is worse than one that admits what holds it up.

**Provenance.** `form=link`
`href=../handoffs/2026-08-26-the-loop-is-heavier-than-the-rule-that-bounds-it.md` — milestone 8 session
3, 2026-08-26, the first run of `cli/review-meter.mjs` against `sleepy-panda-srl/portulan`. The
underlying practice is older and is his: on
[#105](https://github.com/sleepy-panda-srl/portulan/pull/105) the corrected round count was **held back
until a fresh context independently re-derived it**, on his sequencing, precisely because the number had
already moved once.

**Pull request:** [#357](https://github.com/sleepy-panda-srl/portulan/pull/357) — the change that filed this.

**Decision.** {human owner} — accepted | rejected | revised, on {date} — because {…}.

---

## What this proposal deliberately does not decide

**Whether 4.67 retires, tightens, or leaves the bound alone.** That is his, and it is the reason the
figure is reported rather than acted on. The record retires when submissions per pull request measures
**below 2.0 for a full milestone**; this window measures 4.67, which is not near it in either direction,
so nothing about the bound's continued existence turns on this measurement today.

**Whether the record should cite the register at all.** It would be the same repair this repository has
applied to recipe counts, corpus sizes and the CLI roster — *state the rule, not the tally* — but a
memory record is curated-layer and the repair would be an agent editing a ratified rule to say that
agents may not edit ratified rules. Named here as the obvious next question and left to him.

**Whether "for a full milestone" is measurable.** It is not, today: which pull requests belong to which
milestone row is not a field the API carries, so the meter measures a window of merged pull requests and
says so in the register rather than presenting a window as a milestone.

## A note the pre-commit checkpoint earned a place for

**The first figure this proposal was drafted around was wrong**, and not by a rounding error: the
capture had been windowed by pull request **number** rather than merge date, so the corpus escalated for
a ruling was not the corpus its own register named. It read 4.47; the correctly-sampled window reads
4.67.

That is worth recording *inside* this proposal rather than only in the session's handoff, because it
sharpens the rule rather than embarrassing it. A derived figure is not automatically better than a
hand-counted one — it is better only where its derivation is checkable, and this one's was not until a
fresh context read the generated data back against its own heading. **So the rule is not "prefer the
derived number". It is "the derived number goes to the person who owns the ratified one, with its
derivation named, and he decides."** Had the session been licensed to overwrite the table, it would have
overwritten a maintainer-ratified figure with a wrong one, quietly, inside the change built to end
hand-counting.
