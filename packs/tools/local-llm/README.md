# `tools/local-llm` — Hybrid local-model execution under Portulan's rails

A tool pack for **Hybrid AI Orchestration**, argued in Proposal [`0039`](../../../.portulan/proposals/0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md). It lets a frontier orchestrator session offload bounded code transformations, verify-gated red→green retries, research summarization, and librarian drafts to a local OpenAI-compatible runtime (such as **LM Studio** on `http://127.0.0.1:1234/v1` or **Ollama** on `http://127.0.0.1:11434/v1`) at **zero API token cost** and with a **zero-floor prompt prefix**.

Composed through a workspace's `packs` array as `tools/local-llm`.

| Contributes | What |
|---|---|
| Persona | [`local-worker`](personas/local-worker.md) — a context-firewall worker operating with an omitted host floor (`omitClaudeMd`) and a hard input-byte ceiling |
| Verify | [`runner-rails`](verify/README.md) — offline verification of the runner's loopback-only guard, input-budget rail, and rollback contract (zero network calls) |
| Gate | `local-llm-off-loopback` (`propose`) — marks leaving loopback (`127.0.0.1` / `localhost` / `[::1]`) as a decision requiring explicit approval |

**No skill ships yet.** A pack's skill registers only where a plugin manifest declares it, and this
repository's manifest may declare only the skills of packs its own workspace composes; composing this
one, and the `delegate-local` skill with it, is
[#542](https://github.com/sleepy-panda-srl/portulan/issues/542). Until then the pass a skill would
carry is [*Delegating to it*](#delegating-to-it) below.

## Why this pack exists

Proposal [`0036`](../../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) budgets what a host loads into every fresh context, and Proposal [`0038`](../../../.portulan/proposals/0038-what-a-change-spends-is-measured.md) prices what a change spends across turns (`m_r × (F·T + g·T²/2)`). Together they expose two structural facts about hybrid local+cloud development:

1. **Parent-context turns are quadratic; surgical local calls are flat and free.** Every tool call in a frontier session re-reads the entire session history. Offloading a 10-file comment cleanup, a test-fixture draft, or a file summary to a local 27B–31B model (`qwen/qwen3.8-27b`, `google/gemma-4-31b`) keeps intermediate turns and raw file reads out of the frontier context window completely.
2. **Local models choke on the host floor (`F`), not on the task.** A cloud subagent inherits a 44k–85k token prefix (`F`) subsidized by provider prompt caching. On local hardware, pre-filling 85k tokens into a 30B model's KV cache takes tens of seconds before the first token appears, whereas a **surgical prompt of a few hundred tokens** (built using [`cli/symbols.mjs`](../../../cli/symbols.mjs) spans) pre-filled in 0.85–1.9 seconds in proposal 0039's measurement.

## What the runner enforces in code

[`runner/local-llm.mjs`](runner/local-llm.mjs) has **zero npm dependencies** (Node.js `>=20` built-in `fetch` and `node:child_process`) and enforces five rails:

1. **Loopback-only by default.** Only `127.0.0.1`, `localhost`, and `[::1]` are permitted unless `--allow-remote` is explicitly passed, and a redirect is refused rather than followed off the machine. A proxy listening on loopback that forwards elsewhere is not visible to it, which is what the `local-llm-off-loopback` gate fragment records.
2. **Zero-floor input budget (`--max-input-bytes`, default `32768`).** Refuses oversized prompts before hitting the local server, directing the caller to scope with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines` first. A value that is not a whole number is refused rather than read as no limit.
3. **Explicit thinking cap (`--effort low`).** Passes `reasoning_effort: "low"` and `enable_thinking: false` by default so models whose chat templates default to `'xhigh'` thinking do not exhaust `max_tokens` inside `<think>` blocks.
4. **Verify-gated transforms (`transform --file <path> --verify <cmd>`, `--verify` required).** Applies the local model's edit, runs the verify command, retries with the end of its output on exit `1`, and **restores the original file byte-for-byte** unless the command reaches exit `0`. Any exit other than `0` or `1` — `2`, a missing command, a signal — is no verdict: the file is restored at once and the runner exits `2`. SIGINT, SIGTERM and SIGHUP, whether they arrive during the model call or while the verify command runs, stop the verify, restore the file and exit `2`. **The limits:** this is a rollback, not an atomic write — a SIGKILL or a power loss between the edit and its verdict leaves the edit in place, and since the verify runs in a process group of its own, a SIGKILL to the runner's group leaves the verify running too. Signal handling is POSIX's: on Windows no SIGTERM arrives, and stopping the verify stops only its shell.
5. **Role screening (`eval`).** Grades an installed local model against Portulan's own [`cli/comments.mjs`](../../../cli/comments.mjs), [`cli/doctor.mjs`](../../../cli/doctor.mjs), and [`cli/skill-goldens.mjs`](../../../cli/skill-goldens.mjs) predicates across `code`, `codify`, and `handoff` tasks. It takes **one sample per task and has no baseline arm**, so it is a screen, not the A/B run `0038` requires before a role is routed; and it needs `cli/` beside `packs/`, as the repository and the npm package carry it, exiting `2` where only `packs/` was installed.

A receipt prints a figure the server did not report as `?`, never as `0`, and `time=` is the model's request time, summed over a transform's attempts like `in=` and `out=`: the runner does not stream, so it cannot see a first token.

## Delegating to it

1. **Scope the input first.** Outline a file of 300 lines or more with `node <plugin root>/cli/symbols.mjs <file>` and pass `--lines <start>-<end>` (to `transform`, `chat` and `summarize` alike) rather than the whole file. Prefill scales with prompt bytes: proposal 0039 measured prompts of about 400–470 tokens prefilling in 0.85–1.9 s, and the `32 KB` default (about 8k tokens) is a ceiling, not a measured latency.
2. **Choose the model by task shape.** Code transforms and strict syntax: `--role code` (`qwen/qwen3.8-27b`). Prose compression, `codify` drafts and digests: `--role prose` (`google/gemma-4-31b`). Screen a newly installed model with `node <plugin root>/packs/tools/local-llm/runner/local-llm.mjs eval --model <id>` first.
3. **Gate every edit.** `transform --file <path> --verify "<cmd>" --prompt "<instruction>"`; the runner keeps the edit only on the command's exit `0`.
4. **Read only the receipt back.** On exit `0`, take the one-line receipt and do not re-read the file unless a later edit depends on its new line numbers. On exit `1` or `2`, escalate to the frontier implementer rather than looping locally again.

Not for multi-file architectural planning, ambiguous requirements (`clarify`), or pre-merge verdicts (`reviewer`).
