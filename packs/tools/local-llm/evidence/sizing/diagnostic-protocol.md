# One diagnostic with explicit input/output fixtures

This is a parent-directed diagnostic acquisition after the completed six-cell pilot,
not its seventh cell or an automatic retry. The original helper-context shape
produced a verifier-red small artifact and a larger artifact rejected by parent
review for uncovered prototype-named accounts. Ordinary implementation stays with
the parent; this diagnostic studies the more explicit input contract.

Exactly one call repeats `context-small` at the same Qwen `code`/low/4,096 profile,
one generation and 180-second cancellation bound. Its prompt, target, verifier and
helper implementation are unchanged. The sole model-input addition is read-only
`examples.json`, containing the eight original input/output/error fixtures and the
explicit statement that items are numeric prices. No further local generation
follows this call, whatever its result.

The acquisition script and runner are byte-identical to the frozen original.
`diagnostic-fixtures.json` and these notes are mirrored as `fixtures.json` and
`README.md` in a new private source layout; hashes and controls are checked before
acquisition. Requests, responses and stderr remain private. Separate preregistration
and capture identify this diagnostic's corpus/notes hashes and actual counters.

Report its result separately, without pooling a seven-call success rate or claiming
the added examples caused any difference. Runtime state/order, stochastic output
and the absence of repetitions remain confounders. Template/weight attestation and
the instrumented endpoint-lock/queue limitations of the original protocol remain.
