# Sizing pilot protocol

This finite observational pilot serves [#578](https://github.com/sleepy-panda-srl/portulan/issues/578).
It is not a routing qualification or a controlled estimate of size/wording effects.
The six cells in `fixtures.json` are fixed before inference: replacement, test
insertion and complete-helper-context tasks, each with a small (~15 generated lines)
and larger (~35) requested scope. Behavior and mode also vary; size is not isolated.

Profile: `qwen/qwen3.8-27b`, earned `code`, low effort, `enable_thinking: false`,
4,096 combined output tokens, `--retries 0`, serial loopback calls in declared order.
Each cell has exactly one generation opportunity. A 180-second whole-call bound
includes queue/loading, generation and verification. Cancellation is censored,
unreported usage stays unknown, and provider cancellation is never inferred.
Cancellation or unavailable transport/routing stops the remaining cells; completed
length/refusal or red verification is recorded without adaptive retry/profile changes.
Two failed single-generation calls exhaust that task shape.

`acquire.mjs --self-check` uses no model: every baseline must fail, every intended
implementation pass, and every incorrect/vacuous implementation fail. Insertion
checks require the exact executed test count and rejection of a wrong helper;
they also require two declared call/assertion tuples per test, checked with bounded
VM instrumentation before real execution. Partial tautologies, duplicate/missing
tuples, wrong expected values and constant actuals are negative controls. The VM
checks this fixture contract; it is not a security boundary. Other cells
exercise at least five behavioral cases, including boundaries and exceptions.
Syntax checks supplement behavior. Live calls also use preflight, syntax precheck,
the full behavioral verifier and a required verification marker.

Manual acquisition only:

```bash
node packs/tools/local-llm/evidence/sizing/acquire.mjs --self-check
node packs/tools/local-llm/evidence/sizing/acquire.mjs --acquire /absolute/new/private/durable/directory
```

Acquisition first writes an exclusive preregistration with hashes of this protocol,
the fixtures and runner, controls, profile, order/stopping policy, parent commit and
nonidentifying hardware/runtime metadata. No model is run by CI. Raw requests,
responses, stderr and lifecycle records remain in the private acquisition directory.
Only reviewed synthetic accepted source and compact counters/receipts are published.
Recording uses an injected fetch, which normally bypasses the runner's internal
advisory lock. This protocol explicitly acquires that same production endpoint lock
before the child command and holds it through verification. Its wait is recorded
separately; native CLI queue telemetry is not claimed. Receipt model-request time
excludes this manual wait and includes the small recording overhead.
The active template/weights are not attested: the local API exposes model metadata,
not loaded template bytes. The [November 17 runtime repair](https://github.com/sleepy-panda-srl/portulan/issues/571#issuecomment-6945668358)
is a maintainer report; this pilot records what its own requests/usage actually show.

Counting convention: physical code lines include interior blanks and exclude one
terminal newline. Selected replacement lines, insertion anchor lines, read-only
helper lines, returned complete code lines and source additions/removals are separate.
Source deltas use `git diff --no-index --numstat`. Requested line counts are estimates,
not an enforced output length; a length-truncated response has no complete code count.
CLI wall time includes all phases; receipt `time=` is model-request time. Unknown
measurements remain null, and reported reasoning/cached-input subsets are not added
to their parent totals.

Explicit provider refusals remain distinct from verifier-red outcomes; raw refusal
text stays private. Acquisition results belong in the separate `report.md` and
`capture.json`; this frozen protocol alone records no inference. A current maximum, general completion rate, causal
diagnosis, Gemma result and net parent savings remain undemonstrated by this protocol.
