# plugin/

The **Claude Code adapter**. The engine in [`../core/`](../core/) is host-neutral by constitutional
requirement — *standards first, host adapters second* — so everything specific to one host lives here,
and `core/` never learns a host's vocabulary.

Two things are in it, and both are bindings rather than content:

| Path | What it is |
|---|---|
| [`skills/portulan/SKILL.md`](skills/portulan/SKILL.md) | The boot skill. Loads the kernel, finds the *project's* workspace, reads its slots, and reports what is and is not enforced. Invoked as `/portulan`. |
| [`agents/`](agents/) | The three engine personas bound to this host's tools: [`implementer`](agents/implementer.md), [`reviewer`](agents/reviewer.md), [`librarian`](agents/librarian.md). Each is short and points at its persona in [`../core/personas/`](../core/personas/) for the doctrine. |

## How the plugin is assembled

The **repository root is the plugin root**, declared in
[`../.claude-plugin/plugin.json`](../.claude-plugin/plugin.json), and the marketplace entry in
[`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) sources it as `"./"`.

That is forced rather than chosen. Plugin component paths must start with `./` and must stay inside the
plugin root, so a plugin rooted at *this* directory could not reference `../core/skills/` — it could only
carry copies, and two copies of the engine's skills is precisely the drift class this project spent a
milestone building a lint against. Rooting at the repository lets `plugin.json` name `./core/skills/`
directly, so the skills the engine documents and the skills the plugin ships are the same files.

**The alternative was considered and rejected on cost, not on principle.** The platform dereferences
symlinks that resolve within the same marketplace, so `plugin/skills/clarify → ../../core/skills/clarify`
would ship an engine-only payload. It breaks local-directory installs — where symlinks resolving outside
the plugin's own directory are skipped rather than followed — which is exactly how this plugin is tested
before a release, and it is fragile on checkouts without symlink support.

**What that costs, stated plainly:** installing the plugin copies the whole repository into the user's
plugin cache — `docs/`, `examples/`, `cli/`, `spec/`, and this repository's own `.portulan/` workspace.
It is all text and it is small, and for an open-core product whose thesis is *the product is the files*,
the spec and a complete demo workspace arriving beside the engine is closer to a feature than a cost. The
narrower payload is available later via a `git-subdir` source if the trade ever inverts.

**One consequence is a real hazard, and it is designed against rather than documented around.** The
bundle contains two valid workspace manifests — this repository's and the demo's. A boot skill that
looked for "a `.portulan/` nearby" would find one of them inside its own installation directory and boot
green on another team's identity, gate map, and definition of done. So the boot skill searches
`${CLAUDE_PROJECT_DIR}` and says so explicitly, and never `${CLAUDE_PLUGIN_ROOT}`.

## What checks this

- [`../.portulan/verify/plugin.sh`](../.portulan/verify/plugin.sh), on every pull request: the manifests
  parse and agree, every declared path resolves inside the tree, every declared skill and agent is real
  and carries a description.
- `claude plugin validate --strict`, by hand at the supervised checkpoints and before a release. It owns
  the platform's contract; the recipe does not, and **neither is a superset of the other**
  ([`../.portulan/memory/a-checkers-coverage-is-measured-not-named.md`](../.portulan/memory/a-checkers-coverage-is-measured-not-named.md)).

Two measured limits worth knowing before trusting either. `claude plugin validate` at a marketplace root
validates **no** skills, and in plugin form validates only skills under the default `./skills/`
directory — every skill this repository ships sits behind a custom declared path, so it examines none of
them. And `marketplace.json` carries no `$schema` because the documentation names one for the plugin
manifest and not for the marketplace; guessing a URL would be a claim about somebody else's contract.

## Status

**Milestone 3 — the plugin exists and validates.** What is not yet demonstrated is the part that needs a
push: `v0.1.0` tagged, and a machine with no local copy of this repository adding the marketplace,
installing, and booting the engine. Both are the second half of
[`../.portulan/tasks/0003-plugin-and-public-marketplace.md`](../.portulan/tasks/0003-plugin-and-public-marketplace.md).

No hooks and no settings ship yet. Hooks belong with the enforcement compiler at milestone 4, which is
where the gate map stops being honoured by people and starts being enforced by machinery — shipping a
hooks file before then would be packaging an enforcement that does not exist.
