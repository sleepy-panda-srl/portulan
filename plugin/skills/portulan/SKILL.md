---
name: portulan
description: Boot the Portulan engine in this repository — load the always-loaded kernel, find and read the team's workspace (identity, principles, gate map, definition of done, repo card), and report what is and is not enforced here. Use at the start of a working session in a repository that has a `.portulan/` workspace, when asked to "boot Portulan", or when you need to know this team's gates, lanes, verify recipes, or definition of done before acting.
---

# Boot Portulan

> Portulan is an operating framework: a universal **engine** plus a per-team **workspace**. Booting
> means loading the engine's kernel and then the team's own policy layer, so that what follows is
> tailored to *this* team rather than generically sensible. _(See
> [`../../../core/engine.md`](../../../core/engine.md) and [`../../../docs/vision.md`](../../../docs/vision.md).)_

## 1. Load the kernel

Read `${CLAUDE_PLUGIN_ROOT}/core/engine.md` in full. It is deliberately small — the resolution
cascade, the loop, four non-negotiables, and a map to the doctrine behind them. Everything else in
`${CLAUDE_PLUGIN_ROOT}/core/operating/` loads on demand, when the kernel's map sends you there.

Do not read all of `core/` up front. The kernel being small is the design, not an accident.

## 2. Find the workspace — in the project, never in this bundle

Look for a workspace manifest at `${CLAUDE_PROJECT_DIR}/.portulan/workspace.json` — that is the project
root, the directory the session was started in. If the variable is not set, use the working directory;
do not fall back to searching upward or outward.

**Search the project only.** This plugin bundle ships two workspaces of its own — Portulan's, used to
build Portulan, and a fictional demo under `examples/` — and both are real, valid manifests sitting
inside `${CLAUDE_PLUGIN_ROOT}`. Booting on one of those would load another team's identity, another
team's gate map, and another team's definition of done, and would look exactly like success. If the
project has no workspace, that is the answer; go to step 4.

## 3. Read the slots the manifest names

The manifest is an index, never a container: it names paths, and the prose lives in Markdown at the
other end of them. Read the slots in this order, because each frames the next:

1. `identity` — who this team is, what they work with, and their glossary. Terms defined there mean
   exactly that here.
2. `principles` — how they decide. The tie-breakers.
3. `constitution`, if declared — the document their work is graded against. It may point outside the
   workspace directory; it is the one slot allowed to.
4. `gates` — the gate map: which concrete actions are unattended, which need review, which need a
   human's explicit approval. **Read this before acting, not after.**
5. `dod` — the definition of done, which extends the engine's floor and may never lower it.
6. `repos/` — the card for the repository you are actually in: build, test, run, layout, quirks.
7. `memory/` — the rules this team has minted from its own incidents. Each carries provenance and a
   retirement condition, so a rule can be weighed rather than merely obeyed.

Then read `verify.recipes` from the manifest. Those are the executable checks that decide "done"
here, and the manifest names which one is the default.

## 4. If the project has no workspace

Say so plainly rather than improvising a policy layer. Without a workspace you have the engine's
universal mechanism and none of this team's policy — which means you do not know their gates, their
lanes, or their bar for done, and you should not guess at any of the three.

What is available to read, in this bundle:

- `${CLAUDE_PLUGIN_ROOT}/examples/` — a complete fictional workspace, two products, meant to be read
  end to end as the worked example.
- `${CLAUDE_PLUGIN_ROOT}/spec/` — the Workspace Definition: the schema and a per-slot document
  explaining what each slot is for and what it was derived from.
- `node ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs <workspace-dir>` — validates a workspace against that
  definition. Zero dependencies; it needs Node and nothing else.

Authoring a workspace is a human's job at this milestone: read the demo, copy its shape, and curate it.
There is no scaffolder yet — see step 5.

## 5. Report what is enforced, and what is not

Close the boot by stating the honest position, because the gap between what a framework *says* and
what it *enforces* is the thing an agent must not paper over:

- **The verify recipes are real.** They are executable and they exit 0 green / 1 red / 2 could not
  run. Nothing runs them for you automatically yet — the Stop-gate that blocks a "done" claim on a
  red recipe is a later milestone. Until then, running them is a condition of the definition of done
  and a habit.
- **The gate map is not compiled.** The tiers are honoured by people and by review; the hooks and
  permissions that would enforce them are the enforcement compiler, a later milestone. What *is*
  real is the platform floor beneath it — branch protection, required checks — where the team has
  configured one.
- **Memory has no generated index.** Recall means reading the directory.
- **There is no CLI, so nothing drafts a workspace for a team that has none.** `init` — the interview
  and codebase scan that produces a draft for a human to curate — plus `compile`, `vendor`, `index` and
  `upgrade`, all arrive with the CLI at a later milestone. What exists today is `doctor`, which validates
  a workspace somebody has already written.

State which of these apply to the workspace you just loaded, using its own documents. If a document
claims an enforcement that does not exist, that is a defect worth reporting, not a detail to smooth
over.
