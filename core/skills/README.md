# core/skills/

A **skill** is a procedure the engine pulls into context on demand — in `SKILL.md` form: a name, a
one-line description, a "when to use it" trigger, and the body. Skills are how the engine stays small
while still knowing a lot: the kernel is always loaded, but a skill costs nothing until its trigger
fires. _(Provenance: AAIF — `SKILL.md` as the distribution plane; HumanLayer — skills-first progressive
disclosure.)_

## The bar a skill must clear

A skill earns its place only if it **enforces** something, **measures** something, or is worth the tokens
it costs when loaded. A procedure that is really a standing rule belongs in [`../operating/`](../operating/)
as doctrine; a one-off belongs in a task. A skill that is never triggered is demoted by the librarian.
_(See [`../operating/evolution.md`](../operating/evolution.md).)_

## Relationship to the plugin

`SKILL.md` is the unit the Claude Code plugin ships, and the CLI will vendor for other hosts. Authoring
skills here in the standard shape is what lets ~80% of the value ship identically on every host.
_(Vision — LLM-agnostic by construction.)_

The plugin **references this directory** rather than copying it:
[`../../.claude-plugin/plugin.json`](../../.claude-plugin/plugin.json) declares `./core/skills/` as a
skill path, so the skills documented here and the skills installed on a user's machine are the same
files. Nothing is added to a skill to make it shippable — which is the practical test of whether the
"standard shape" claim above is true, and it passed.

One consequence, because it is not obvious: a skill added to this directory ships the moment it lands.
There is no separate packaging step to forget, and no packaging step in which to reconsider.

## Status

**Milestone 3 — the exemplars ship.** This README fixes the skill format and the "earns its place"
test; the exemplar universal skills [`clarify`](clarify/SKILL.md) and [`codify`](codify/SKILL.md) are
authored against it and are now declared by the plugin manifest, alongside the boot skill in
[`../../plugin/skills/`](../../plugin/skills/). (A cross-artifact consistency-check ritual — the
remaining spec-driven ritual named in the vision's influence map — needs the Workspace spec to exist
first, so it is deferred to a `packs/rituals/` skill.)

**Milestone 5 — [`consolidate`](consolidate/SKILL.md) joins them**, the third universal skill: the
repair a breached memory budget calls for, and the on-demand form of the librarian's scheduled pass.
It is the first skill here written against a rail rather than against a habit — the budget it answers
to is declared in a manifest and a verify recipe goes red on it — which is why its "when to use it"
can name a machine-produced trigger instead of a judgement call.

**What checks them:** [`../../.portulan/verify/plugin.sh`](../../.portulan/verify/plugin.sh) on every
pull request — frontmatter present, `description` non-empty, and a `name` that is kebab-case. The
`name` is required here although the platform treats it as optional, so that a skill's invocation name
comes from the skill rather than from where it happens to sit. Note that the platform's own
`claude plugin validate` does **not** reach these files: it validates skills only under a plugin's
default `./skills/` directory, and these sit behind a declared custom path. Measured, not assumed
([`../../.portulan/memory/a-checkers-coverage-is-measured-not-named.md`](../../.portulan/memory/a-checkers-coverage-is-measured-not-named.md)).
