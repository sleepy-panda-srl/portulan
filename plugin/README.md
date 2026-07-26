# plugin/

The **Claude Code adapter**. The engine in [`../core/`](../core/) is host-neutral by constitutional
requirement — *standards first, host adapters second* — so what is specific to one host lives here, and
`core/` never learns a host's vocabulary.

| Path | What it is |
|---|---|
| [`skills/portulan/SKILL.md`](skills/portulan/SKILL.md) | The boot skill. Loads the kernel, finds the *project's* workspace, reads its slots, and reports what is and is not enforced. Invoked as `/portulan`. |

**The agent bindings are not here — they are [`../agents/`](../agents/)**, at the repository root:
[`implementer`](../agents/implementer.md), [`reviewer`](../agents/reviewer.md),
[`librarian`](../agents/librarian.md), each short and pointing at its persona in
[`../core/personas/`](../core/personas/) for the doctrine. That location is fixed by the platform rather
than chosen, and the reasoning is below — it is the one place where "host-specific things live in
`plugin/`" does not hold, and the exception has a shape worth understanding rather than working around.

## How the plugin is assembled

The **repository root is the plugin root**, declared in
[`../.claude-plugin/plugin.json`](../.claude-plugin/plugin.json), and the marketplace entry in
[`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) sources it as `"./"`.

That is forced rather than chosen. Plugin component paths must start with `./` and must stay inside the
plugin root, so a plugin rooted at *this* directory could not reference `../core/skills/` — it could only
carry copies, and two copies of the engine's skills is precisely the drift class this project spent a
milestone building a lint against. Rooting at the repository lets `plugin.json` name `./core/skills/`
directly, so the skills the engine documents and the skills the plugin ships are the same files.

**The alternative was considered and rejected — and the reason recorded here at milestone 3, session 0
was false.** It said the platform dereferences symlinks resolving within a marketplace, so
`plugin/skills/clarify → ../../core/skills/clarify` would ship an engine-only payload, but that this
*"breaks local-directory installs — where symlinks resolving outside the plugin's own directory are
skipped rather than followed."* That second half was read from documentation and never measured.
Measured 2026-07-26 against Claude Code v2.1.215, on a committed git fixture whose link has exactly that
shape, **both readings of "local-directory install" follow the link**:

| install path | what happened to a link resolving outside the plugin directory |
|---|---|
| marketplace added from a local path | **dereferenced** — a real file in the cache, different inode, correct content, no symlink survives |
| `claude --plugin-dir` — the pre-release test path | **followed** — `Skills (2)  direct, linked`, status loaded |

Not measured: a marketplace install cloned from a remote carrying such a link. No symlink-bearing remote
exists to test against, and publishing a fixture repository to make one is an outward action whose only
purpose would be this measurement. So that third path is **unmeasured**, and saying so is the point —
one measurement standing in for two claims is how the false sentence above got written.

**The decision stands, on a reason the old record did not give.**
[`../cli/plugin-lint.mjs`](../cli/plugin-lint.mjs) refuses a declared component path that is a link out
of the plugin root — `FAIL paths  plugin.json skills declares "./skills/", which is a link out of the
plugin root`, exit 1 — a check hardened in session 0 after a review found lexical containment satisfiable
by precisely this shape. Taking the engine-only payload now means **relaxing that check**, which the gate
map singles out as the change to scrutinise hardest, because it is the one that makes every future green
mean less. The remaining cost from the original record survives untouched and unmeasured: symlinks are
fragile on checkouts without symlink support.

**What that costs, stated plainly:** installing the plugin copies the whole repository into the user's
plugin cache — `docs/`, `examples/`, `cli/`, `spec/`, and this repository's own `.portulan/` workspace.
It is all text and it is small, and for an open-core product whose thesis is *the product is the files*,
the spec and a complete demo workspace arriving beside the engine is closer to a feature than a cost. The
narrower payload is available later via a `git-subdir` source if the trade ever inverts.

**One consequence is a real hazard, and it is designed against rather than documented around.** The
bundle contains **three** workspace manifests — this repository's, the demo's, and
[`../cli/fixtures/drifted-workspace/`](../cli/fixtures/drifted-workspace/), which `doctor` exits 1 on by
design. Two are valid; the third is a fixture built to be wrong, which makes it the worse one to boot on.
A boot skill that looked for "a `.portulan/` nearby" would find one of them inside its own installation
directory and boot green on another team's identity, gate map, and definition of done. So the boot skill
searches `${CLAUDE_PROJECT_DIR}` and says so explicitly, and never `${CLAUDE_PLUGIN_ROOT}`.

_(Counted rather than remembered, at milestone 3 session 1. Session 0 wrote "two", which was true of the
valid ones and wrong about the bundle — the drifted fixture ships too, and had been in the tree since
milestone 2.)_

## Why the agent bindings sit at the repository root

**The host loads agents from `./agents/` and from nowhere else, and `plugin.json` declares no `agents`
key at all** — because declaring one does not point the loader at the files, it *suppresses* the scan
that finds them. The full measurement, with the positive control that makes it a measurement, is
[`../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md`](../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md).
This repository shipped the declared form, passed both validators, and its personas were inert on every
install until session 1's install demonstration counted them and got `Agents (0)`.

Since the plugin root **is** the repository root, the platform's default agents directory is the
repository's root — so the location is not a preference and cannot be moved into `plugin/` without
moving the plugin root there too, which would be much worse: **the installed payload is the plugin
root's subtree**, so a plugin rooted at `plugin/` would ship skills and agents and *not* `core/`. The
install exists to deliver the engine. The repo-rooted plugin was the load-bearing decision, and the
bindings' location follows from it.

**This is not host vocabulary leaking into the engine.** The quarantine boundary that matters is the
engine's, and `core/personas/` holds the doctrine — role, charter, capability classes, autonomy reach in
tier vocabulary — with no host's tool names in it. `agents/` is the plugin's *component surface*, and
this repository is itself the plugin, so a default component directory sitting where the platform's
contract fixes it is the contract showing through, not an abstraction failing. What would be a leak is
`core/` learning the word `Grep`, and it has not.

_(A symlink `agents/ → plugin/agents/` was built and measured working through `--plugin-dir` and a
local-path install before this was settled. It was rejected on the maintainer's direction, and the
reason is the honest one: the path that matters — a clone from the remote, then a marketplace install —
was never tested, so it stacked an untested behaviour on top of a platform quirk. Moving the files
removes that path from the question entirely.)_

Because nothing declares these files, a validator that only checks declarations stops seeing them — the
recipe printed `0 agent(s)` and GREEN the moment the key came out. So `plugin-lint` finds them by
convention instead, fails on a present `agents` key, asserts this repository's count of three against
the tree, and **reports any agent file stranded outside `./agents/`** — the mistake this repository
actually made, and the natural one to make, because *skills* load from custom declared paths and agents
do not. That rule and the memory entry behind it retire together, on the day a release makes the
`agents` key register what it names. One hole is left open deliberately and named rather than hidden: deleting `agents/` outright is
a note and exit 0, because a plugin that ships no agents is legitimate. What binds it is
[`../.portulan/tasks/0005-lint-the-persona-agent-binding.md`](../.portulan/tasks/0005-lint-the-persona-agent-binding.md)
— a persona with no binding is not legitimate, and that is the check that can say so.

## What checks this

- [`../.portulan/verify/plugin.sh`](../.portulan/verify/plugin.sh), on every pull request: the manifests
  parse and agree, every declared path resolves inside the tree, every declared skill — and every agent
  at the convention location — is real and carries a kebab-case `name` and a non-empty `description`.
  Paths are checked after canonicalisation, so a symlink out of the tree is an escape rather than
  containment. An `agents` key is itself a failure, for the reason above.
- `claude plugin validate --strict`, by hand at the supervised checkpoints and before a release. It owns
  the platform's contract; the recipe does not, and **neither is a superset of the other**
  ([`../.portulan/memory/a-checkers-coverage-is-measured-not-named.md`](../.portulan/memory/a-checkers-coverage-is-measured-not-named.md)).

Two measured limits worth knowing before trusting either. `claude plugin validate` at a marketplace root
validates **no** skills, and in plugin form validates only skills under the default `./skills/`
directory — every skill this repository ships sits behind a custom declared path, so it examines none of
them. And `marketplace.json` carries no `$schema` because the documentation names one for the plugin
manifest and not for the marketplace; guessing a URL would be a claim about somebody else's contract.

## Status

**Milestone 3 — the plugin installs from the remote, and everything it ships arrives.** A machine with
no local copy of this repository adds the marketplace by GitHub shorthand, installs, and the host reports
`Skills (3)` and `Agents (3)  reviewer, librarian, implementer`, with
`${CLAUDE_PLUGIN_ROOT}/core/engine.md` readable at 43 lines. Tagged `v0.1.0`.

That second count is the whole of milestone 3, session 1: the same install once reported **`Agents (0)`**
— every file shipped, both validators green — and it is what produced the `agents/` arrangement above.
It was re-measured through a clone rather than inferred from the `--plugin-dir` reading, because a green
from one install path had already been read as a green from another once.

**And it boots.** Run twice from that install: in a project with no workspace it reported the absence and
named all three bundled manifests as things it declined to fall back to; in a project carrying its own
workspace it read *that* one and quoted a glossary term confirmed absent from this repository and from the
payload beforehand, which is what makes the transcript proof rather than assertion.

**One measured limit, kept rather than rounded off.** With default headless permissions the kernel read is
**denied**, because `${CLAUDE_PLUGIN_ROOT}` lies outside the project and a session scoped to the project
refuses it. The boot handled the workspace half correctly regardless — which is the dangerous part, since
it looks like a boot with no engine in context. Step 1 of
[`skills/portulan/SKILL.md`](skills/portulan/SKILL.md) now says so.

No hooks and no settings ship yet. Hooks belong with the enforcement compiler at milestone 4, which is
where the gate map stops being honoured by people and starts being enforced by machinery — shipping a
hooks file before then would be packaging an enforcement that does not exist.
