# Original-span comparison — November 18, 2026

This supplies the paired receipts requested by [#571, acceptance clause 2](https://github.com/sleepy-panda-srl/portulan/issues/571).
The [frozen protocol](README.md), [capture](capture.json) and [custody counters](custody.json)
record a rerun of the original 19-line Python span, with and without `/no_think`.
It ran on November 18 in Europe/Bucharest; UTC timestamps are
`2026-11-18T00:14:02.876Z` to `2026-11-18T00:14:48.615Z`.

## Source custody and task

An original provider log yielded the exact historical call: response
`chatcmpl-dv92cd7s9khrx194qlrze`, 570 input / 1,876 output tokens, including
1,555 reported reasoning tokens. Independently resolved immutable consumer Git
history supplied its 19-line selection. Applying the response's described edits
produces the retained historical replacement byte-for-byte: three inserted physical
lines and two modified existing lines. The original-span SHA-256 is
`a08b7e83e218ad314c7dbe966920e518f530c014f598298bbeada72d8577094a`; raw source, repository paths, request/response and
provider reasoning remain private. Public hashes and counters support the signed
independent custody review without exposing consumer code.

The historical instruction was truncated in the request log. The current task
instruction is explicitly reconstructed from its described changes and verified
source; its hash is frozen. This reruns the **original span**, with a reconstructed
instruction and current wrapper/verifier, rather than recreating the original
prompt bytes, complete consumer integration or old runtime. No acceptance clause
was replaced with a synthetic task.

## Profile, controls and observations

Both arms use Qwen `qwen/qwen3.8-27b`, earned `code`, low effort,
`enable_thinking: false`, 4,096 combined output tokens, temperature 0.1, no seed,
`--retries 0`, and identical original target bytes. The order was frozen without
soft switch first, then with it. The added text occurs after the runner's
`Instruction: ` prefix. Removing only `/no_think` and its newline makes the complete
actual request bodies byte-equivalent after JSON serialization; the shared
normalized SHA-256 is `dc973a425590063ec34ba3c24f52a8c8ca9b1afd5c7874c3426cd10c33004eed`.

Preregistration preceded inference. Runner, private acquisition/verifier, source,
reconstructed instruction, expected result and public protocol hashes stayed fixed.
Offline controls passed intended code and rejected baseline plus eight wrong
candidates, including removal of the existing timeout guard. Both live artifacts
passed syntax, the expected AST, outside-byte/line-width checks and eleven mocked
behavior cases. Both selected replacements also byte-match the historical expected
replacement. These are finite checks; no real deployment service was contacted.

The table distinguishes whole-child wall time from receipt request time; selected
input is 19 lines in each arm. Physical line counts exclude one terminal newline
and include interior blanks. Reasoning/cached input are subsets of output/input,
counted once. `?` means unreported. Source additions/removals are recomputed with
`git diff --no-index --numstat`; their net increase is three lines.

| Arm | Input / output tokens | Reasoning / cached | Wall / receipt ms | Emitted / kept span lines | Source added / removed | Outcome |
|---|---:|---:|---:|---:|---:|---|
| `without-soft-switch` | 525 / 320 | 0 / ? | 26,660 / 26,468 | 22 / 22 | 5 / 2 | verified |
| `with-soft-switch` | 526 / 320 | 0 / ? | 19,077 / 18,881 | 22 / 22 | 5 / 2 | verified |

Each arm used one generation and ended `stop`; no exhaustion, refusal, verifier-red
or cancellation occurred. The private acquisition held the production endpoint
lock through each command; manual queue waits were zero. Native CLI queue telemetry
is not inferred from that wait. Receipt request time excludes that wait and includes
small recording overhead, and is neither pure compute nor first-token latency.
`preflight=red` in each successful receipt means the baseline failed before
inference, as intended; full post-transform verification then passed.

## Literal receipts

`without-soft-switch`:

```text
OK mode=transform model=qwen/qwen3.8-27b target=target.py attempts=1 in=525t out=320t time=26468ms rate=12.1tok/s reasoning=0t cached-in=? preflight=red max-tokens=4096 spend=$0.00
```

`with-soft-switch`:

```text
OK mode=transform model=qwen/qwen3.8-27b target=target.py attempts=1 in=526t out=320t time=18881ms rate=16.9tok/s reasoning=0t cached-in=? preflight=red max-tokens=4096 spend=$0.00
```

Lifecycle IDs: `d1261c13-10c0-4de8-93d8-38b16f539f50` and
`56d14ab4-a4e7-4eb2-8c41-4e832a0e9cee`. Provider response IDs and raw-byte hashes are in the
capture. The program made no additional adaptive generations.

## Limits

The current pair reports zero reasoning in both arms. It does not isolate a causal
soft-switch or runtime-repair effect: the template/runtime changed since November 5,
order and runtime/cache state were not randomized, and sampling had no seed. The
[November 17 repair](https://github.com/sleepy-panda-srl/portulan/issues/571#issuecomment-6945668358)
is the maintainer's account of those changes. Its different successful calls and
this matched current pair remain distinct evidence.

Hardware/runtime: Apple M5 Max, 137,438,953,472 memory bytes,
darwin/arm64, Node v26.13.1,
Python 3.15.2. The model API metadata hash is retained; weights and active
template bytes are not independently attested. No general model reliability,
capacity, hard reasoning cap, provider cancellation or net parent savings is
established. README rail 3 continues to state the backend-dependent boundary.
