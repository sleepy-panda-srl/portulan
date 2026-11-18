# Original-span thinking-control comparison

This frozen protocol addresses [#571](https://github.com/sleepy-panda-srl/portulan/issues/571),
acceptance clause 2. The original 19-line Python span was recovered from immutable
consumer Git history and reconciled against the exact historical response with
570 input / 1,876 output tokens. Its transformation inserts three physical lines
and changes two existing lines. Source and raw provider reasoning remain private;
the public record contains audit hashes and counters, never consumer code or paths.

The historical request log truncated its instruction. The current instruction is
explicitly reconstructed from the response's described edits and verified source;
it is not claimed to be the original prompt's exact bytes. Both new arms use that
same instruction and original span, under the current production runner/runtime.
The runner places the changed instruction at `Instruction: /no_think\n...` in its
user message; it does not put `/no_think` before the entire transport message.

Fixed order: **without-soft-switch**, then **with-soft-switch**. Both begin with
identical wrapper/19-line selection/suffix, read no extra context, and request
`qwen/qwen3.8-27b`, earned `code`, low effort, 4,096 combined output tokens,
`enable_thinking: false`, temperature 0.1, no seed and `--retries 0`. The only
actual request difference shall be `/no_think` plus a newline added to the
instruction. Normalize only that addition and compare complete request hashes.
Model identity/active template bytes are not independently attested by the API.

Before inference, freeze runner, acquisition, source, reconstructed instruction,
verifier, expected implementation and this protocol with SHA-256, plus controls,
arm order, profile, current commit and nonidentifying runtime metadata. The private
manual harness records buffered production transport responses and explicitly
holds the production endpoint lock through each entire command; lock wait is
separate from receipt request time. No new runner mode or routing change ships.

The offline verifier compiles the complete Python wrapper and exercises eleven
mocked behaviors: both valid selections, six invalid host statuses, two invalid
selections and the existing receipt-wait retry. It checks payload schema and values,
validation/order, guard-before-payload behavior, unchanged outside bytes, the
selected span's expected AST and a 120-column bound on changed lines. It runs no
external service. Baseline and eight incorrect candidates must fail, including
removal of the existing timeout guard, while the intended implementation passes.
These finite checks are not a security sandbox or a complete consumer integration.

Each arm receives one generation, with preflight, syntax precheck, full behavioral
verification and a required marker. At 180 seconds of whole-child wall time, send
SIGTERM, with SIGKILL fallback after five seconds, then leave the second arm not-run.
Unavailable execution also stops remaining acquisition. Completed refusal, length
exhaustion or verifier-red remains recorded without retry or profile changes.

Retain raw requests/responses, stdout/stderr, lifecycle and source privately. Publish
literal successful receipt lines, request/response/source hashes, outcomes, usage
subsets (zero distinct from unknown), selected/emitted/kept lines, rollback, lock
wait, whole-call wall time and receipt request time. Request time is neither pure
compute nor first-token latency. Record incomplete/censored outcomes honestly;
provider-side cancellation is unknown without acknowledgement.

Two fixed ordered observations do not isolate a causal soft-switch effect, prove a
historical repair effect or measure general reliability/capacity/savings. The
[maintainer's November 17 repair](https://github.com/sleepy-panda-srl/portulan/issues/571#issuecomment-6945668358)
changed the runtime/template since the original call. Results belong in a separate
report and capture, leaving this protocol unchanged after preregistration.
