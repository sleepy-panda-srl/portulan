# 0019 — The development cycle Portulan builds itself with is doctrine, not anecdote

**Status.** Accepted on merge — the maintainer decided both halves on 2026-07-30 and his merge of the
pull request below ratifies the drafting.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/137

**Companion:** [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md) makes the
fresh verdict a full-lane obligation of the loop. This proposal states the **cycle** that obligation is
one moment of. 0018 carries the six verified incidents and the altitude table; both apply here and are
cross-cited rather than repeated.

## The claim

[`../../core/operating/evolution.md`](../../core/operating/evolution.md) ends with a paragraph titled
**Portulan is customer zero**:

> The framework is built the way it tells teams to build. The two-tier supervised build — an implementer
> plus a fresh-context supervisor grading against the constitution — is this doctrine turned on
> Portulan's own construction. If the doctrine will not hold for its own repository, it is not ready to
> ship.

Read closely, that paragraph is **self-description, not doctrine**. It says the framework practises what
it preaches; it does not state the practice as something an adopter receives. "This doctrine turned on
Portulan's own construction" points *back* at rules stated elsewhere — but the cycle it names is not
stated elsewhere. Nowhere in `core/` does an adopter learn that work is graded at three moments, that
the unit of work needs hard exit criteria fixed before it starts, or that the records cadence is what
makes the later moments gradeable.

So the most load-bearing thing this project knows about how to build with agents was in the repository
only as an anecdote about the repository. That is the gap this closes.

## The change

The section is replaced in full. The customer-zero sentence survives — demoted from the section's
subject to its final paragraph, which is the correct altitude for an instance.

> ## The supervised cycle
>
> The framework is built the way it tells teams to build, and that cycle is doctrine an adopter receives
> rather than a story about this repository. **Work is agent-drafted and fresh-context-graded at three
> moments**: the plan before building starts, the diff before it goes outward, and the exit criteria at
> the close — where done is *demonstrated, not asserted* (`verification.md`). Two conditions hold the
> cycle up and neither is optional. The unit of work carries **hard exit criteria** fixed before it
> begins, so the close has a standard to grade rather than an impression. And **every session ends by
> writing the record** (`loop.md`), so the context arriving at the next moment inherits the reasoning
> instead of re-deriving it — a graded moment whose grader must first reconstruct what was decided is
> grading its own reconstruction.
>
> The altitudes stay separate, and the separation is the part that travels. Core states that the three
> moments exist and that the grader has not done the work. **A workspace composes its checkpoint
> ritual**, names the moments in its own vocabulary, sets the threshold that decides which work earns
> them, and says who grades. Core names no ritual, no pack and no model: the cascade runs core < pack <
> workspace, so a core doc naming a specific pack would invert it.
>
> **Portulan is customer zero.** The two-tier supervised build — an implementer plus a fresh-context
> supervisor grading against the constitution — is this principle turned on the framework's own
> construction: the instance it generalises from, not the principle itself. If the doctrine will not
> hold for its own repository, it is not ready to ship.

## Why the three parts are the three parts

Each element earns its place by having failed here when it was missing.

- **Three moments, not one.** They catch different things because they grade different artefacts, and
  the record shows the classes are disjoint. Session-open grades a *plan* and caught a check that would
  have been green on the record it was minted from — a defect that stops existing once code is written
  to match it. Pre-commit grades a *diff* and caught a relocation that had silently dropped a milestone
  deliverable. Milestone-close grades a *demonstration* and, on 30 July, returned REQUEST-CHANGES on a
  clause the session had asserted rather than shown. A single moment catches its own class and misses
  the other two. _(Incidents 1, 3 and the M6 close; full citations in
  [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md).)_
- **Hard exit criteria, fixed before the work.** Without them the close has an impression to grade
  rather than a standard, and *done* becomes whatever was built. This is
  [`../../docs/vision.md`](../../docs/vision.md)'s inherited principle — "the verification hierarchy …
  applied to the product's own construction (hard exit criteria per milestone)" — which until now had no
  statement in `core/` at all.
- **Records every session.** [`loop.md`](../../core/operating/loop.md) already mandates the dated handoff
  and argues the case. What it does not say is why the *supervised cycle* needs it: a grader arriving at
  the next moment with no record must first reconstruct what was decided, and then it is grading its own
  reconstruction. That is the same priming defect as an implementer grading itself, displaced by one
  step, which is why the two rules belong in one principle.

## What this deliberately does not do

- **It does not name a pack, a ritual, a model, or a threshold.** Core says a workspace *composes its
  checkpoint ritual* — generically, because the cascade runs core < pack < workspace and a core document
  naming `rituals/checkpoints` would invert it. The checkpoint pack that exists is one composition and
  the doctrine must survive its replacement.
- **It does not set who grades or when.** The three moments are named functionally — plan, diff, close —
  never in the pack's own vocabulary. Which work earns them stays the workspace's threshold, for the
  same reason 0018's obligation does: only the adopter knows their blast radius.
- **It does not redefine "done".** *Demonstrated, not asserted* is
  [`verification.md`](../../core/operating/verification.md)'s and is cited, not restated.
- **It does not generalise this repository's own record rails.** The Session log, its 10-line entry
  budget and the log↔handoff correspondence check rail **the build's own milestone map**. A customer has
  no Session log. What the doctrine carries outward is the *cadence* — a record per session — whose
  adopter-side carriers are the handoff series, memory, and the librarian that reads them.

## Enforcement

Like [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md), this rule neither
enforces itself nor measures itself, so it earns its tokens as prose or not at all. Two of its three
parts have partial rails **in this workspace** and the difference matters: the records cadence has the
session-end gate (a handoff dated today must exist), the handoff slot, the template and the librarian;
the three moments have **none**, and the freshness that makes them work is unenforceable by construction
— *"no permission rule can observe whether the context reading a checkpoint skill has already seen the
work."* Those record rails are **customer zero's**, wired in this repository's compiled policy, not
something a new workspace receives. Closing that gap is the instantiation half, drafted for the
maintainer's ratification **in [#137](https://github.com/sleepy-panda-works/portulan/pull/137)'s own
diff** — row 7 of [`../../docs/plan.md`](../../docs/plan.md), with the argument in
[`../../docs/milestones/m07.md`](../../docs/milestones/m07.md) — and not claimed here as shipped.

## Limits

- **n=1, and the same fortnight.** Cross-cited from
  [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md): one team, one
  documentation-shaped repository, roughly two weeks. The three-moment structure is the shape *this*
  build converged on, not a measured optimum.
- **Three is not derived.** No experiment here compares three moments against two or four. Three is what
  the failures argued for after the fact.
- **The cost is the workspace's to price**, via the lane threshold — unchanged from
  [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md).
- **The cycle is stated at its weakest point on purpose.** Milestone 8's evals are what could ever
  retire or tighten it on evidence.

## Decision

Marius Cetanas — decided 2026-07-30; **accepted on the merge of
[#137](https://github.com/sleepy-panda-works/portulan/pull/137)** — because the framework's own
development cycle is the most load-bearing thing it has learned, and it was recorded only as a story
about this repository rather than as a principle an adopter receives.
