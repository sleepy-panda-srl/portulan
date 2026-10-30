# `runner-rails` — what it checks, and what it cannot

One recipe: `node ${PACK_ROOT}/runner/local-llm.mjs --verify-offline`, run from the adopting repository's root.

## The three exits

| Exit | Means |
|---|---|
| `0` | all offline runner rails hold: non-loopback URLs are refused without `--allow-remote`, oversized inputs above `--max-input-bytes` are refused before network I/O, a verify command ending in any exit but `0` or `1` is could-not-run with the file restored, a green verify command keeps the edit with a one-line receipt, and transform rollback restores original file bytes on a red verify command |
| `1` | at least one runner rail failed to fire (a forced-red check passed when it should have been refused, rollback left modified bytes behind, or a green verify did not keep its edit with a one-line receipt) |
| `2` | **could not run** — [`runner/local-llm.mjs`](../runner/local-llm.mjs) or the Node.js runtime could not be executed |

## Why `--verify-offline` makes no network or loopback call

A verify recipe in Portulan may never make a network call, and a local LLM server (`localhost:1234`) is
machine-specific state that is absent in CI. `--verify-offline` exercises the runner's guards against
in-process synthetic fixtures and three temporary-file transform drills (red, no verdict, green), proving the rails hold without
touching a socket. Live model health checks and role grading use `status` or `eval` outside recipes.
