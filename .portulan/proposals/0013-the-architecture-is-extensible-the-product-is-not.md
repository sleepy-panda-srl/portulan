# Proposal 0013 — the architecture is extensible; the product is not

**Status. PROPOSED, 2026-07-27 — drafted on the maintainer's directive of the same day.** Merging this
pull request adopts the milestone-6, -7, -10 and -11 clauses below. One question (Q6) is a spec change
and is left to the maintainer.

## The ask, in the maintainer's words

> User extensibility, Desktop and CLI: users can define and expand skills, agents, personas, packs, add
> tools — tailor Portulan to their finest needs.

## The finding

**Most of this is already the architecture.** The cascade — `core < pack < workspace < repo card < task`
— is thesis 1 of the constitution, and thesis 6 says the team's own specifics *"persist only in the layer
their owner controls."* Extensibility is not a feature to invent here; it is the product's premise.

What is missing is the **product surface**: the templates, the commands, the schema and the validation
that let a user actually do it. Measured against the current tree, not assumed:

| Surface | What exists today | What is missing |
|---|---|---|
| **Authoring templates** | `core/templates/` holds **five** — repo-card, task, handoff, proposal, memory-entry | **Zero authoring templates.** All five cover artifacts produced *while working*; none covers *extending the framework*. A user authoring a skill or a persona has a written contract in `core/skills/README.md` and `core/personas/README.md` and **no skeleton to copy** |
| **Packs** | four README files, all marked *Placeholder* | **Not one pack exists, and no manifest format defines one.** `packs/tools/README.md` names the gap itself: gate policy is a workspace slot and no pack contributes to it — *"the cascade's missing middle"* |
| **Declaration** | `packs: string[]` in `spec/workspace.schema.json` — a bare array of strings | No shape, no resolver. `examples/workspace.json` declares two packs that do not exist and `doctor` is **green** on it, reporting a count and calling itself a declaration only |
| **Cascade resolution** | written down in eight files | **implemented in none.** `cli/compile.mjs` contains zero occurrences of the word `cascade` |
| **Scaffolding** | nothing | Nothing in `cli/` writes a file for a user. The only filesystem write in the whole CLI is the compiled settings artifact |
| **Validation** | `plugin-lint` checks skill and agent *packaging*; `doctor` checks the workspace manifest | **`doctor` never opens a `SKILL.md`, a persona, an agent binding or a pack** — in `cli/doctor.mjs`, `skill` and `persona` appear zero times, `agent` once and that once is a comment, `pack` once, and that once is the count it reports rather than a check |

Two of those are worse than gaps, because they will fail a real author on their first try:

- **Skill resolution is one level deep.** A declared skills path resolves `<root>/SKILL.md` or
  `<root>/<child>/SKILL.md` and nothing deeper. A pack shipping skills at
  `packs/<pack>/skills/<skill>/SKILL.md` **cannot be declared as a single path** — it fails as *"has no
  SKILL.md"*. This blocks packs from carrying skills, which is most of what a pack is for, and it will
  be discovered by the first person who writes one. Filed as
  [`../tasks/0008-a-declared-skills-path-sees-one-level-down.md`](../tasks/0008-a-declared-skills-path-sees-one-level-down.md).
- **`plugin-lint`'s tree walk descends into git-ignored state.** Its skip list is `.git`, `node_modules`
  and `.claude-plugin`; **nothing consults `.gitignore`** — so every worktree copy under `.claude/`
  contributes a full set of false *undeclared skill* notes. Measured in the maintainer's checkout while
  this was written: 72 notes, **all 72** from that one ignored directory. The count is not the finding —
  it moves with the number of worktrees, and a fresh clone shows none — the finding is that a user
  authoring their first skill would lose the one real note in that noise. Filed as
  [`../tasks/0009-the-walk-reports-on-files-git-does-not-track.md`](../tasks/0009-the-walk-reports-on-files-git-does-not-track.md),
  because it is a bug in a shipped checker rather than a planning question.

## The proposal

**The authoring loop, stated once so every surface implements the same one:** *scaffold → edit →
validate → (optionally) pack → distribute.* The CLI and the Desktop app are two front doors onto it, and
neither owns a format the other cannot read — the files are the interface, as they are everywhere else
in this product.

**1. Five authoring templates in `core/`** — `templates/skill.md`, `templates/persona.md`,
`templates/pack.md`, `templates/workspace.md` and `templates/gate-policy.md`. They carry the contracts
that today live only as prose in two READMEs, or only as live instances: for a skill,
name/description/trigger/body plus the *earns its place* bar; for a persona, the five required parts
(`tools:` allow-list, charter, autonomy reach in tier vocabulary, memory scope, read/write posture); for
a pack, the manifest and what it may contribute. **The last two are named because `new` scaffolds six
kinds and a template must exist for each** — `repo-card` already has one, but a workspace manifest and a
gate policy exist today only as `.portulan/` and `examples/` instances, and *copy the demo and delete
what you don't recognise* is not an authoring surface. Both are annotated starters derived from the
schemas, not new formats. Doctrine change, which is why this is a proposal.

**2. A pack manifest format — `spec/pack.schema.json` — at milestone 6.** It lands there rather than
here because milestone 6 is when a pack is first *resolved* from a feed, and `doctor` already points at
milestone 6 for exactly this. A pack declares what it contributes to the cascade: skills, personas,
verify recipes, and **gate-policy fragments** — the missing middle, and the one that needs care, because a
pack contributing to the gate map means an installed pack can change what an agent is allowed to do.
The floor for that is **already ruled and needs no re-deciding here**: *"Packs may contribute gate rules,
tighten-only"* —
[`0010-prohibited-as-a-fourth-universal-tier.md`](0010-prohibited-as-a-fourth-universal-tier.md),
agreed by Marius on 2026-07-27. A pack may raise a tier, never lower one. What this proposal adds is only
that the manifest must be **shaped so the rule is checkable** rather than trusted, which is the
difference between that ruling being doctrine and being machinery.

**3. `portulan new <thing>` at milestone 7** — `skill · persona · pack · workspace · gate-policy ·
repo-card`. It scaffolds from the core template **into the user's own layer**, never into core, and then
runs `doctor` on what it just made, so the first thing an author sees is their own artifact validating.
This is the whole extensibility surface for the CLI, and it is small because the architecture already
did the hard part.

**4. Validation that reaches user-authored things, at milestone 7.** `doctor` learns to open what it
currently ignores: a skill's frontmatter, a persona against the five-part contract, a pack against its
schema, and the persona↔agent-binding agreement that nothing checks today (already tracked as
[`../tasks/0005-lint-the-persona-agent-binding.md`](../tasks/0005-lint-the-persona-agent-binding.md)).
Plus the one-level-deep skill resolver, fixed, because packs need it.

**5. Docs — "Extending Portulan"**, the authoring loop end to end, written when the surface ships at
milestone 7 and rendered by the docs site at milestone 10.

**6. The Desktop half, at milestone 11:** the same files, rendered. A workspace view listing the skills,
personas and packs in force; *New skill* running the same scaffold; `doctor` inline; and **the cascade
made visible — which layer a given rule came from**, which is the one thing a GUI can show that a
terminal shows badly. It must not become a second authoring path with its own format.

## What this deliberately does not do

- **No marketplace for user packs, and no rating, search or discovery.** Distribution is the existing
  plugin-marketplace mechanism. A community registry is a product decision, not a planning one.
- **No auto-generated skills.** `vision.md` bans auto-generated curated context: `new` scaffolds a
  skeleton for a human to fill, and an agent drafting one still goes through the proposal gate.
- **No new tier, no new gate vocabulary.** *Add tools* in the ask is served by the persona `tools:`
  allow-list and by packs contributing tool configuration — both existing mechanisms.

## Question for the maintainer

**Q6 — Does a workspace-local skill or persona get a home in the workspace, or must everything be a
pack?** `spec/slots.md` considered this and left it out, with the note *"Revisit if a workspace-local
ritual ever needs a home that is not a pack."* Extensibility forces the revisit: telling a user that
adding one skill for their own team means authoring, versioning and distributing a pack is **ceremony
that cannot scale down**, which `vision.md` names as a non-goal in its own right. Proposed: the workspace
gains `skills` and `personas` path slots; packs stay the *distribution* unit, not the *authoring* unit.
This is a spec change (the schema is `additionalProperties: false`, so a user cannot do it unilaterally
today) and therefore his.

**Provenance.** `form=link href=docs/vision.md` — The thesis, clauses 1 and 6, and Non-goals (*No ceremony that can't
scale down*, *No auto-generated curated context*), read against the maintainer's directive of
2026-07-27. The measured gaps come from a read of the current tree at `b9722da`, cited inline above.

**Decision.** Marius Cetanas — pending.

**Pull request:** [#52](https://github.com/sleepy-panda-srl/portulan/pull/52) — the change that filed this.
