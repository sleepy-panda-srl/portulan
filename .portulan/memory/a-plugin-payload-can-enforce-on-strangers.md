**type:** rule
**scope:** workspace — anyone shipping a repository that is also a plugin, and putting enforcement in it
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-enforcement-compiler.md`
— milestone 4, session 0. The enforcement compiler needed somewhere to put generated hooks, and the
obvious top-level `hooks/` would have shipped this repository's push denials to every installer.

When a repository is distributed as a plugin, **its payload is not inert**. Some top-level directory
names are read by the host as plugin components, and enforcement placed in one of them enforces on
*other people's machines, in projects unrelated to yours*. Before putting any behaviour-bearing file
at the top level of a distributable tree, measure whether the host activates it for an installer —
and pick the location where the measurement says it stays inert.

**Why it holds:** measured 2026-07-27 against Claude Code 2.1.220, with a positive control.

| what the plugin shipped | effect on an installer, in an unrelated project |
|---|---|
| `hooks/hooks.json` (well-formed) | **the hook fires** — the tool call was denied with the plugin's own message |
| no plugin loaded — the control | the identical command ran normally |
| `hooks/hooks.json` (wrong shape) | **the whole plugin fails to load**: `Status: ✘ failed to load` |
| `.claude/settings.json` carrying a `deny` rule | **no effect** — the command ran normally |

The third row is how the convention was discovered *before* any hook fired: the host validated the
file's shape and refused the plugin over it, which proves it was being read. A directory nobody
declared, in a manifest that never mentions it.

So `.claude/settings.json` is the safe home and `hooks/` is not. The compiled artifact ships inside
the payload either way — it is a file in the tree — but it only *activates* when this repository is
the project, which is the dogfooding the milestone wanted and nothing wider.

**Why this is worth a rule rather than a note.** The blast radius is other people. Every other defect
this repository has recorded cost *us* a false green; this one would have denied a stranger's `git
push` and blocked their sessions with a gate map they never adopted, for reasons no error message
would explain. And it would have looked correct from every angle available at rest: the file is
well-formed, the lint passes, the plugin validates, and the harm is only visible from an installed
copy in someone else's project.

**When to apply:** any time a tracked file's location is chosen inside a tree that is also a
distribution unit — hooks, settings, commands, MCP configuration, output styles, agents. Ask *what
does this do for someone who installs us*, and answer it with an install rather than an inference.

**How this differs from the entry beside it.**
[`a-manifest-field-can-validate-and-load-nothing.md`](a-manifest-field-can-validate-and-load-nothing.md)
is the same platform seam read from the other side: there, a declaration the runtime did **not** load,
costing us a capability we thought we shipped. Here, a directory the runtime **does** load without any
declaration at all, costing someone else a constraint they never agreed to. Both say the same thing —
for a repo-rooted plugin, top-level names are platform-reserved and the manifest is not the whole
contract — and it is worth having both, because one is a capability that silently vanishes and the
other is a capability that silently escapes.

**Retire when:** plugin components must be declared to be loaded, so that a directory the manifest
does not name is genuinely inert. At that point the location stops being load-bearing and this is
history.

**Re-test on every Claude Code upgrade.** The table above is version-stamped for the usual reason: a
constraint that outlives the platform behaviour justifying it becomes taste, and taste is what nobody
can argue with later. If `hooks/` stops being scanned, this repository is free to put compiled
enforcement wherever the doctrine would naturally have put it.
