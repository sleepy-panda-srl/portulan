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
`tools/local-llm` runner's `--effort` sends with each request it makes. `doctor` fails a
malformed value and `compile` refuses one, and neither supplies a value the persona did not write. For a
persona a composed pack ships, `compile` writes the declared fields into the frontmatter of the role's
hand-written host binding, `agents/<name>.md` in the workspace's tree, and leaves every other line of
that file as its author wrote it; `--check` byte-compares the result, and a line inside the compiled
block that `compile` did not write is refused rather than removed. One it cannot catch: a line added inside
the block in exactly the spelling and order `compile` writes reads as compiled, and is dropped once the
persona no longer declares that field, since the two cannot be told apart. And once a persona declares any
field, `compile` owns every top-level key it could write, so a hand-written `experimental:` is refused
even for a key other than `cacheTtl`. A field a host cannot express is
named, with the persona and the host, in the degradation report `compile` prints. Claude Code takes all
four on an agent (`cacheLifetime` as `experimental.cacheTtl`), and a vendored `AGENTS.md` takes none.
**Claude Code loads `agents/` only from a plugin root**, and a repository that is not a plugin loads its
agents from `.claude/agents/`, which `compile` does not write. So outside a plugin the compiled block is
loaded by nothing, and the degradation report says so for each persona it applies to. Where the tree is
a plugin root the report is silent, which is not proof of loading: a plugin's agents load only while it
is installed and enabled, and `compile` cannot see that. _(Provenance:
proposal `0036`'s order of work, item 7, and proposal `0039`'s first two rules. The host's keys, values
and agent locations were read in Claude Code 2.1.317's program text on 2026-11-03.)_

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
