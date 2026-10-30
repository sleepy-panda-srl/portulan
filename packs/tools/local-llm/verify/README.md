# `runner-rails` — what it checks, and what it cannot

One recipe: `node ${PACK_ROOT}/runner/local-llm.mjs --verify-offline`, run from the adopting repository's root.

## The three exits

| Exit | Means |
|---|---|
| `0` | all offline runner rails hold: non-loopback URLs are refused without `--allow-remote`, oversized inputs above `--max-input-bytes` are refused before network I/O, compacted pass receipts stay at one line, and atomic transform rollback restores original file bytes on a red verify command |
| `1` | at least one runner rail failed to fire (a forced-red check passed when it should have been refused, or rollback left modified bytes behind) |
| `2` | **could not run** — [`runner/local-llm.mjs`](../runner/local-llm.mjs) or the Node.js runtime could not be executed |

## Why `--verify-offline` makes no network or loopback call

A verify recipe in Portulan may never make a network call, and a local LLM server (`localhost:1234`) is
machine-specific state that is absent in CI. `--verify-offline` exercises the runner's guards against
in-process synthetic fixtures and a temporary file rollback drill, proving the rails hold without
touching a socket. Live model health checks and role grading use `status` or `eval` outside recipes.
