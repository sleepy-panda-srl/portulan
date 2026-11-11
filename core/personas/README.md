# core/personas/

A **persona** is a role an agent takes — implementer, reviewer, librarian — packaged as a **context
firewall**: its own attention window, its own memory, and a `tools:` allow-list that grants only what
the role needs. The parent loop fans work out to a persona and gets back a conclusion, not the persona's
whole transcript, so the parent's context budget stays clean. _(Provenance: HumanLayer — subagents as
context firewalls; Cognition — read-parallel / write-isolated.)_

## What a persona file carries

- **`tools:` allow-list** — default-deny; the role's least-privilege surface (see
  [`../operating/safety.md`](../operating/safety.md) and [`../operating/autonomy.md`](../operating/autonomy.md)).
- **Charter** — what the role is for, and just as importantly what it must *not* do.
- **Autonomy reach** — the highest tier the role may act in, in tier vocabulary (Auto / Propose /
  Gated), not concrete actions — the gate map that binds actions to tiers is workspace policy (see
  [`../operating/autonomy.md`](../operating/autonomy.md)). **Prohibited is never a reach**: it is the
  one tier no role may act in, so it does not appear here — a persona declaring it would be claiming a
  permission that does not exist for anyone.
- **Memory scope** — memory is per-agent; a reviewer's memory is not the implementer's (see
  [`../operating/memory.md`](../operating/memory.md)).
- **Read / write posture** — most personas read in parallel; writes are isolated to one place so two
  agents never clobber the same file.

## What a persona may declare about its context

Four optional frontmatter fields say what a fresh context for the role should cost, per
[`../operating/context.md`](../operating/context.md): `model`, one model name or alias as a single
token; `effort`, one of `low`, `medium`, `high`, `xhigh` or `max`; `omitClaudeMd`, `true` or `false`
unquoted, whether the role runs without the project's instruction files; and `cacheLifetime`, `5m` or
`1h`. The effort levels and the name `omitClaudeMd` are adopted from Claude Code's vocabulary, the first
host to express them. `effort` sets the host subagent's reasoning effort, and is not the thinking cap the
`tools/local-llm` runner's `--effort` sends with each request it makes. `doctor` fails malformed values
in composed pack personas; `compile` validates every persona source it compiles. Neither supplies a value
the persona did not write. `compile` writes declared fields from composed pack personas into the
frontmatter of the role's existing host binding: `agents/<name>.md` in a plugin tree and
`.claude/agents/<name>.md` in an ordinary project. Compiler and doctor share that selection; a malformed,
unreadable or escaping plugin marker is not treated as an ordinary project. When
the declared tree resolves to this compiler's own engine root, including a canonical alias, the same
pipeline also reads `core/personas/*.md` except this README. A foreign tree's matching files do not
participate. A core source's declared name must match its filename. The compiler leaves every other line of
that file as its author wrote it; `--check` byte-compares the result, and a line inside the compiled
block that `compile` did not write is refused rather than removed. One it cannot catch: a line added inside
the block in exactly the spelling and order `compile` writes reads as compiled, and is dropped once the
persona no longer declares that field, since the two cannot be told apart. And once a persona declares any
field, `compile` owns every top-level key it could write, so a hand-written `experimental:` is refused
even for a key other than `cacheTtl`. A field a host cannot express is
named, with the persona and the host, in the degradation report `compile` prints. Claude Code takes all
four on an agent (`cacheLifetime` as `experimental.cacheTtl`), and a vendored `AGENTS.md` takes none.
`compile` writes only existing bindings; an absent adopter binding remains unbound and is never
created by compilation. A persona-only workspace can compile its declared fields without a gate
policy or guidance. Nonregular, escaping and invalid UTF-8 inputs are refused before writes.
Doctor checks the selected binding's name and declared tool grant, keeping an unread file distinct
from an absent one. Plugin packaging checks core and actually composed charter owners in both
directions, including personas declaring no context fields. File equality proves neither plugin
enablement nor that a running host honored a field. _(Provenance:
proposal `0036`'s order of work, item 7, and proposal `0039`'s first two rules. The host's keys, values
and agent locations were read in Claude Code 2.1.317's program text on 2026-11-03.)_

This product binds both composed roles. Supervisor still requires a fresh invocation for a checkpoint.
Local-worker's host wrapper points to its existing loopback runner; loading that role does not itself
invoke a local model or prove local execution.

The three core sources explicitly declare `model: inherit`, `omitClaudeMd: false` and
`cacheLifetime: 5m`, leaving effort undeclared. These are product-role policy choices: inherit the
parent model, retain the instruction floor and request a five-minute cache lifetime. In Claude Code,
explicit `inherit` outranks the ordinary `CLAUDE_CODE_SUBAGENT_MODEL` default; an invocation's model
selection and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` can override it. Cache lifetime remains subject to
the host's precedence rules. Compilation proves the committed bytes, with no claim about quality,
savings or live loading. _(Host precedence checked against the
[official subagent documentation](https://code.claude.com/docs/en/sub-agents) on 2026-11-09.)_

The acquired [implementer](../../evals/ab/personas/implementer.md),
[reviewer](../../evals/ab/personas/reviewer.md) and
[librarian](../../evals/ab/personas/librarian.md) comparisons each have three
frozen artifact cases, one attempt per arm, through native children on Sonnet 5.5
in Claude Code 2.1.321. Both arms pass all nine cases. Medium has a lower
cold-normalized cost index in this observation; observed cache costs differ,
and the reviewer arm's observed cost rises. These results support the retained
policy on that corpus and model, with no global medium default earned for other
inherited models. The [protocol](../../evals/ab/personas/README.md) discloses the
small sample, both probes, full parent/child usage and one retained-answer
decoder repair after the first outcome. The shipped offline checker regrades
the records and checks routing and source bytes.

A binding has one persona owner across core and composed pack sources, including an unbound persona or one declaring
no fields; duplicate destinations are refused before any artifact is written. The binding must be a
regular file whose real path stays in the real declared tree, including its parent directories.
`omitClaudeMd` accepts only unquoted `true` or `false`, in both declarations and compiled blocks.

`upgrade` refreshes existing eligible bindings through the same compiler planner,
including normal host-cache pack discovery and its shadow refusals. It preserves
unrelated binding text and modes, creates no absent binding, and writes no gate
settings. Core sources still participate only in the installed engine's own
declared tree; an ordinary adopter receives the baked core agents by updating the
plugin, without installing a foreign core adapter. The command-level historical
v0.2.0 demonstration is in
[`../../cli/persona-upgrade.test.mjs`](../../cli/persona-upgrade.test.mjs).

## Status

**Milestone 3 — contract, exemplars, and one host binding.** This README fixes the persona contract; the
exemplar personas [`implementer`](implementer.md), [`reviewer`](reviewer.md), and
[`librarian`](librarian.md) are authored against it. They stay host-agnostic — each `tools:` allow-list
is a set of capability classes — and milestone 3 bound those classes to concrete Claude Code tools in
[`../../agents/`](../../agents/), which is where a host's vocabulary is allowed to appear.

**The binding is lossy, and that is the useful finding.** Of the three charters, exactly one
survives translation into a tool grant: the reviewer *does not edit the code under review*, so its
agent is granted no write tool and the firewall becomes a rail. The other two do not. The
implementer's Auto/Gated line cannot be drawn with a tool list on a host where one `Bash` grant
covers both running a verify recipe and merging a pull request; the librarian's *drafts everything,
accepts nothing* is a constraint on what it may conclude, not on what it may call. Each agent file
says which of the three it is, so nobody reads a frontmatter list as the gate. What holds those two
is the workspace's gate map and the platform floor — which is the constitution's point that the
platform floor is the gate no prompt can bypass, met from the other direction.
