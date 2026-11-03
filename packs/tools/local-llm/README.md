# `tools/local-llm` — Hybrid local-model execution under Portulan's rails

A tool pack for **Hybrid AI Orchestration**, argued in Proposal [`0039`](../../../.portulan/proposals/0039-a-local-model-runs-without-the-host-floor-and-under-a-thinking-cap.md). It lets a frontier orchestrator session offload bounded code transformations, verify-gated red→green retries, research summarization, librarian drafts, and a screen of a curated slot for duplicate files to a local OpenAI-compatible runtime (such as **LM Studio** on `http://127.0.0.1:1234/v1` or **Ollama** on `http://127.0.0.1:11434/v1`) at **zero API token cost** and with a **zero-floor prompt prefix**.

Composed through a workspace's `packs` array as `tools/local-llm`.

| Contributes | What |
|---|---|
| Skill | [`delegate-local`](skills/delegate-local/SKILL.md) — the pass a frontier session follows to hand a bounded edit or digest to the runner; its description names the precondition, a workspace composing this pack and a server answering on loopback |
| Persona | [`local-worker`](personas/local-worker.md) — a context-firewall worker operating with an omitted host floor (`omitClaudeMd`) and a hard input-byte ceiling |
| Verify | [`runner-rails`](verify/README.md) — offline verification of the runner's loopback-only guard, input-budget rail, rollback contract, and `dedup`'s refusals (zero network calls) |
| Gate | `local-llm-off-loopback` (`propose`) — marks leaving loopback (`127.0.0.1` / `localhost` / `[::1]`) as a decision requiring explicit approval |

The skill registers where a plugin manifest declares `skills/`, and this repository's manifests may
declare only the skills of packs its own workspace composes, as its `.portulan/workspace.json` composes
this one.

## Why this pack exists

Proposal [`0036`](../../../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md) budgets what a host loads into every fresh context, and Proposal [`0038`](../../../.portulan/proposals/0038-what-a-change-spends-is-measured.md) prices what a change spends across turns (`m_r × (F·T + g·T²/2)`). Together they expose two structural facts about hybrid local+cloud development:

1. **Parent-context turns are quadratic; surgical local calls are flat and free.** Every tool call in a frontier session re-reads the entire session history. Offloading a 10-file comment cleanup, a test-fixture draft, or a file summary to a local 27B–31B model (`qwen/qwen3.8-27b`, `google/gemma-4-31b`) keeps intermediate turns and raw file reads out of the frontier context window completely.
2. **Local models choke on the host floor (`F`), not on the task.** A cloud subagent inherits a 44k–85k token prefix (`F`) subsidized by provider prompt caching. On local hardware, pre-filling 85k tokens into a 30B model's KV cache takes tens of seconds before the first token appears, whereas a **surgical prompt of a few hundred tokens** (built using [`cli/symbols.mjs`](../../../cli/symbols.mjs) spans) pre-filled in 0.85–1.9 seconds in proposal 0039's measurement.

## What the runner enforces in code

[`runner/local-llm.mjs`](runner/local-llm.mjs) has **zero npm dependencies** (Node.js `>=20` built-in `fetch` and `node:child_process`) and enforces five rails:

1. **Loopback-only by default.** Only `127.0.0.1`, `localhost`, and `[::1]` are permitted unless `--allow-remote` is explicitly passed, and a redirect is refused rather than followed off the machine. A proxy listening on loopback that forwards elsewhere is not visible to it, which is what the `local-llm-off-loopback` gate fragment records.
2. **Zero-floor input budget (`--max-input-bytes`, default `32768`).** Refuses oversized prompts, and for `dedup` any file over the ceiling, before hitting the local server, directing the caller to scope with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines` first. A value that is not a whole number is refused rather than read as no limit.
3. **Explicit thinking cap (`--effort low`).** Passes `reasoning_effort: "low"` and `enable_thinking: false` by default so models whose chat templates default to `'xhigh'` thinking do not exhaust `max_tokens` inside `<think>` blocks.
4. **Verify-gated transforms (`transform --file <path> --verify <cmd>`, `--verify` required).** Applies the local model's edit, runs the verify command, retries with the end of its output on exit `1`, and **restores the original file byte-for-byte** unless the command reaches exit `0`. Any exit other than `0` or `1` — `2`, a missing command, a signal — is no verdict: the file is restored at once and the runner exits `2`. SIGINT, SIGTERM and SIGHUP, whether they arrive during the model call or while the verify command runs, stop the verify, restore the file and exit `2`. **The limits:** this is a rollback, not an atomic write — any other signal that ends the runner (SIGKILL and SIGQUIT among them) or a power loss between the edit and its verdict leaves the edit in place, and since the verify runs in a process group of its own, such a signal leaves the verify running too, even one sent to the runner's whole group. Signal handling is POSIX's: on Windows no SIGTERM arrives, and stopping the verify stops only its shell.
5. **Role screening (`eval`).** Grades an installed local model against Portulan's own [`cli/comments.mjs`](../../../cli/comments.mjs), [`cli/doctor.mjs`](../../../cli/doctor.mjs), and [`cli/skill-goldens.mjs`](../../../cli/skill-goldens.mjs) predicates across `code`, `codify`, and `handoff` tasks. It takes **one sample per task and has no baseline arm**, so it is a screen, not the A/B run `0038` requires before a role is routed; and it needs `cli/` beside `packs/`, as the repository and the npm package carry it, exiting `2` where only `packs/` was installed.

A receipt prints a figure the server did not report as `?`, never as `0`, and `time=` is the model's request time, summed over a transform's attempts like `in=` and `out=`: the runner does not stream, so it cannot see a first token.

## Screening a slot for duplicates

`dedup --dir <slot-dir> [--threshold 0.80] [--model <id>] [--max-input-bytes <per file>]` embeds every file directly in the directory whose name ends in `.md`, in any letter case, sorted by name, in one `POST /v1/embeddings` request to the loopback endpoint, with `text-embedding-nomic-embed-text-v1.5` (`PORTULAN_LOCAL_EMBED_MODEL`) unless `--model` names another; `--role` picks a chat model and is refused here. It prints each pair whose cosine similarity is at or above the threshold, highest first and ties in file-name order, one line each, `0.829 0036-….md 0038-….md`, and two lines on stderr: `dedup files=8 pairs=1 threshold=0.8`, followed by the shared receipt `OK mode=dedup model=… attempts=1 in=…t out=? time=…ms rate=? spend=$0.00`. The ledger reads the receipt as embedding work at $0.00; output tokens and rate are unreported, never zero.

- **A slot's `README.md` is left out**, in any letter case: it describes the slot rather than being one of its entries, and would rank against every entry it summarizes. Subdirectories, symbolic links and other files are left out too.
- **The ceiling is per file**, since the model embeds each input on its own, and it measures the file's text: its size on disk before it is read, and its UTF-8 bytes after. A file over it refuses the run with exit `1`, naming every such file with its size, and nothing is truncated. The request as a whole is not capped: a slot of `n` files sends at most `n` times the ceiling of file text, which JSON escaping can enlarge in the request body, to about six times for control characters. Raise `--max-input-bytes` only as far as the embedding model's context holds.
- **The threshold is a plain decimal from `-1` to `1`**, the range of a cosine; `-1` lists every pair. Anything else is exit `2`, as every malformed argument to the runner is, and never read as the default.
- **Exit `0` is a run, with pairs or with none**, since a candidate pair is for a human to judge, not a red. Exit `1` is a refusal before any request: an endpoint off loopback, or a file over the ceiling. Exit `2` is no server, a redirect, an HTTP error, a response that is not one finite vector of one length per file, or a directory with fewer than two entries to compare. A zero vector scores `0` against everything rather than `NaN`.

A score is a candidate, not a verdict: the runner neither merges nor edits a file.

## Delegating to it

The pass is the [`delegate-local`](skills/delegate-local/SKILL.md) skill: check the server with
`status`, scope the input with [`cli/symbols.mjs`](../../../cli/symbols.mjs) and `--lines`, choose the
model by task shape, gate every edit with `--verify`, and read only the receipt back.
