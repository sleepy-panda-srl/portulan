# `checkpoints` — the supervised-build ritual

A ritual pack: three checkpoints at which a **fresh context** grades work it did not do, and the fixed
vocabulary its verdicts are written in. Composed by a workspace through its `packs` array as
`rituals/checkpoints`.

The premise is one sentence, and it is **core's**, not this pack's: on the full lane the verdict comes
from a context that has not seen the implementation, because one primed by the implementing context
measures agreement rather than correctness
([`../../../core/operating/loop.md`](../../../core/operating/loop.md), and
[`../../../core/operating/verification.md`](../../../core/operating/verification.md) for why that is a
ceiling on the verifier rather than a rung on the hierarchy). What this pack adds is the **procedure**:
three named moments, a persona to staff them, and the vocabulary the verdicts are written in. The
premise moved into core on 2026-07-30; before that this file was where it was stated, which is why the
sentence reads as a citation now and did not before.

| Contributes | What |
|---|---|
| Skills | [`session-open`](skills/session-open/SKILL.md) · [`pre-commit`](skills/pre-commit/SKILL.md) · [`milestone-close`](skills/milestone-close/SKILL.md) |
| Persona | [`supervisor`](personas/supervisor.md) — grades, never implements or merges |
| Gate fragments | `commit-without-the-hooks` (gated) · `self-certify-a-checkpoint` (prohibited) |

## The three checkpoints

| Checkpoint | When | What it grades |
|---|---|---|
| Session-open | before implementation starts | the session's plan, against the criterion and the workspace's own slots |
| Pre-commit | before any commit, and before anything goes outward | the diff, re-measured against the criterion it claims to meet |
| Milestone-close | before a milestone is marked done | that the criterion was *demonstrated*, not asserted |

## The verdict vocabulary

Four verdicts, and which are available depends on the checkpoint.

| Verdict | Means | Available at |
|---|---|---|
| **APPROVE** | Proceed as it stands. | session-open · pre-commit |
| **APPROVE-WITH-ADJUSTMENTS** | Proceed once the numbered adjustments are folded in. Not a soft failure — it is what a working checkpoint usually returns. | session-open · pre-commit |
| **REQUEST-CHANGES** | Does not meet the standard. Name what, and what would meet it. Needs a second pass at the same checkpoint. | all three |
| **CLOSE** | Every clause of the criterion is demonstrated; the milestone may be marked done. | milestone-close only |

**Every adjustment is numbered**, so it can be folded in and cited individually. An unnumbered list of
concerns is not a verdict.

**APPROVE and APPROVE-WITH-ADJUSTMENTS are unavailable at milestone-close on purpose.** Both let work
proceed on a promise to fold something in, and a close is the one decision with nothing downstream of
it to catch what was folded in wrongly.

## The fidelity note

What a close leaves in the record once the session that wrote it is gone. Four parts, in one clause:

> **who** verified · **when** · **the verdict, with what was actually re-derived** · **what the close
> leaves undemonstrated**

A bare *done* plus a link is not a fidelity note.

## What this pack does not do, said plainly

- **It cannot enforce the freshness, and the freshness is the entire mechanism.** No `tools:` list and
  no permission rule can observe whether the context reading a checkpoint skill has already seen the
  work. It is a property of how the checkpoint was *invoked*. So this pack ships a practice held by
  whoever spawns the supervisor, and says so rather than shipping a contract that reads like a rail.
  `self-certify-a-checkpoint` is a `prohibited` fragment with **no tool-level surface** — it names the
  gap instead of inventing a matcher that would cover less than its sentence claims, and it therefore
  **compiles to nothing on every backend**.
- **It does not set the lane boundary.** Checkpoints bind **full-lane** work; where that lane begins is
  the adopting workspace's own threshold. A pack imposing three checkpoints on every one-line fix would
  be ceremony that cannot scale down — which is a named non-goal, and the fastest route to a ritual
  being switched off wholesale.
- **It ships no verify recipe.** The obvious one — *every milestone-affecting change carries a recorded
  verdict* — would have to know the adopter's record format, and a recipe that cannot actually read
  what it claims to check is worse than none. The Pack Definition can carry recipes
  ([`../../../spec/pack.schema.json`](../../../spec/pack.schema.json)); this pack has nothing honest to
  put in that field.
- **It grades against the adopter's standard, never against this pack's.** The skills read the
  workspace's own constitution, plan, definition-of-done and gate map. Nothing here supplies a standard
  of its own, and a supervisor substituting its taste for the team's is a second author rather than a
  check.

## Provenance

Re-expressed from public practice — supervised evolution as the guard against drift, last-mile review
focus, read-isolated verification. The structure is the two-tier protocol Portulan is itself built
under, and the checkpoint section of that project's own gate map.

**The evidence is that project's build record**, cited as provenance rather than as procedure: the
fresh-context checkpoints changed *designs* rather than wording at two consecutive milestones — the
story is in [milestone 4's record](https://github.com/sleepy-panda-works/portulan/blob/main/docs/milestones/m04.md),
beside [the protocol itself](https://github.com/sleepy-panda-works/portulan/blob/main/docs/plan.md) —
while adopters received no artifact for the ritual that produced them. This pack is that artifact.

Those two are **absolute URLs on purpose**, unlike this pack's links into `core/`, which ships beside
it and resolves for an adopter. A provenance link is a pointer at a public record that stays where it
is; a repo-relative one would resolve only inside the tree this pack was written in, and this pack is
meant to travel. What travels with it is the mechanism. The bindings that made it work in its home
repository — one maintainer's names, that tree's paths, its budgets and review-loop mechanics — stay
in the layer that owns them.
