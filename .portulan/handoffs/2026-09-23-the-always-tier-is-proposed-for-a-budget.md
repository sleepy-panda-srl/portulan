# Handoff — 2026-09-23: what a host loads into every context is proposed for a budget, and row 12 runs first

**What landed.** Proposal [`0036`](../proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md),
row 12 of the milestone map in [`../../docs/plan.md`](../../docs/plan.md), and the row's drafting rationale
in [`../../docs/milestones/m12.md`](../../docs/milestones/m12.md). **Nothing is built.** The maintainer
ruled the proposal's five open questions on 2026-09-23; the rule itself is his to accept on
[#429](https://github.com/sleepy-panda-srl/portulan/pull/429).

**Why a proposal, not code.** The rule adds an axis (load tiers), a manifest key and a report, and
[`../gate-map.md`](../gate-map.md) says an idea that adds an axis, a mode or a surface starts as a
proposal. The kickoff set the same order: scope and questions, then the proposal, then one change per pull
request once it is accepted.

**Why the rule copies memory's budgets.** Memory is the one layer Portulan budgets, and in the sealed
incident it was the one layer that was fine. Declared, never defaulted, and repaired by demotion rather
than by a raise in the same change: the rule inherits an argument this repository already accepted
instead of asking for a new one.

**Two of his rulings carry a trade-off worth keeping.** The bytes-per-token ratio is **declared**, not
measured per run, because a measured ratio is a network call inside a recipe, which the gate map forbids,
and a ratio that moved between runs would make one tree red on one run and green on the next. Compiled
rule files are **committed**, because a desktop session's worktree is a fresh checkout, and a gitignored
generated rule would be missing from exactly the contexts this makes cheaper.

**What was measured, and what was not.** The public figures in the proposal were measured at `4303882`.
The sealed figures are the kickoff's of 2026-09-21 and were not re-measured here. The one-level-of-index
finding rests on the kickoff's citation of arXiv 2607.17598, which this session could not fetch; the
proposal says so and asks for it to be read before merge.

**Checkpoints.** No session-open checkpoint ran. Supervision was available, so this was a missed checkpoint,
not the gate map's *unavailable* case, and it cannot be run after the fact. The gate map's remedy is the
same either way: the maintainer reviews the diff. He delegated that review on 2026-09-23 to the project's
coordinator, and it is owed before merge. The pre-commit ran in a fresh
context on the finished diff: **APPROVE-WITH-ADJUSTMENTS**, one blocking and three optional, all folded,
and the fold graded on its own delta. The blocking one was mine: `m12.md` said memory's budgets *refuse* a
raise in the same change, and nothing does; [`../../spec/slots.md`](../../spec/slots.md) says no checker
establishes it. The optional three: the sealed cost split now states the prices it derives from, a
rounding rule that was not in his ruling is gone, and the fidelity note below. The checkpoint's figures
also showed the demo read-set reproducing only with the `combcount` repo card, so the proposal now names it.

**The fidelity note names the supervisor by role, not by model.** Checkpointed entries since 2026-09-04
name the model, and this one cannot: this session's operating rules keep model identifiers out of anything
pushed. The Protocol line in `plan.md` stays the one carrier of each tier's model name.

**Green in this container needs a non-root run.** As root, `tests` fails its permission cases, because a
chmod-000 fixture never denies root. Every other recipe ran green as root, and `tests` ran green as a
non-root user on a copy of this tree. CI runs as a non-root user.

**Next action.** His acceptance on #429. After it, change 1 of 0036's order: `core/operating/context.md`
and the kernel's pointer to it. Proposal `0037`, the handoff budget, can be drafted alongside.
