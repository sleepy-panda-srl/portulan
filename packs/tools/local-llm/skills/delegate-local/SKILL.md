---
name: delegate-local
description: Offload verify-gated code edits for hybrid development. Requires loopback; compose tools/local-llm or explicitly request a one-off under the same rails.
---

# Skill — Delegate Local

> Use the [loopback runner](../../runner/local-llm.mjs) for bounded work under verification.
> A separately issued call remains a parent request; see the [spend limits](../../README.md#when-a-call-pays).

## Before you start

Resolve `<runner>` through [adoption and upgrades](../../README.md#adopting-it-in-a-workspace).
Without composition, propose it first; an explicit operator instruction permits a one-off
runner invocation under the same rails, without composing the workspace.

Use a loopback server: LM Studio defaults to `127.0.0.1:1234`; `--base-url` or
`PORTULAN_LOCAL_LLM_URL` can select another local port. Run `node <runner> status`:
`0` lists models, `1` refuses off loopback, `2` is could-not-run. Otherwise use the
parent. `--allow-remote` requires the explicit `local-llm-off-loopback` decision.

## When to use it

- **A verify-gated file transform longer than one short parent Edit:** a mechanical refactor or a
  history-comment cleanup across a file, or a unit test the parent would otherwise iterate red→green,
  where a verify command can prove the edit green or have it rolled back.
- **Operator-selected candidate digests or librarian/handoff drafts:** use an explicit
  `--model` without `--role`; normally keep these in the parent.

Not for multi-file architectural planning, ambiguous requirements (`clarify`), or pre-merge verdicts
(`reviewer`).

## When it pays

Keep a one-short-Edit task in the parent. A separately issued call costs a parent
request; batched invocations share a request boundary. The [cost model and measured
limits](../../README.md#when-a-call-pays) explain why local tokens alone prove no savings.

## Sizing and wording a call

For an uncalibrated shape, use **about 20 generated new lines** as an initial scope
ceiling at `qwen/qwen3.8-27b`, low effort, **4,096 requested combined output tokens**.
This is a [historically informed heuristic](../../evidence/sizing/history.md#low-effort-4096-tokens--november-5),
not a current maximum, guarantee or runner line cap. The [current receipts](../../evidence/sizing/report.md)
include a 61-line fixture pass and an 11-line failure; size alone establishes neither
completion nor correctness. Input slices and the 32-KB input ceiling are different figures.

- **Number the steps:** first-call successes were reported for numbered specs.
- **State enforced style and supply already-wrapped examples:** brace-less C# `if`s
  required another generation, then five calls with the brace rule passed first time;
  rewrapping cost `out=3160t` versus `496t` for an already-wrapped example.
- **Use literal syntax, exact APIs and input/output fixtures:** shorthand
  `for x in y: stmt` was copied. In the current pilot, an assumed object shape failed
  despite full helper signatures. See the [dated wording cases](../../evidence/sizing/history.md#wording-cases)
  and the separately reported diagnostic; these are observations, not causal proofs.
- **Use the smallest adequate behavioral verifier plus required style/build checks.**
  Historical one-line calls took 4–8 s with a single-test verifier; keep such edits in
  the parent. Syntax or a green but incomplete fixture corpus is not semantic proof.
- **Bound a sizing attempt to two generations** (`--retries 1`; the runner defaults
  to three). Count attempts across calls and return that kind of edit to the parent
  after two failed generations; do not reset the count with an identical call.
  The acquisition pilot used one generation per cell, and its diagnostic is separate.
- **Code includes source-bound documentation comments with explicit syntax/style
  checks and parent fidelity review.** Reported C# comments do not qualify general prose.
  Preserve operator-pinned profiles; a smaller input or larger output request is no
  thinking/completion guarantee. Keep unsupported prose in the parent.

## The pass

1. **Scope the input first.** Outline files of 300 lines or more with
   `node <plugin root>/cli/symbols.mjs <file>`, then use `--file <file> --lines <start>-<end>`
   for `transform`, `chat` or `summarize`. Packs-only installs lack `cli/`; use a bounded
   declaration search there. Add read-only signatures/fixtures with repeatable
   `--context <a>-<b>` or `--context-file <path>[:a-b]`. The 32-KB input cap is not a
   latency measurement; see [prefill evidence](../../README.md#why-this-pack-exists).
2. **Use an earned role.** Code transforms and strict syntax use `--role code`
   (`qwen/qwen3.8-27b`) at `--effort low`, supported by the
   [captured A/B](../../../../../evals/ab/local-worker.md)'s L5/H5 code cell. Shared `--role prose`
   (`google/gemma-4-31b`) is disabled: codify scored L0/H3, despite handoff's L5/H5. Keep digests and
   librarian drafts in the parent session. `summarize` defaults to prose and refuses; explicit roles,
   model overrides and environment mismatches cannot bypass the guard. An operator can select a
   candidate with `--model <id>` and no `--role`; that is deliberate evaluation, not earned routing.
   `eval --model <id>` is a screen, never routing qualification; its [requirements](../../README.md#the-ab-record) still apply.
3. **Gate every edit.** `node <runner> transform --file <path> --retries 1 --verify "<cmd>" --prompt-file p.txt`
   (or `--prompt "<instruction>"`), where `--verify` is required; to add a test or a function without
   re-emitting anchor code, use `--insert-after <line>` (with optional `--context <a>-<b>`), e.g.
   `--insert-after 120 --context 10-40 --prompt-file spec.txt`. For `--precheck` on each candidate,
   `--preflight` on the untouched baseline and `--verify-expect`, follow
   [choosing checks](../../README.md#choosing-checks). The runner applies the edit, runs `<cmd>`, retries with the end of its
   output on exit `1`, and keeps the edit only on exit `0`; any other exit, and SIGINT, SIGTERM or
   SIGHUP, restores the file byte for byte. It is a rollback, not an atomic write: any other signal that
   ends the runner, SIGKILL and SIGQUIT among them, or a power loss between the edit and its verdict
   leaves the edit in place.
   Calls can take minutes: use `--progress` and wait for exit if backgrounded.
   See [generation controls and diagnostics](../../README.md#generation-controls-and-diagnostics).
4. **Read the receipt and retry tails.** On exit `0`, read the receipt and stderr's failure tails
   when `attempts>1`. Review semantic/style obligations the verifier does not establish, especially for
   a new shape; avoid rereading already-understood source otherwise. On exit `1` or `2`,
   return to the frontier implementer.
