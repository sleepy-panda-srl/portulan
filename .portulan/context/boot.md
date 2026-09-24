---
tier: always
---

# Portulan boot card

> This repository's boot, compiled from `.portulan/context/boot.md` into every context here. Each section
> names the file behind it. A rule scoped to a path loads when you first touch that path, and names the
> file it continues.

## The kernel

@../../core/engine.md

## Reading and the cache: `core/operating/context.md`

<!-- engine: operating/context.md#every-request-pays-for-what-the-session-has-read -->

## Who we are, and what we build: `.portulan/identity.md`

Sleepy Panda SRL: one maintainer who owns every decision, and coding agents under the supervised-build
protocol, in which an implementer proposes, a fresh-context supervisor grades against the constitution,
and the maintainer merges. We build Portulan, whose product **is** its files, so the bar on prose here is
a product bar. The stack is Markdown, Bash recipes and zero-dependency ESM on Node, run straight from a
checkout: no framework, no build step, nothing installed. **The glossary there is binding**: engine,
kernel, workspace, pack, repo card, task, lane, gate map, verify recipe, principles, constitution,
manifest, slot, tree and Stop-gate mean exactly what it says, so open it when a sentence of yours turns
on the exact meaning of one of them.

## How we decide: `.portulan/principles.md`, each with its reason

<!-- leads: ../principles.md -->

## What our work is graded against: `docs/vision.md`

The constitution. Read it when a rule, a proposal or a review cites it (on demand, by the maintainer's
decision of 2026-09-23).

## Gates: `.portulan/gates.json` is the policy, and `.portulan/gate-map.md` argues it

Where the two disagree the policy wins, because it is the one that compiles. A gate binds the act, not
its spelling.

- **Auto**, unattended: `read-anything-in-the-repository`, `edit-on-a-working-branch`,
  `run-a-verify-recipe`, `commit-to-a-working-branch`, and `push-a-working-branch` with
  `--force-with-lease`, never to `main`. Unattended is not unchecked: the pre-commit scan, and for
  full-lane work the pre-commit checkpoint, are still owed.
- **Propose**, reviewed before it counts: `open-a-pull-request`, with a label from
  `.portulan/labels.json` and `agent-driven` beside it; `change-doctrine`, `change-this-workspace`,
  `change-the-constitution`, `change-the-plan` and `change-a-verify-recipe`. An idea that adds an axis,
  a mode or a surface starts as a proposal in `.portulan/proposals/`.
- **Gated**, the maintainer's approval for each action, never inferred and never standing:
  `merge-a-pull-request`, its head not behind `main`; `delete-a-remote-branch`,
  `force-push-without-a-lease`, `change-repository-settings`, `create-a-repository`,
  `rename-or-transfer-a-repository`, `delete-a-repository`, `tag-a-release`, `publish-a-release`,
  `publish-to-a-package-registry`, `spend-money-or-register-a-domain` and
  `send-something-outside-this-repository`; and `commit-without-the-hooks`, from the
  `rituals/checkpoints` pack.
- **Prohibited**, where no approval exists: `self-certify-a-checkpoint`, from the same pack.

**Open `.portulan/gate-map.md` before a merge, a release, a settings change, a branch deletion, a review
round, or an edit to what a gate guards.** It holds each gate's conditions, the honest holes where no
layer enforces and you hold the rule yourself, which identity acts, and the merge discipline: the session
that owns a pull request awaits Copilot's round on its final head, and an open thread blocks the merge.

**Lanes.** Triage is a change confined to one file, with no rule change, no new claim about the product
and no milestone effect; everything else is full lane. Full-lane work is graded in a fresh context at
session-open, pre-commit and milestone-close; work on doctrine, the tiers or the platform floor takes the
pre-commit checkpoint even when no milestone row moves; and a milestone is never self-certified.

## Done: `.portulan/dod.md`, each condition with its reason

Core's floor is beneath these: a green verify, and nothing reported done that you could not explain. A
change here is done when all of them hold, and you read `.portulan/dod.md` before you call work done.

<!-- leads: ../dod.md -->

## This repository: `.portulan/repos/portulan.md`

The whole product ships from here, and its history is world-readable, so the seam scan runs before
every commit. There is no build step, and none is pending. `./.portulan/verify/docs.sh` is the default
recipe, the one the Stop-gate runs, and
`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs` prints every recipe CI
runs. Close a change with
`git add <new files> && node cli/finish.mjs --pack-root packs -m "<subject>" -m "<why and trailers>"`:
one call runs every recipe CI runs, checks the changelog fragment, commits and pushes, and on a red
commits and pushes nothing. `node cli/portulan.mjs <subcommand>` runs the CLI. A build-session bootstrap
file at the root is git-ignored and never committed: in a diff, it is the bug.

## Packs: `rituals/checkpoints` and `tools/github`

The manifest composes both, and a declared pack is not an invocable one. What each delivers here, and the
four things a report on them must state, are in `plugin/skills/portulan/packs.md`, which the rule on the
packs' paths sends a session to: read it before you change how they compose or report what they deliver.

## What is enforced here, and what is not

- **The verify recipes are real**: each exits 0 green, 1 red, 2 could not run. The Stop-gate runs the
  default recipe alone, blocks a turn's end on a red or a could-not-run up to its caps, and asks for a
  handoff where work is left uncommitted or unpushed; running the rest is condition 1.
- **The gate policy is compiled here**, into `.claude/settings.json`'s permission rules and hooks, and
  `main` has a platform floor: pull requests only, `workspace-verify` and `pr-labeled` required,
  administrators included. Where the gate map names an honest hole, you hold the rule.
- **This card and the rules beside it are compiled** from `.portulan/context/` and byte-compared by the
  `compile` recipe, as the memory index below is by the `index` recipe.

## Memory: the rules this team minted from its incidents

Each record carries its provenance and when it retires; open one when its title touches your task.

@../memory-index.md
