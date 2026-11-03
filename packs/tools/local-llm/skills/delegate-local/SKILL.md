---
name: delegate-local
description: Offload a verify-gated one-file edit, a file digest or a draft to a local model. Use only where the workspace composes tools/local-llm and a server answers on loopback.
---

# Skill — Delegate Local

> Every turn in a frontier session re-reads its whole context (`m_r × (F·T + g·T²/2)`, proposal
> [`0038`](../../../../../.portulan/proposals/0038-what-a-change-spends-is-measured.md)). This skill moves a
> bounded, high-turn or read-heavy sub-task off that context and onto a local model on loopback, through
> [`runner/local-llm.mjs`](../../runner/local-llm.mjs) and under a verify command.

## Before you start

`<runner>` below is `runner/local-llm.mjs` in this pack's directory, two levels above this file:
`<plugin root>/packs/tools/local-llm/runner/local-llm.mjs` where the plugin is the repository root, and
`<plugin root>/tools/local-llm/runner/local-llm.mjs` where it is the `packs/` payload.

The runner talks to an OpenAI-compatible server on loopback: LM Studio on `127.0.0.1:1234` by default,
or `--base-url` (or `PORTULAN_LOCAL_LLM_URL`) for another loopback port such as Ollama's `11434`. Run
`node <runner> status` first. Exit `0` lists the models the server holds; exit `1` is an endpoint
refused as off loopback; exit `2` is could-not-run — no server answered, it answered with an HTTP
error, or `--base-url` is not a URL. On anything but `0`, do the work in the parent session. Never pass
`--allow-remote` on your own authority: an endpoint off loopback is the `local-llm-off-loopback`
decision, proposed before it runs.

## When to use it

- **A verify-gated file transform:** a mechanical refactor, a history-comment cleanup, or a unit test
  added, where a verify command can prove the edit green or have it rolled back.
- **A research digest:** reading a long file or log so only a short digest enters the parent context.
- **A librarian or handoff draft:** compressing a handoff under its byte cap, or drafting a `codify` or
  `consolidate` candidate for human review.

Not for multi-file architectural planning, ambiguous requirements (`clarify`), or pre-merge verdicts
(`reviewer`).

## The pass

1. **Scope the input first.** Outline a file of 300 lines or more with
   `node <plugin root>/cli/symbols.mjs <file>` and pass `--file <file> --lines <start>-<end>` (to
   `transform`, `chat` and `summarize` alike) rather than the whole file. `cli/` ships with the
   repository-root plugin and not in the `packs/` payload; there, find the span's line numbers with
   `grep -n`. Prefill scales with prompt bytes: proposal 0039 measured prompts of about 400–470 tokens
   prefilling in 0.85–1.88 s, and the `32 KB` default of `--max-input-bytes` (about 8k tokens) is a
   ceiling, not a measured latency.
2. **Choose the model by task shape.** Code transforms and strict syntax: `--role code`
   (`qwen/qwen3.8-27b`). Prose compression, `codify` drafts and digests: `--role prose`
   (`google/gemma-4-31b`). This routing rests on proposal 0039's one-sample figures until its A/B record
   lands ([#547](https://github.com/sleepy-panda-srl/portulan/issues/547)). Screen a newly installed model
   with `node <runner> eval --model <id>` first; `eval` grades with `cli/`'s predicates, so it too needs
   the repository-root plugin, and exits `2` without it.
3. **Gate every edit.** `node <runner> transform --file <path> --verify "<cmd>" --prompt "<instruction>"`,
   where `--verify` is required. The runner applies the edit, runs `<cmd>`, retries with the end of its
   output on exit `1`, and keeps the edit only on exit `0`; any other exit, and SIGINT, SIGTERM or
   SIGHUP, restores the file byte for byte. It is a rollback, not an atomic write: any other signal that
   ends the runner, SIGKILL and SIGQUIT among them, or a power loss between the edit and its verdict
   leaves the edit in place.
4. **Read only the receipt back.** On exit `0`, take the one-line receipt and do not re-read the file
   unless a later edit depends on its new line numbers. On exit `1` or `2`, escalate to the frontier
   implementer rather than looping locally again.
