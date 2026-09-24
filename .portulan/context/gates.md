---
tier: on-path
paths:
  - ".portulan/gates.json"
  - ".portulan/gate-map.md"
  - ".portulan/gate-map/**"
  - ".portulan/labels.json"
  - ".portulan/compile/**"
  - ".portulan/verify/**"
  - ".claude/settings.json"
  - ".github/**"
description: The gate policy, what it compiles to, the platform floor and the verify recipes, and what a change to any of them owes.
---

# Changing the gates, the floor or a recipe

You are on a path where the gate policy, the platform floor or a verify recipe lives. A change here is
full lane, with a fresh-context pre-commit checkpoint even when no milestone row moves, and relaxing a
check is the change to scrutinise hardest, because it makes every later green mean less. Read
`.portulan/gate-map.md` in full before the change, and the `gate-map/` file its line links;
`.portulan/verify/README.md` says what each check enforces and why.

- **`gates.json` is the policy.** Each gate-map bullet cites the id of the rule that enforces it, and the
  suite checks the pair both ways; where they disagree, the policy wins.
- **What it compiles to is never edited by hand.** `.claude/settings.json` and
  `.portulan/compile/github-ruleset.json` are written by
  `node cli/compile.mjs --workspace . --pack-root packs` and byte-compared by the `compile` recipe. The
  ruleset is generated and nothing applies it: changing a repository setting is Gated.
- **A recipe exits 0 green, 1 red, 2 could not run.** It guards every external command it runs, so a
  missing tool is a 2 and never a red, and it never repairs what it checks. `.portulan/identity/stack.md`
  says what each recipe may need beyond `bash` and why: read it before a change to what a recipe needs.
