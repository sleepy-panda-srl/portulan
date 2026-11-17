# Current sizing observations — November 18, 2026

The frozen [protocol](README.md) ran on November 18 in Europe/Bucharest; timestamps
in [capture.json](capture.json) are UTC: `2026-11-17T22:17:01.208Z` to `2026-11-17T22:18:41.913Z`.
Six predeclared cells each received one generation, in fixed order. Raw requests,
responses and stderr remain private; the capture includes reviewed synthetic source,
compact receipts and hashes. These source artifacts are audit data, not recommended
implementations.

## Profile and custody

- Requested `qwen/qwen3.8-27b`, earned `code`, low effort, 4,096 combined output tokens,
  `chat_template_kwargs.enable_thinking: false`, `--retries 0`. All requests used
  temperature 0.1 and no sampling seed. No profile or budget changed between cells.
- The endpoint reported 8-bit quantization and model metadata recorded in the capture.
  Hardware: Apple M5 Max, 137,438,953,472 memory bytes,
  darwin/arm64, Node v26.13.1.
  Model identity/weights and active template bytes were not independently attested.
- Parent source commit: `a2f70a67bc721054c66c3993618a03788e24674e`. Runner, acquisition, corpus and protocol
  notes hashes were written before the first call and stayed fixed. The preregistered
  public artifacts are [fixtures.json](fixtures.json), [acquire.mjs](acquire.mjs) and
  [README.md](README.md); their hashes are in the capture.
- Instrumentation records the buffered response while using the production transport
  and an explicit production endpoint lock around each whole child command. All
  completed manual lock waits were zero. Native CLI queue telemetry is not claimed.
  Receipt time includes request/response and small recording overhead, excludes the
  manual wait, and is not first-token latency or pure model compute time.
- Offline controls accepted intended implementations and rejected baselines, wrong
  implementations and ten insertion mutants. The exact test count, every required
  call/assertion tuple, real tests and a wrong-helper negative control were checked.

## Fixed six-cell results

**Five of six passed the declared fixture verifier.** This is an observed tally for
six different synthetic tasks, not a completion-rate estimate. The larger helper
artifact was subsequently rejected by parent review, and the large replacement
missed an unenforced style instruction, as detailed below. No length exhaustion
or cancellation occurred in this acquisition.

Physical line counts include interior blanks and exclude one terminal newline.
Selected target lines, insertion anchors, read-only helper lines, returned code and
actual source additions/removals are separate. Historical reports did not declare
this counting convention and cannot be pooled with these figures.

| Cell | Selected / anchor lines | Helper lines | Requested new lines | Returned code lines | Added / removed | Runner outcome |
|---|---:|---:|---:|---:|---:|---|
| `replace-small` | 1 / 0 | 0 | 15 | 21 | 21 / 1 | verified |
| `replace-large` | 1 / 0 | 0 | 35 | 61 | 61 / 1 | verified |
| `insert-small` | 0 / 3 | 16 | 15 | 12 | 12 / 0 | verified |
| `insert-large` | 0 / 3 | 16 | 35 | 28 | 28 / 0 | verified |
| `context-small` | 1 / 0 | 16 | 15 | 11 | 0 / 0 | verifier-red |
| `context-large` | 1 / 0 | 16 | 35 | 42 | 42 / 1 | verified |

Reasoning and cached input are subsets of output and input respectively; they are
never added to those parents. `?` means unreported, not zero. The verifier-red call
has known usage and CLI wall time but no successful receipt's model-request time.

| Cell | Input / output tokens | Reasoning / cached | CLI wall / receipt ms | Lifecycle request ID |
|---|---:|---:|---:|---|
| `replace-small` | 189 / 188 | 0 / ? | 18,827 / 18,318 | `0b5c1bfe-5b15-479b-b7a4-bc5c316fd5f6` |
| `replace-large` | 250 / 382 | 0 / ? | 22,779 / 22,269 | `2d28110a-4db9-4d5c-b6b9-e7069870b61c` |
| `insert-small` | 532 / 153 | 0 / ? | 10,279 / 9,454 | `f521ca4a-9ec0-4ea4-b622-02b1ec0e5922` |
| `insert-large` | 661 / 362 | 0 / ? | 22,392 / 21,562 | `d1502118-ffe0-4ce2-8b22-ec16f013de0f` |
| `context-small` | 431 / 102 | 0 / ? | 6,927 / ? | `d878c785-fdb2-4dab-9d0f-ecb3e0a0de9e` |
| `context-large` | 497 / 318 | 0 / ? | 19,427 / 18,915 | `fd0a7d9a-9d1f-4210-aa09-8e08bd71b271` |

## Parent review and diagnostic

`context-small` returned 11 lines and reported 102 output/zero reasoning tokens,
but assumed `item.price` instead of numeric items. Verification failed and the
original target was restored byte-for-byte. Complete helper signatures alone did
not establish the correct input shape in this observation.

The [separately preregistered diagnostic](diagnostic-protocol.md) added only read-only
`examples.json` with the eight original input/output/error fixtures. Prompt, target,
verifier and profile stayed unchanged; [diagnostic-fixtures.json](diagnostic-fixtures.json)
and [diagnostic-capture.json](diagnostic-capture.json) bind the new corpus and notes
while retaining byte-identical runner/acquisition hashes.

That **one** diagnostic passed: 869 input / 102 output,
0 reported reasoning, cached input unreported,
11 returned/added source lines, 7,313 ms CLI wall /
6,814 ms receipt time; request `8397f668-1ee3-476b-9287-96586ede88bd`. No further generation
followed. It is not pooled into a seven-call rate. Runtime state, task order and
stochastic output confound a causal claim about the added examples.

The original `context-large` passed its six behavioral fixtures but used an ordinary
object for arbitrary account names. Post-hoc checks of `__proto__`, `constructor`
and `toString` exposed missing accounts or `USD NaN` balances. **The parent rejected
that artifact.** [parent-assessment.json](parent-assessment.json) retains the exact
inputs, expected/actual results and capture hash; these were not preregistered cases
and do not rewrite the original tally. `replace-large` also omitted the requested
braced switch-case style; the verifier checked behavior/syntax, not that instruction.
Fixture-green therefore does not establish full intent or style conformance.

## Guidance and limits

For an uncalibrated shape, about 20 generated new lines is a conservative initial
scope ceiling informed by the [reported history](history.md), not a current maximum,
guarantee or enforced line cap. This pilot's largest fixture-green replacement was
61 wrapped lines under the requested 4,096-token budget; an 11-line one failed.
It identified no capacity ceiling, and line count alone predicts neither correctness
nor completion. Only expand a scope against evidence for that actual shape/profile.

Use numbered instructions, literal syntax, enforced style and already-wrapped
examples; their reported cases are in the history. Include exact APIs **and** input/
output/error fixtures, and keep project-required semantic/style checks. The parent
must review obligations its verifier does not establish, particularly for a new
shape. A small input, budget increase or suppressed thinking request is no guarantee.

Use a bounded sizing attempt: `--retries 1` permits at most two generations, while
omitting it leaves the unchanged runner default of three. Count attempts across
calls and return the implementation to the parent after the budget is exhausted.
The diagnostic above was a separately reviewed investigation after the fixed pilot,
not a continuation of normal implementation delegation or a reset of its stopping rule.

These observations establish no general success rate, causal size/wording effect,
Gemma qualification, active-template/weight attestation, binding thinking cap,
first-token timing or net parent savings. The shared routing table is unchanged.
