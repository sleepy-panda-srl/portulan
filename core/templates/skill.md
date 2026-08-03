# Template — Skill

> A **skill** is a procedure the engine pulls into context on demand, in `SKILL.md` form. Skills are how
> the engine stays small while still knowing a lot: the kernel is always loaded, a skill costs nothing
> until its trigger fires. Copy the skeleton below and fill it; delete lines that don't apply rather than
> leaving them blank. (Placeholders are in `{braces}`.) _(Provenance: AAIF — `SKILL.md` as the
> distribution plane; HumanLayer — skills-first progressive disclosure. The contract this template obeys
> is fixed by [`../skills/README.md`](../skills/README.md), which is the authority; this file is a
> starting point, not a second statement of the rule.)_
>
> **The bar, before you write anything.** A skill earns its place only if it **enforces** something,
> **measures** something, or is worth the tokens it costs when loaded. A procedure that is really a
> standing rule belongs in [`../operating/`](../operating/) as doctrine; a one-off belongs in a task. A
> skill nobody triggers is demoted by the librarian, so a trigger you cannot describe concretely is the
> signal to stop and write something else.
>
> **`name` and `description` are the contract, not decoration.** They are the only two fields a host
> reads before deciding whether to load the body, so `description` has to carry the trigger — the
> circumstances under which this skill is the right thing to reach for. A description that summarises the
> body instead of naming its trigger produces a skill that is never selected and then demoted for it.

---
---
name: {kebab-case-name}
description: {What this does, AND when to use it — the trigger belongs here, because this line is what a host reads before loading anything else. One or two sentences.}
---

# Skill — {Name}

> {One line: what this procedure is for, and the one thing it is not for.}

## When to use it

{The concrete trigger. Prefer something machine-produced — a rail went red, a budget was breached, a
command exited non-zero — over a judgement call, because a trigger that depends on noticing is a trigger
that gets missed. If it genuinely is a judgement call, say what the judgement is.}

**When not to use it.** {The neighbouring case this is easy to confuse with, and what to reach for
instead. Skipping this line is how two skills end up competing for the same trigger.}

## The pass

1. {Step. Imperative, and specific enough that two people following it produce the same artifact.}
2. {Step.}
3. {Step.}

## What it produces

{The artifact, and where it lands. If the skill changes no file, say so — a skill whose output is a
conclusion in the caller's context is legitimate, and leaving it implied is how it acquires an imagined
side effect.}

## Honest limits

{What this skill does NOT check, cover, or guarantee. Required rather than optional: a procedure that
lists only what it catches reads as covering everything, and the gap is discovered by whoever trusted it.
If you cannot name a limit, you have not found it yet.}
