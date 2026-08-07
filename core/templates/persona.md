# Template — Persona

> A **persona** is a role an agent takes, packaged as a **context firewall**: its own attention window,
> its own memory, and a `tools:` allow-list that grants only what the role needs. The parent loop fans
> work out to a persona and gets back a conclusion, not the persona's whole transcript. Copy the skeleton
> below and fill it. (Placeholders are in `{braces}`.) _(Provenance: HumanLayer — subagents as context
> firewalls; Cognition — read-parallel / write-isolated; Letta — per-agent memory.)_
>
> **The five-part contract is fixed by [`../personas/README.md`](../personas/README.md)**, which is the
> authority — this template is a starting point and deliberately does not restate the rule, for the
> reason [`../operating/evolution.md`](../operating/evolution.md) gives: one carrier, and the others
> reach it. All five parts are required: a persona missing one is not a lighter persona, it is an
> unenforceable one.
>
> **Prohibited is never a reach.** It is the one tier no role may act in, so a persona declaring it
> claims a permission that does not exist for anyone. Stated here, above the skeleton, rather than inside
> the *Autonomy reach* section — a scaffold whose reach section contains the word is a scaffold that
> `doctor` has to distinguish from a persona actually claiming it, and the cheapest way to keep that
> distinction clean is for the generated file not to say it at all. The rule is enforced by `doctor`, not
> by this sentence.
>
> **Two things worth knowing before you write the `tools:` line.** It is a set of **capability classes**,
> not one host's tool names — binding classes to a host's vocabulary happens in that host's adapter, and
> writing tool names here is what makes a persona stop being portable. And the binding is **lossy**: some
> charters survive translation into a tool grant and some do not. A charter that says *does not edit the
> code under review* becomes a rail; one that says *drafts everything, accepts nothing* is a constraint
> on what the role may conclude, which no tool list can express. Say which yours is, rather than letting
> a reader take the frontmatter for the gate.

---
---
name: {kebab-case-name}
description: {The role in one line — what it is for, and what it must not do.}
tools: {capability classes, comma-separated — default-deny, least privilege for this role}
---

# Persona — {Name}

## Charter

{What this role is for. Then, just as load-bearing, what it must **not** do — the boundary is the half
that makes a firewall a firewall. Name the neighbouring role this is easiest to confuse with.}

## Autonomy reach

{The highest tier this role may act in, in **tier vocabulary** — Auto / Propose / Gated — never concrete
actions. The gate map that binds actions to tiers is workspace policy, and naming an action here would
move policy into a role. There are only three reaches, and the fourth tier is not one of them; see
[`core/personas/README.md`](../personas/README.md) for why.}

## Memory scope

{What this role remembers, and where it lands — a directory in the **adopting workspace's own layer**,
never in the pack or in core. Storage follows ownership. Declared here rather than in a pack manifest
because the scope is the persona's own field, and a pack distributing per-persona material its adopter
does not own is the one direction the cascade does not run. Empty until earned is the correct state: a
scope is a place for facts, not a claim that facts exist.}

## Read / write posture

{Most personas read in parallel; writes are isolated to one place so two agents never clobber the same
file. Say which this is, and — if it writes — the one place it writes.}

## What this persona's tool grant does NOT enforce

{Required. The half of the charter that is a constraint on judgement rather than on capability, and is
therefore held by the workspace's gate map and the platform floor rather than by the list above. A
persona whose limits section is empty is claiming its frontmatter is the gate, which is the one reading
[`../personas/README.md`](../personas/README.md) exists to prevent.}
