# Task — the plugin, and the marketplace that ships it

**Goal.** The engine stops being a directory somebody clones and becomes something a stranger installs.
This repository is already declared a plugin marketplace; at the end of this task it actually is one,
with a plugin in it that boots the engine on a machine that has never seen this folder.

This task spans **both milestone-3 sessions**. Session 0 builds the artifact and the rail that checks it;
session 1 cuts the tag and demonstrates the install, both of which need a push first.

**Acceptance criteria.**

Session 0 — the artifact:
- [x] When the repository is read as a plugin, the system shall carry a
      [`plugin.json`](../../.claude-plugin/plugin.json) naming the engine's skills and the personas as
      agents.
- [x] When the marketplace manifest is read, it shall list at least one plugin — a marketplace declaring
      none is the fail-open this milestone exists to close.
- [x] When the plugin is installed and the engine booted, the boot skill shall look for a workspace in
      the **project**, never in its own bundle. _(The bundle ships two valid workspaces of its own;
      booting on one would load another team's policy and look exactly like success.)_
- [x] When a persona is delegated to on this host, it shall arrive as an agent whose tool grant matches
      its charter — and where the host cannot express the charter, the agent shall say so rather than
      imply the grant is the gate. _(Ticked in session 0 and **false**: the files shipped, both
      validators passed, and the installed plugin reported `Agents (0)`. Re-ticked in session 1 against
      a host that reports `Agents (3)  reviewer, librarian, implementer` — read through `--plugin-dir`,
      the pre-release test path, since the remote cannot carry the fix until this merges. The tick rests
      on a count from the host rather than on the manifest saying so
      ([`../memory/a-manifest-field-can-validate-and-load-nothing.md`](../memory/a-manifest-field-can-validate-and-load-nothing.md));
      the criterion below is the one that holds it to an **install**, and it stays open.)_
- [x] When either manifest declares a path that does not resolve, or a declared skill or agent lacks
      frontmatter or a description, the packaging validator shall exit non-zero.
- [x] When the packaging validator is declared in [`../workspace.json`](../workspace.json), CI shall run
      it with no workflow edit.
- [x] When `claude plugin validate --strict` runs against this repository, it shall pass — and its
      coverage shall be **measured by forced red** rather than inferred, with the result recorded
      whichever way it lands.

Session 1 — the distribution (needs a push; every item below is Gated or downstream of one):
- [ ] When `v0.1.0` is tagged, the tag shall name the commit whose manifests declare `0.1.0`.
- [ ] When a machine with no local copy of this repository adds the marketplace and installs the plugin,
      the engine shall boot: the kernel loads, and a project workspace is found or its absence is
      reported.
- [x] When the install is demonstrated, the transcript shall record which visibility it was performed
      under, because a private repository's install path is authenticated and a public one's is not.
      _(**PRIVATE**, recorded at the moment of the install. The clone came over HTTPS after the CLI
      probed for SSH and fell back on its own — no `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` was needed,
      correcting session 0's open question 1.)_

**Added in session 1**, because the install refuted an accepted criterion above:
- [ ] When the plugin is **installed from the remote**, the host shall report the three personas in its
      component inventory. _(Nothing previously asserted this against the host — the manifest asserted it
      against the tree, and the tree was never the question. `Agents (3)  reviewer, librarian,
      implementer` is measured two ways so far: a `--plugin-dir` load, and a **local-path** marketplace
      install into a versioned cache, which also confirmed `${CLAUDE_PLUGIN_ROOT}/core/engine.md`
      readable at 43 lines. Neither is the path a stranger uses, and the clone could not carry the fix
      while it sat on a branch. **Deliberately left unticked** — this criterion exists because a green
      from one install path was read as a green from another, and ticking it on the same reasoning would
      be the identical mistake one level up.)_
- [x] When `plugin.json` declares an `agents` key, the packaging validator shall exit non-zero — the
      key suppresses the only scan that loads agents.
- [x] When an agent at the convention location lacks frontmatter, a kebab-case `name`, or a non-empty
      `description`, the packaging validator shall exit non-zero, even though nothing declares it.

**Verify.** `./.portulan/verify/plugin.sh` exits `0` against this repository and non-zero against a
broken manifest, a dangling component path, and a skill with no description — each forced red before the
green is believed. `claude plugin validate --strict` exits `0`, run without a pipe. The other four
recipes stay green.

**Constraints.** [`../../docs/vision.md`](../../docs/vision.md) is not edited. The engine in
[`../../core/`](../../core/) stays host-neutral — anything specific to Claude Code lives in
[`../../plugin/`](../../plugin/), which is what keeps the LLM-agnostic clause true rather than aspirational.
No skill is copied: the plugin **references** `core/skills/`, because two copies of the engine's skills
is the drift class this repository spent milestone 2 building a lint against. The repository stays
private; the visibility flip is a separate authorization hold, not part of this criterion.

**Context.** [`../../docs/plan.md`](../../docs/plan.md) — the milestone-3 row and its amendment ·
[`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
— why both validators are run and neither is trusted on its name ·
[`../handoffs/2026-07-25-doctor-and-the-demo-workspace.md`](../handoffs/2026-07-25-doctor-and-the-demo-workspace.md)
— what milestone 3 inherited · [`0004-a-harness-for-the-verify-recipes.md`](0004-a-harness-for-the-verify-recipes.md)
— the carried item this task deliberately does not absorb.

**Lane.** full — new packaging, a new verify recipe, an amended exit criterion, and milestone status all
move. Any one of those is full-lane on its own ([`../gate-map.md`](../gate-map.md)).
