# `tools/local-llm` — Hybrid local-model execution under Portulan's rails

A tool pack for **Hybrid AI Orchestration**, argued in Proposal [`0039`](../../../.portulan/proposals/0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md). It lets a frontier orchestrator session offload bounded code transformations, verify-gated red→green retries, research summarization, and librarian drafts to a local OpenAI-compatible runtime (such as **LM Studio** on `http://127.0.0.1:1234/v1` or **Ollama** on `http://127.0.0.1:11434/v1`) at **zero API token cost** and with a **zero-floor prompt prefix**.

Composed through a workspace's `packs` array as `tools/local-llm`.

| Contributes | What |
|---|---|
| Skill | [`delegate-local`](skills/delegate-local/SKILL.md) — when and how to route a bounded task or verify-gated loop to a local LLM instead of paying parent-context re-read costs |
| Persona | [`local-worker`](personas/local-worker.md) — a context-firewall worker operating with an omitted host floor (`omitClaudeMd`) and a hard input-byte ceiling |
| Verify | [`runner-rails`](verify/README.md) — offline verification of the runner's loopback-only guard, input-budget rail, and rollback contract (zero network calls) |
| Gate | `local-llm-off-loopback` (`propose`) — marks leaving loopback (`127.0.0.1` / `localhost` / `[::1]`) as a decision requiring explicit approval |

## Why this pack exists

Proposal [`0036`](../../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) budgets what a host loads into every fresh context, and Proposal [`0038`](../../../.portulan/proposals/0038-what-a-change-spends-is-measured.md) prices what a change spends across turns (`m_r × (F·T + g·T²/2)`). Together they expose two structural facts about hybrid local+cloud development:

1. **Parent-context turns are quadratic; surgical local calls are flat and free.** Every tool call in a frontier session re-reads the entire session history. Offloading a 10-file comment cleanup, a test-fixture draft, or a file summary to a local 27B–31B model (`qwen/qwen3.8-27b`, `google/gemma-4-31b`) keeps intermediate turns and raw file reads out of the frontier context window completely.
2. **Local models choke on the host floor (`F`), not on the task.** A cloud subagent inherits a 44k–85k token prefix (`F`) subsidized by provider prompt caching. On local hardware, pre-filling 85k tokens into a 30B model's KV cache takes tens of seconds before the first token appears, whereas a **surgical 1k–4k token prompt** (built using [`cli/symbols.mjs`](../../../cli/symbols.mjs) spans) pre-fills in under two seconds.

## What the runner enforces in code

[`runner/local-llm.mjs`](runner/local-llm.mjs) has **zero npm dependencies** (Node.js `>=20` built-in `fetch` and `node:child_process`) and enforces five rails:

1. **Loopback-only by default.** Only `127.0.0.1`, `localhost`, and `[::1]` are permitted unless `--allow-remote` is explicitly passed.
2. **Zero-floor input budget (`--max-input-bytes`, default `32768`).** Refuses oversized prompts before hitting the local server, directing the caller to scope with [`cli/symbols.mjs`](../../../cli/symbols.mjs) first.
3. **Explicit thinking cap (`--effort low`).** Passes `reasoning_effort: "low"` and `enable_thinking: false` by default so models whose chat templates default to `'xhigh'` thinking do not exhaust `max_tokens` inside `<think>` blocks.
4. **Verify-gated atomic transforms (`transform --file <path> --verify <cmd>`).** Applies the local model's edit, runs the verify command, retries with the compacted error on exit `1`, and **restores the original file byte-for-byte** if the verify command does not reach exit `0`.
5. **Earned role evaluation (`eval`).** Grades any installed local model against Portulan's own [`cli/comments.mjs`](../../../cli/comments.mjs), [`cli/doctor.mjs`](../../../cli/doctor.mjs), and [`cli/skill-goldens.mjs`](../../../cli/skill-goldens.mjs) predicates across `code`, `codify`, and `handoff` tasks before assigning it a role.
