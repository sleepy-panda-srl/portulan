**type:** rule
**scope:** workspace — anyone declaring a component in a host's manifest and believing the declaration
**provenance:** `form=link` `href=../handoffs/2026-07-26-the-tag-and-the-install.md`
— milestone 3, session 1. The fresh-machine install demonstration reported `Agents (0)` for a plugin
whose manifest declared three, whose files all shipped, whose own lint counted three, and which
`claude plugin validate --strict` passed.

A manifest field that a validator **accepts** is not a field the runtime **loads**. The two are separate
contracts, and a green validator says nothing about the second. Before believing that a declared
component ships, load it and count what arrived — against a positive control, so that "zero" is
distinguishable from "this command does not report that".

**Why it holds:** the failure is silent on every surface a reader would check. Measured 2026-07-26
against Claude Code v2.1.215, with a control that made the result legible:

| what the manifest said | plugin loads | agents registered |
|---|---|---|
| no `agents` key, files at `./agents/` | yes | **1 — the control** |
| no key, files at `./plugin/agents/` | yes | 0 |
| `agents: ["./agents/probe.md"]` — explicit file, default path | yes | 0 |
| `agents: ["./plugin/agents/implementer.md", …]` — what this repository shipped | yes | **0** |
| `agents: ["./agents/"]` or `["./plugin/agents/"]` or `["./plugin/agents"]` | **fails to load at all** | — |

So the key does not merely fail to help: **it suppresses the scan that works.** Row 3 is the one that
matters — the same files, in the place the host reads, register nothing once a key names them.

The control is what makes this a measurement rather than a guess. `Agents (0)` on its own is equally
consistent with "the personas did not load" and with "this command does not count agents"; a second
plugin that reports `Agents (1)` from the same command, in the same minute, rules the second one out.
A negative reading with no positive control is not evidence.

Note what did *not* catch it, because each looked like it should have. The repository's own
`plugin-lint` resolved the declared paths, walked them, and validated all three files — it was
measuring the tree, and the tree was fine. `claude plugin validate --strict` exited 0 — it owns the
manifest's *schema*, and the field was schema-valid. The session-0 checkpoint even measured the
first-party validator's coverage by forced red, which is the discipline
[`a-checkers-coverage-is-measured-not-named.md`](a-checkers-coverage-is-measured-not-named.md) exists
to enforce, and still missed this: every one of those reds was forced in a *file*, and this defect is
not in any file. It is in the relationship between a manifest and a loader, and only an install shows
it.

**When to apply:** whenever a manifest declares something a host is supposed to pick up — agents,
hooks, commands, MCP servers, output styles — and the evidence for "it ships" is that a validator
passed or a path resolves. Install it and read the inventory. The question is not *is the declaration
well-formed* but *did the thing arrive*, and only the second one is what a user gets.

**How this differs from the rule beside it.**
[`a-checkers-coverage-is-measured-not-named.md`](a-checkers-coverage-is-measured-not-named.md) is about
a checker that never examined the artifact. This is about a checker that examined it correctly and
reported truthfully, while the artifact still did nothing — the tree was right, the manifest was valid,
and the capability was absent anyway. There was no lie to find at rest. It existed only at runtime.

**Retire when:** the platform validates its own manifest against its own loader — that is, when
declaring a component the runtime will not read is itself an error rather than a shrug. At that point
`claude plugin validate` covers this and the rule is doing no work.

**Retire together with the lint rule this entry is cited by.** `plugin-lint`'s stranded-agent report —
*"this file is not in `./agents/`, the only directory the host loads agents from"* — exists only
because of the platform fact measured here. If the fact changes, that report becomes a generator of
false notes about files that load perfectly well, so the rule and this entry come out in the same
change. The pairing is stated in the rule's comment too, so whoever finds one finds the other.

**Re-test on every Claude Code upgrade**, and this half is the more urgent one, because a workaround
outlives the defect that justified it and then reads as taste. The measurement above is dated and
version-stamped for exactly that reason. **If the `agents` key starts registering the files it names,
the location constraint dissolves**: the bindings may move back under
[`../../plugin/`](../../plugin/) with the rest of the host adapter, `plugin-lint`'s refusal of the key
becomes a false red and must go with it, and `docs/plan.md`'s topology row for `agents/` comes back out.
Whoever runs that upgrade should read this paragraph as a to-do rather than as history — the whole cost
of the current arrangement is one directory sitting somewhere the doctrine would not have put it, and
the only thing holding it there is a platform behaviour that was measured once, on one version.
