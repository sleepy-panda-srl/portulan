---
name: portulan
description: Boot the Portulan engine in this repository — use its boot card where one is loaded, else read the kernel and the team's workspace (identity, principles, gate map, definition of done, repo card), and report what is and is not enforced here. Use at the start of a working session in a repository that has a `.portulan/` workspace, when asked to "boot Portulan", or when you need to know this team's gates, lanes, verify recipes, or definition of done before acting.
---

# Boot Portulan

> **This file decides which of two boots runs: the card below, or [`steps.md`](steps.md), which is the
> other in full.** The reasons behind both are in [`rationale.md`](rationale.md), under the same step
> numbers. A boot does not need it: read it when a step does not fit the case in front of you, or when
> someone asks why.

## 0. Where the project's boot card is loaded, it is the boot

**If your context holds a rule whose first line is `# Portulan boot card`, that card is the boot.** The
project's workspace compiled it from its own slots into every context in the project, and it names the
file behind each of its lines. So:

- **Read no slot, manifest or step file to boot.** Open one when the card, or a rule loaded for the path
  you are working on, sends you to it, at the moment it applies.
- **Where your context does not also hold the kernel**, a file whose first line is `# Portulan engine`,
  read `${CLAUDE_PLUGIN_ROOT}/core/engine.md` in full: a card is a boot only with the kernel beside it.
  `${CLAUDE_PLUGIN_ROOT}` is the `<plugin root>` a card's commands name.
- **Close with the honest position, from the card**: what it says is enforced here and what is not, the
  packs it names and where their limits are, and the line
  `node "${CLAUDE_PLUGIN_ROOT}/cli/context.mjs" --workspace "${CLAUDE_PROJECT_DIR}/.portulan" --brief`
  prints.

## Otherwise, steps 1 to 5

**Read [`steps.md`](steps.md) and follow it: it is the boot in full.** If that read is denied, the boot
did not load: say so, ask for read access to the file, and do not proceed as though it had.
