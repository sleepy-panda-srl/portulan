---
tier: on-path
paths:
  - "core/**"
  - "plugin/**"
  - "agents/**"
  - "packs/**"
  - ".claude-plugin/**"
  - "cli/recipe-set.mjs"
  - "cli/skills-set.mjs"
description: The engine every adopter receives, the boot skill, the personas and the packs, and what a change to any of them owes.
---

# Changing doctrine, the boot skill or a pack

You are on the engine every adopter receives, or its packaging: `change-doctrine`, full lane, with a
fresh-context pre-commit checkpoint even when no milestone row moves. Every new rule carries its
rationale and its provenance, condition 3 of `.portulan/dod.md`.

- **The kernel, `core/engine.md`, is held to 60 lines by the `docs` recipe.** Adding to it is the wrong
  reflex: write in `core/operating/`, and link from the kernel only a line every task needs.
- **The boot skill routes** a boot to the project's card or to `plugin/skills/portulan/steps.md`, and
  `rationale.md` beside them holds each step's reasons under its number: change an instruction and its
  reason together. Every skill and agent description is in every context where the plugin is enabled,
  and `.portulan/verify/context.sh` rails their bytes, the skill's, its steps' and the kernel's.
- **A declared pack is not an invocable one.** Read `plugin/skills/portulan/packs.md` before changing how
  a pack composes or registers: registration is a property of `.claude-plugin/plugin.json` alone. A pack
  whose `contributes` block changes moves its `portulan.version` too, which the `pack-version` recipe
  checks.
