# Repo — portulan

**What it is.** The Portulan monorepo: the engine, the spec, plugin packaging, the CLI, and the demo
workspace, plus the manifest that makes the repository installable as a Claude Code plugin feed. Blast
radius is the whole product — this is the only repository the product ships from, its history is
permanent, and part of that history **was world-readable**: the repository was public 2026-07-27 →
2026-08-03 and is **private again since 2026-08-03** (re-measured 2026-08-10).

**Build / test / run.**
- build: none, and as of the maintainer's ruling of 2026-07-31 that is permanent rather than pending — the CLI ships as zero-dependency ESM, so `package.json` (milestone 7) declares the `bin` and no dependencies, and `npm install` fetches nothing
- test: `./.portulan/verify/docs.sh` — the default recipe, and the one the Stop-gate runs automatically since milestone 4 (see [`../../core/operating/verification.md`](../../core/operating/verification.md)). **Nine** more are declared in [`../workspace.json`](../workspace.json) and **eleven** run in CI, because CI runs the recipe set the manifest yields rather than the list it declares — the ten declared, plus one composed from the `tools/github` pack through [`../../cli/recipe-set.mjs`](../../cli/recipe-set.mjs) since milestone 7 session 5. The declared nine beside `docs.sh`: `json.sh`, `doctor.sh`, `tests.sh`, `plugin.sh`, `compile.sh`, `workflow-filters.sh`, `index.sh`, `control-chars.sh`, `rule-carriers.sh`. **Do not read these figures from here — `node cli/recipe-set.mjs --workspace .portulan --repo-root .` prints the set, and this line is a hand-maintained copy of what that command derives.** _(It has now been wrong three times: seven-and-eight after `control-chars` landed 2026-08-07, again after composition, and nine-and-ten after `rule-carriers` landed 2026-08-10 — caught each time by a reader rather than a rail, because `doctor`'s claims lint reads only the path-shaped tokens on this line and never the counts around them.)_
- run: `node cli/portulan.mjs <subcommand>` since milestone 7 — the eight `docs/vision.md` names, **all of which dispatch** since session 9, when `upgrade` (the last) was built. Do not read that list from here either: `node -e 'import("./cli/portulan.mjs").then(m => console.log(m.SUBCOMMANDS.map(s => s.name + (s.module ? "" : " (unbuilt)")).join(" · ")))'` derives it, and this line is a hand-maintained copy the way the recipe counts above are. Or `./.portulan/verify/doctor.sh` — the nearest thing to running the product: it validates both workspaces against the Workspace Definition. From milestone 3 there is a second sense of "run": install the repository as a Claude Code plugin and invoke `/portulan`, which boots the engine ([`../../plugin/`](../../plugin/))

**Gates.** Inherits [`../gate-map.md`](../gate-map.md) with no deviations. Two worth keeping in front of
mind because they are unusual: [`../../docs/vision.md`](../../docs/vision.md) is never edited by an agent
at all, and repository **visibility** is Gated — **private since 2026-08-03**, after a public window of
2026-07-27 → 2026-08-03. The setting has now moved **twice**, both times by the maintainer's decision;
further visibility changes stay Gated, by decision, not by accident
([`../memory/repo-is-private-until-flip-clearance.md`](../memory/repo-is-private-until-flip-clearance.md)).

**Layout.** [`../../core/`](../../core/) the engine · [`../../spec/`](../../spec/) the Workspace
Definition · [`../../cli/`](../../cli/) the `portulan` entry point, `doctor`, `plugin-lint`, `compile`,
`index`, `librarian` and their tests ·
[`../../docs/`](../../docs/) constitution and plan · `.portulan/` this workspace ·
[`../../examples/`](../../examples/) the demo workspace · [`../../plugin/`](../../plugin/) the Claude Code
adapter — the boot skill · [`../../agents/`](../../agents/) the three personas bound to this host, at the
root because that is the default agents directory of a plugin rooted at this repository, and the host
reads no other (measured 2026-07-26 on Claude Code v2.1.215; re-measure at the next upgrade) ·
[`../../.claude-plugin/`](../../.claude-plugin/) the plugin and marketplace manifests. The
remaining top-level directories are scaffolding that fills in milestone by milestone.

**Quirks.**
- The kernel [`../../core/engine.md`](../../core/engine.md) is line-budgeted. Adding to it is the wrong
  reflex; the right one is to write in `core/operating/` and link from the kernel only when the line is
  load-bearing for *every* task.
- [`../../docs/plan.md`](../../docs/plan.md) is a living document — Status column and Session log are
  updated as work lands, and it is what a session boots from. [`../../docs/vision.md`](../../docs/vision.md)
  sits next to it and is the opposite: frozen, human-owned, never agent-edited.
- A build-session bootstrap file at the repository root is deliberately git-ignored and never committed.
  If it appears in a diff, that is the bug.
- History cleanliness is load-bearing here in a way it is not in most repositories: part of this history
  **was** world-readable (public 2026-07-27 → 2026-08-03), clones from that window cannot be recalled,
  and visibility has already moved twice — so the pre-commit scan ([`../dod.md`](../dod.md), condition
  5) runs before every commit rather than before releases. **Being private again does not relax it**;
  condition 5 spells out why.

**Provenance.** Written in milestone 1, session 3 — the first repo card in the first real workspace.
Amended in milestone 2, session 2, when `doctor` gave this card's own claims a checker: the build/test/run
lines and the layout above are now linted against the tree, which is the first time anything in this
repository has held a workspace document to reality. **The standing instruction here — *"rewrite it when
the CLI lands at milestone 7 and the build line stops reading none"* — is discharged 2026-08-13, and
discharged rather than deleted because its second half can never come true:** the CLI landed at
milestone 7, but `build: none` is **permanent** by the maintainer's ruling of 2026-07-31, recorded at
the build line above. An instruction conditioned on two events, one of which was ruled impossible after
it was written, is a rewrite nobody can ever be obliged to perform — so it is retired here with its
reason rather than left as an obligation that reads live. Found by milestone 7's close pass.
