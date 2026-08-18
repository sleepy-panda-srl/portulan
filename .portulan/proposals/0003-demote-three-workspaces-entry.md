# Proposal — demote `three-workspaces-not-one` to reference, and trim it to what the spec does not carry

**Incident.** No failure — this is a memory entry's own retirement condition firing, which is the case
the lifecycle is written for and the one that never happens by itself unless somebody looks.
[`../memory/three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md) closes with:

> **Retire when:** the Workspace Definition (milestone 2) names and distinguishes the three formally. The
> schema then carries the distinction and this entry becomes redundant.

Milestone 2 did that. `kind` is a required slot with exactly three values, argued in
[`../../spec/README.md`](../../spec/README.md) and [`../../spec/slots.md`](../../spec/slots.md).

**But the condition fired only halfway, and acting on it literally would lose something.** The entry
holds two different things:

1. **The vocabulary and the reasoning** — that the three kinds are distinct, and the two failure modes
   that make confusing them expensive (real internal policy published in a demo; a demo written as merely
   illustrative when it is the only complete example an evaluator reads). This *is* now redundant. Worse
   than redundant: it is duplicated into `spec/README.md`, so the two can drift, and the workspace copy
   is the one nothing checks.
2. **Which of *this repository's* directories is which kind** — `.portulan/` is the `repository`
   workspace, [`../../examples/`](../../examples/) is the `demo`, and the Sleepy Panda SRL portfolio ships
   through the private feed at milestone 6. That is not in the spec and must not be: it is this team's
   specific mapping, and a spec that named customer zero's directories would have absorbed exactly the
   specifics thesis 6 says stay with their owner.

So the entry is not redundant; the *general* half of it is. That is the ordinary shape of promotion —
a lesson travels upward by generalizing, and the specifics stay put.

**Proposed rule.** Demote the entry from `type: decision` to `type: reference` and trim it to (2), with
a pointer to the spec for (1). Do not delete it.

**Enforcement.** None, and that is the honest answer — this is a memory operation, not a rule. What it
serves is the mechanism that *is* enforced later: the librarian's demotion pass (milestone 5) mines
exactly this signal, a retirement condition that has become true. Doing it by hand once, now, is worth
more than the entry itself — it is the first evidence that these conditions are written to be acted on
rather than as decoration, and the pass has real material to learn its shape from.

**Provenance.** `form=link` `href=`[`../memory/three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md)
— the entry's own retirement clause, plus the milestone-2 change that satisfied it. Public, in-repo, and
resolvable, so no seal is needed. Carried so this demotion can itself be reversed if `kind` is ever
dropped from the schema.

**Cost of leaving it pending.** The duplication in (1) is live from the moment this session merges: the
same two failure modes are now stated in the workspace and in the spec, with nothing holding them in
agreement. That is small and visible, and it is the correct thing to accept rather than pre-empt — an
agent retiring the human-owned curated layer on its own authority is the failure mode
[`../../core/operating/evolution.md`](../../core/operating/evolution.md) exists to prevent, and a little
duplication is much cheaper than that precedent.

**Decision.** Marius Cetanas — **accepted, 2026-07-25**, on a recommendation he commissioned from a
fresh-context Fable 5 and posted as [`portulan-agent[bot]` on pull request 15](https://github.com/sleepy-panda-srl/portulan/pull/15#issuecomment-5078534991).
The recommendation's argument, kept because it is stronger than this proposal's own: the cost of leaving
it pending is a **live, unguarded duplication** — the memory entry against `spec/README.md`, with nothing
holding the two in agreement — and this milestone's own new entry
[`a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md)
is fresh evidence that duplicated unchecked prose is exactly where this repository's drift happens.
Acting on a retirement condition by hand, once, also gives the milestone-5 librarian its reference shape.

**Applied, 2026-07-25, in the same pull request**, at the maintainer's direction.
[`../memory/three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md) is now `type: reference`,
trimmed to the directory-to-`kind` mapping — the half that is this team's own specifics — with the
vocabulary and the two failure modes left to [`../../spec/README.md`](../../spec/README.md), where they
are now singular rather than duplicated. Its retirement condition was rewritten too, since the old one had
fired: it now retires when the mapping becomes derivable, which `doctor` reading every manifest in a tree
would do.

This is the first retirement condition in this workspace to have fired and been acted on, which was the
strongest argument for doing it by hand rather than waiting for the librarian: milestone 5's demotion pass
now has one real instance to learn its shape from instead of a specification of one.

**Pull request:** [#8](https://github.com/sleepy-panda-srl/portulan/pull/8) — the change that filed this.
