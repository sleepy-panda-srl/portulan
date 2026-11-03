# Local-worker acquisition — 2026-11-03

The [capture](local-worker.json) and [register](local-worker.md) were acquired from merged
`9848be4ce19888e6b42c7de5428d960c540072fa`, a clean tree, with the runner SHA-256 recorded in
`source.runner`. No prompts, predicates, model choices, seeds or scores were tuned after outcomes.
The runner records machine specifications rather than a hostname. Local endpoint:
`http://127.0.0.1:1234/v1`; code `qwen/qwen3.8-27b`, prose `google/gemma-4-31b`, effort `low`.

The maintainer authorized Sonnet 5.5 with a $2–3 total budget, minimizing spend. The host command was
`claude --print --model claude-sonnet-5-5 --max-budget-usd 0.15`, using the installed absolute binary
path recorded in the capture. Fifteen invocations have a configured total ceiling of $2.25. Official
CLI status reported Claude Max sign-in and no API-key override. This is a configured ceiling, not an
independent invoice measurement; model identity is declared by the command, not observed server-side.
No further model calls are required by verification or routing.

## Rule frozen before outcomes

The seed was `portulan-m14-20261103`; `k = 5` for every task and arm. A task supports operational
routing only when all five local turns complete and pass, all five host turns genuinely complete
without authentication/configuration/budget failure, and local passes are at least host passes.
A positive 5/5 tie qualifies; a 0/5 tie does not. The shared prose role requires **both** codify and
handoff. No automatic resampling, model substitution or score edits. These are recorded rates at
`k = 5`, not a general quality claim. Runtime routing also requires the measured model and low effort;
a deliberately named model without a role remains an operator-selected candidate.

## Authentication failure and authorized recovery

The first acquisition completed all 15 local turns, then all 15 host attempts returned only
“OAuth session expired and could not be refreshed.” It is retained unchanged in
[acquisitions/2026-11-03-auth-failed/](acquisitions/2026-11-03-auth-failed/), with both file hashes and
original Git blob IDs in its [manifest](acquisitions/2026-11-03-auth-failed/manifest.json).
It supplies no host quality evidence. No inference billing conclusion is drawn from those failures.

After the maintainer confirmed a renewed sign-in and explicitly authorized a host-only retry, the
operator reconstructed the runner's normal journal with all 15 original local turn objects, including
all five codify failures. A no-model probe demonstrated 15 exact reuses, zero fresh local calls and
zero executed host calls before recovery. The original source, runner fingerprint, clean-tree state,
machine, endpoint, host command/version/model, screen and seed were verified unchanged. The canonical
failed pair was relocated only after authorization and after byte-identical backup and hashing.

The same CLI resumed the journal: all 15 local turns were reused, and only the 15 host turns ran.
All replacement host turns completed with exit 0 and substantive answers. The original `captured`
time is retained by the journal contract; the host replacement happened later on the same date.
The acquired canonical pair has not been edited. Its JSON SHA-256 is
`72501e02ce1284e96e19a29cfb60193552d3ac490e6e4c72391f6d68a42d01d2`.

## Acquisition fidelity

**Codex, independent review, 2026-11-03 — APPROVE.** Compared every complete local object and every
original header field with the failed acquisition; checked both archived hashes, byte counts and Git
blobs; independently regraded all 30 turns and reproduced the register with the unchanged source
verifier. All 15 replacement host turns completed with substantive output and no observed
authentication or budget error. Outcomes: code L5/H5, codify L0/H3, handoff L5/H5. The frozen rule
supports code and withholds shared prose. Actual billing and server-side model identity remain
undemonstrated. This acquisition verdict does not certify routing implementation or milestone closure.
