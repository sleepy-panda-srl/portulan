# 0018 — A verdict from the context that did the work is not a verdict

**Status.** Accepted on merge — the maintainer decided both halves on 2026-07-30 and his merge of the
pull request below ratifies the drafting.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/137

**Companion:** [`0019`](0019-the-development-cycle-is-doctrine-not-anecdote.md) states the cycle this
obligation is one moment of. The incident list below is the evidence for both; 0019 cites it rather
than repeating it.

## The claim

[`../../core/operating/loop.md`](../../core/operating/loop.md) defines two lanes and says what the full
one carries that the triage one does not: all five phases, the plan written down, the failing test
first. It says nothing about **who supplies the verdict**, and in practice the answer has been *the
context that made the change* — which is not a verdict but a self-assessment wearing one.

The failure mode is not dishonesty and no amount of care removes it. A context grading its own
implementation has already read every rationalisation it wrote for itself, so it measures the work
against the reasoning that produced it rather than against the standard. It reliably concludes that the
change does what the change was trying to do. That is agreement, not correctness.

This framework has known the argument since milestone 1 and had it in the wrong places. It is stated in
[`../../core/personas/reviewer.md`](../../core/personas/reviewer.md), which is one *staffing* of a
review; and in the checkpoint pack's README and supervisor persona, which are a *procedure* for running
one. Neither is core, and a workspace that composes no ritual pack and delegates to no reviewer persona
received the obligation from nowhere. The mechanism belonged in the loop.

## The change

Two carriers, and the split between them is deliberate.

**[`loop.md`](../../core/operating/loop.md) — the full-lane bullet** gains a third obligation beside the
written plan and the failing test:

> - **Full lane** — for change with real blast radius: all five phases, the plan written down, the
>   failing test first, and the verdict from a **context that has not seen the implementation** — a fresh
>   window, a different agent, or a human. A verdict primed by the implementing context measures
>   agreement, not correctness: the context that did the work has already read every rationalisation it
>   wrote for itself, and grades the change against the reasoning that produced it rather than against
>   the standard. Who reviews, and at which moments, is the workspace's; that it is not the implementer
>   is the mechanism. _(Provenance: agentic craft — last-mile review focus, Karpathy / Hashimoto;
>   Cognition — read-isolated review. See `../personas/reviewer.md`.)_

**[`verification.md`](../../core/operating/verification.md) — a new section**, placed after *The
hierarchy* and before *The failing test is the spec*:

> ## The ceiling on self-verification
>
> The hierarchy orders the *evidence*; it does not say who may certify it, and the certifier has a
> ceiling of its own. A context grading its own implementation is not an independent measure of it, for
> the reason `loop.md` gives where it makes the fresh verdict a full-lane obligation — which is why on
> that lane the verdict comes from a context that has not seen the implementation. This is a limit on
> the **verifier**, not a fourth rung on the hierarchy: a fresh reviewer of an unexercised change still
> has nothing to grade, and climbing the hierarchy remains the work. _(Provenance: read-isolated review
> — Cognition; last-mile review focus — agentic craft. The measured argument, and its limits, are in
> proposal 0018.)_

The second carrier **cites** the first rather than restating the priming argument. Before this change
that argument had two carriers in the pack; drafted as first written it would have had four, which is
the shape [`../dod.md`](../dod.md) conditions 6 and 7 were each repaired out of — a mandate with two
carriers is obeyed at the narrower one.

## Why this is the lane and not new ceremony

The objection to answer is [`../../docs/vision.md`](../../docs/vision.md)'s binding non-goal: **no
ceremony that can't scale down**. It is answered by routing the obligation through the mechanism that
already exists for exactly this.

The lane system **is** the scale-down valve. The full lane already carries two obligations the triage
lane does not — the plan written down, the failing test first — and the engine already states the
principle that governs which: *"Not every task earns the full loop. A one-line fix should not carry a
plan document."* A third obligation joining that list is scoped by the same valve, priced by the same
threshold, and switched off for small work by the same sentence. Nothing new decides anything.

Three fences make that concrete, and each is a thing this proposal does **not** do:

- **The triage lane is untouched.** Its text is unchanged: research → implement → verify collapse into
  one pass, the plan is a sentence. A one-line fix takes no reviewer.
- **The Stop-gate is untouched.** It remains the machine floor that never scales down. This obligation
  is prose beside it, not a change to it.
- **The five-phase table is untouched**, and this is the part most likely to look like an omission. The
  table binds **both** lanes, so a fresh-verdict clause in the Verify row would leak the obligation into
  triage; and a clause scoped with *"on the full lane"* would be a second, narrower carrier of the lane
  bullet. Neither is acceptable, so the done-condition keeps its wording and the lane bullet is the
  single carrier. _(If the maintainer prefers the table to carry it at ratification, the wording must be
  **indicative** — "a context that has not seen the implementation graded it and did not refute it" —
  never the subjunctive "could not refute it", which is satisfied by imagining a reviewer, which is the
  failure mode this proposal exists to remove.)_

## The altitude table

The one discipline this change lives or dies by. Each row states what its layer may say and what it may
not, and the cascade direction — **core < pack < workspace** — is why a violation in either direction is
a defect rather than a preference.

| Layer | Supplies | May never supply | Here |
|---|---|---|---|
| **Core** | the mechanism: *that* the verdict comes from a context which has not seen the implementation, and why | a threshold, a who, a procedure, a pack name, a model name | `loop.md`'s full-lane bullet; `verification.md`'s ceiling |
| **Pack** | the procedure: named moments, a persona to staff them, a verdict vocabulary | the lane boundary; a standard of its own | `packs/rituals/checkpoints/` — which already refuses both |
| **Workspace** | the threshold (which work crosses into the full lane), the who, the recording surface | a lowering of core's floor | `.portulan/gate-map.md` § Supervised-build checkpoints; `dod.md` conditions 7 and 8 |

**Model names never enter core.** That Opus 5 implements and Fable 5 supervises is customer zero's
instantiation, recorded in [`../../docs/plan.md`](../../docs/plan.md)'s protocol and in
[`../identity.md`](../identity.md), and it is exactly the kind of specific
[`../../docs/vision.md`](../../docs/vision.md) thesis 6 says persists only in the layer its owner
controls.

## Provenance — this build's own record, verified at source

Six incidents from a repository whose product is its files. Every one was found by a context other than
the one that made the change, and every one was invisible to the change's own author at the time.

1. **The check that was green on the record it was minted from.** The Session-log correspondence check
   was drafted as a *presence* test and passed on the very plan.md whose defect had motivated it; it
   reds on `origin/main`'s own plan.md only after being rewritten to count both directions. Caught at
   the **session-open** checkpoint — before implementation, which is the moment a self-graded session
   has nothing to grade yet. _(Session log, 2026-07-28, [#73](https://github.com/sleepy-panda-works/portulan/pull/73).)_
2. **The hole list that was itself a hole.** [#60](https://github.com/sleepy-panda-works/portulan/pull/60)'s
   constitution write-gate was called *done* and shipped with a published list of its own gaps. A
   supervisor's attack pass found **five holes that list had missed** — the list had four entries — and
   fourteen review rounds then found **three more live bypasses the attack pass had not tried**. Eight
   in all, every one found after the gate was called done by the context that built it.
   _([`../../docs/milestones/m08.md`](../../docs/milestones/m08.md).)_
3. **The relocation that dropped a deliverable.** Moving 55,643 characters of argument into
   `docs/milestones/` lost a clause from milestone 5's row. Caught at **pre-commit** by a fresh context
   re-measuring the diff against the criterion it claimed to preserve. _(Session log, 2026-07-29,
   [#96](https://github.com/sleepy-panda-works/portulan/pull/96): "pre-commit (4), which caught M5's row
   losing a deliverable".)_
4. **Six prose defects, zero wrong counts** —
   [#133](https://github.com/sleepy-panda-works/portulan/issues/133). Every figure
   [#129](https://github.com/sleepy-panda-works/portulan/pull/129)'s code emitted was right, in every
   drill, on every run. Six *sentences about* those mechanisms were wrong. **This is the entry that cuts
   both ways and it is stated as such:** two fresh-context checkpoints, a twenty-five-shape forced-red
   drill and eight green recipes found **none** of them — they attacked mechanisms, and nobody attacked
   the claims — while **Copilot, an outside reader of the diff, found five of the six.** So this is
   evidence for *a reader who did not implement*, and evidence against any claim that *this particular*
   fresh-context ritual is sufficient.
5. **The arc that took no checkpoint at all.** The Dependabot work took **no checkpoint at any of the
   three moments**, and **two of its three defects were found by Copilot rather than by the
   implementer** — the incident that put the doctrine-and-floor trigger into the gate map in the first
   place. _([`../gate-map.md`](../gate-map.md) § Supervised-build checkpoints.)_
6. **The pack already says it, one layer down.** The supervisor persona keeps its memory separate from
   the implementer's *"so a verdict is never primed by the notes of the context it is grading — which is
   the same argument as the fresh context, one layer down."*
   _([`../../packs/rituals/checkpoints/personas/supervisor.md`](../../packs/rituals/checkpoints/personas/supervisor.md).)_

**External.** ETH Zurich's curated-beats-generated finding is the constitution's thesis 5 and is cited
here for the *direction* only — it concerns the curated context layer, not review independence, and is
not offered as evidence for this rule. The load-bearing external adoption is the influence map's
**last-mile review focus** (Karpathy / Willison / Osmani / Hashimoto), which until now had a home in
`core/personas/reviewer.md` and none in the loop the reviewer serves. This change gives it that home.
No `vision.md` edit is needed or permitted: the map already records the adoption.

## Enforcement, stated at its real strength

This rule **neither enforces itself nor measures itself**, and by
[`../../core/operating/evolution.md`](../../core/operating/evolution.md)'s own test it must therefore
earn the context-window tokens it costs as prose. The six incidents above are that argument, and the
honest statement of the limit is the pack's own, which this change leaves standing:

> **It cannot enforce the freshness, and the freshness is the entire mechanism.** No `tools:` list and
> no permission rule can observe whether the context reading a checkpoint skill has already seen the
> work. It is a property of how the checkpoint was *invoked*.

So this proposal ships **no rail and claims none** — which keeps it inside [`../dod.md`](../dod.md)
condition 4, since it describes no enforcement that does not exist. What can be railed already is: the
recording surface. A workspace that records verdicts can check that a verdict exists; it cannot check
that the context which wrote it was fresh.

## Limits

- **The sample is n=1.** The priming failure mode is general — it is a property of a context having
  written its own justifications, not of this team — but the evidence is **one team's fortnight of
  doctrine-heavy work on a documentation-shaped repository**. No claim is made that the effect size
  transfers to a codebase, a larger team, or a different cadence.
- **Incident 4 is a counterexample as much as an example.** A fresh context is not a superset of an
  outside diff-reader; on #129 it was a strict complement, and the two classes were **disjoint**.
- **The cost is real and is not priced here.** A second context per full-lane change costs latency and
  tokens. Core states the obligation; **the workspace prices it** by where it sets the lane threshold,
  which is the only place the trade-off can be made with knowledge of the team's actual blast radius.
- **Nothing measures whether this works.** Milestone 8 owns evals and telemetry; if this rule is ever to
  be retired or tightened on evidence rather than taste, that is the row that supplies the evidence.
- **One carrier, and the option not taken is priced here rather than hidden.** The obligation lives in
  the lane bullet alone; the five-phase table's Verify done-condition is unchanged. The alternative — the
  table carrying it too — was declined at the session-open checkpoint for the two reasons in *Why this is
  the lane and not new ceremony*, and the price of declining is that a reader who consults only the table
  will not see the obligation. **If the maintainer prefers the table to carry it at ratification, the
  wording must be indicative** — *"a context that has not seen the implementation graded it and did not
  refute it"* — and never the subjunctive *"could not refute it"*, which is satisfied by imagining a
  reviewer, and imagining a reviewer is precisely the failure mode this proposal exists to remove.

## Decision

Marius Cetanas — decided 2026-07-30; **accepted on the merge of
[#137](https://github.com/sleepy-panda-works/portulan/pull/137)** — because a verdict primed by the
context that produced the work measures agreement rather than correctness, and the loop's lane system is
the valve that keeps the obligation off small work.
