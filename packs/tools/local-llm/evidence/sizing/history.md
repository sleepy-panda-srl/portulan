# Reported sizing and wording evidence

These are dated reports, not a new acquisition or a controlled comparison. Raw
historical transcripts were not retrieved for this change. The fresh pilot has a
separate protocol and capture; do not pool profiles or turn selected input lines
into generated output lines.

## Low effort, 4,096 tokens — November 5

The [original report](https://github.com/sleepy-panda-srl/portulan/issues/578)
names `qwen/qwen3.8-27b`, `--role code --effort low`, Portulan 0.3.0 (`6b94c50`),
and the shipped 4,096-token output budget. It reports five exhausted calls after
4–8 minutes: four requesting roughly 30–35 new lines and one 22-line C# xUnit
theory. C# bodies of 15–25 lines passed. A roughly 35-line method passed a changed
retry in 100 seconds with `out=1279t`; that retry changed both the skeleton and
`/no_think`, so neither change has an isolated effect. Per-call raw IDs/receipts
are unavailable in the issue body.

These observations informed the conservative ~20-generated-line starting scope.
The 22-line failure and larger success show why this is neither a measured maximum
nor a guarantee, and the reports predate the November 17 runtime repair below.

## Wording cases

The same [reported cases](https://github.com/sleepy-panda-srl/portulan/issues/578)
support these practical instructions, without establishing causality:

| Instruction | Reported case |
|---|---|
| Use numbered steps. | Numbered specifications reportedly landed on their first call. |
| State enforced style rules before generation. | Brace-less C# `if`s required another generation; the next five calls with the brace rule stated passed first time. |
| Supply an already-wrapped example. | Rewrapping cost `out=3160t`, versus `496t` with the layout already supplied. Output counts do not establish latency or parent savings. |
| Give literal syntax rather than shorthand. | `for x in y: stmt` was copied literally. |
| Keep verification fast and behaviorally adequate. | One-line edits with a single-test verifier took 4–8 seconds; that is not a reason to omit required behavior/style checks or evidence of net savings. |
| Keep code and prose qualification separate. | Syntax-gated C# documentation comments reportedly worked as code; general prose stayed with the parent. |

## Owner-pinned xhigh, thinking enabled, 8,192 tokens

The [November 5 comment](https://github.com/sleepy-panda-srl/portulan/issues/578#issuecomment-6668164711)
explicitly identifies Qwen at **xhigh**, thinking enabled and an **8,192-token
combined output budget**. These are not failures of the shared low-effort setting.

| Task | Selected input lines | Input / output tokens | Reasoning subset | Wall ms | Reported result |
|---|---:|---:|---:|---:|---|
| Cancellation test | 13 | 435 / 8,191 | 8,191 | 480,668 | Length; file unchanged |
| Request-gate test | 9 | 308 / 8,191 | 8,191 | 681,384 | Length; file unchanged |
| Delegation guidance | 10 | 388 / 1,867 | 1,640 | 115,266 | Stop; verified/adopted |
| Existing-regexp edit | 2 | 244 / 383 | 305 | 27,221 | Stop; verifier green |

The [November 6 report](https://github.com/sleepy-panda-srl/portulan/issues/578#issuecomment-6695966000)
adds an 18-input-line read-only draft at the same xhigh/thinking/8,192 profile:
receipt `66b67ced-5e5f-47bd-95d5-8dc3ce24c4c7`, 411 input / 8,191 output,
8,191 reported reasoning, 558,803 ms, length, no accepted draft. Cached-input
usage was unreported. Small input did not prevent generation exhaustion; none
of these input counts measures the requested or emitted new source lines.

## Later repairs and limits

The [November 7 follow-up](https://github.com/sleepy-panda-srl/portulan/issues/578#issuecomment-6697845854)
reports a source-checked owner summary completing at medium in 19,447 ms,
278 input / 330 output, including 200 reasoning tokens. A changed draft exceeded
its word limit and a live xhigh code candidate timed out with unknown usage.
Medium alone did not establish success, a native thinking cap did not bind, and
client timeout did not prove server cancellation. These owner decisions do not
change the shared pack's earned routing.

The [November 17 maintainer closeout](https://github.com/sleepy-panda-srl/portulan/issues/571#issuecomment-6945668358)
reports repaired low/no-thinking model templates/configuration and small live
Qwen code receipts with reported reasoning zero. It also changes the meaning of
`/no_think` on that runtime. The fresh pilot therefore records its current source,
requested profile and returned usage separately. It neither replays the old runtime
nor identifies a universal ceiling, causal diagnosis, Gemma qualification or net
parent savings.
