---
name: session-open
description: Grade a session's plan before any file is written. Use at the start of full-lane work — a plan against the workspace's constitution, its plan or roadmap, and the criterion the session claims to serve. Runs in a context that has not seen the plan being drafted, and returns APPROVE, APPROVE-WITH-ADJUSTMENTS, or REQUEST-CHANGES. Not for triage-lane work.
---

# Skill — Session-open checkpoint

> The cheapest of the three, and the one that changes the most. A defect caught here costs a paragraph;
> the same defect caught at pre-commit costs the diff that was built on it. _(Part of the `checkpoints`
> ritual pack — see [`../../README.md`](../../README.md) for the verdict vocabulary in full and for
> what this pack cannot enforce.)_

## When to use it

At the opening of **full-lane** work, before the implementer writes to any file.

**Where the lane boundary sits is the adopting workspace's, not this pack's.** Core defines two lanes
and leaves the boundary to the workspace
([`../../../../../core/operating/loop.md`](../../../../../core/operating/loop.md)). A pack that imposed
three checkpoints on every one-line fix would be ceremony that cannot scale down — a named non-goal, and
the fastest way to get a ritual switched off wholesale. Read the workspace's own threshold and honour it.

## The pass

1. **Read the criterion the session claims to serve, as an input rather than as background.** If it
   reads two ways, that ambiguity is the finding — say so before the session builds one of the two
   readings by guessing. A criterion is the standard; a plan that quietly narrows it has already failed
   and nothing downstream will notice.
2. **Read the workspace's own slots** — constitution or principles, definition-of-done, gate map — and
   grade the plan against what this team wrote down, never against your own taste. A supervisor
   substituting its preferences for the team's standard is a second author, not a check.
3. **Attack the plan's claims, not its prose.** For every capability the plan says will exist when the
   session ends, ask what would demonstrate it. Plans fail most often by claiming a demonstration that
   the described work cannot produce.
4. **Check what the plan will make untrue.** A change lands inside a body of documents that describe the
   system; sentences elsewhere go stale the moment it merges. Name them at the opening, when they are
   cheap to include, rather than at pre-commit when they are a second pass.
5. **Say where the plan claims something that will not exist.** A document may describe machinery only
   if the machinery exists, or the sentence names where it arrives.
6. **Return one verdict**, with every adjustment numbered so the implementer can fold them in and cite
   them individually. An unnumbered list of concerns is not a verdict.

## The verdicts this checkpoint may return

- **APPROVE** — proceed as planned.
- **APPROVE-WITH-ADJUSTMENTS** — proceed, with the numbered adjustments folded in. The common case, and
  not a soft failure: it is what a checkpoint looks like when it is working.
- **REQUEST-CHANGES** — the plan needs reworking and a second opening pass before implementation starts.

## Why it earns its tokens

It enforces a real rule — that a session's plan is graded against the standard before it is built,
by something that did not draft it. **The freshness is the mechanism and no host enforces it**: nothing
in a tool grant can observe whether this context already saw the plan being written. That makes it a
practice held by whoever spawns the checkpoint, which is why it is stated here rather than assumed.
A checkpoint that never changes a plan is a candidate for demotion; one that changes designs rather
than wording is doing the job.
