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

`SKILL.md` is also the unit the Claude Code plugin ships (milestone 3) and the CLI vendors for other
hosts. Authoring skills here in the standard shape is what lets ~80% of the value ship identically on
every host. _(Vision — LLM-agnostic by construction.)_

## Status

**Milestone 1 — format + exemplars.** This README fixes the skill format and the "earns its place"
test; the exemplar universal skills [`clarify`](clarify/SKILL.md) and [`codify`](codify/SKILL.md) are
now authored against it, and are formalized as plugin skills in milestone 3. (A cross-artifact
consistency-check ritual — the remaining spec-driven ritual named in the vision's influence map — needs
the Workspace spec to exist first, so it is deferred to a `packs/rituals/` skill after milestone 2.)
