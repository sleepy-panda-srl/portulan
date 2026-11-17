# Task 0064 — match the local-worker charter to earned routing

**Lane:** full · **Opened:** 2026-11-17 · **Status:** implemented; review pending

Addresses [#584](https://github.com/sleepy-panda-srl/portulan/issues/584). The persona
offered prose tasks despite disabled prose routing. No runner or routing changes.

**Acceptance criteria.**

- When a parent reads the persona description and charter, it shall find bounded
  verify-gated code transforms and tests/fixtures against explicit APIs on `code`
  at low effort as the earned work, without normal handoff/digest delegation.
- When prose candidates are described, they shall require an operator-selected
  `--model` without `--role`, remain unverified drafts requiring parent review,
  and leave shared prose disabled.
- When cost is described, omission shall apply to the worker's own context/tokens;
  separate calls shall retain the parent-request cost and batching qualification.
- When verification/rollback is described, it shall apply to `transform`, without
  implying that candidate `chat`/`summarize` replies run a verifier.

**Opening review.** Fresh session-open APPROVE-WITH-ADJUSTMENTS: scope verification
and rollback to transform, and distinguish separate parent requests from batched
invocations. Both are folded. The existing agent binding already points to this
charter and advertises bounded local edits; its compiled context fields stay valid.

**Verification.** Existing goldens, prompt limits, all yielded recipes with raw
outputs, both strict plugin validations, independent precommit and adversarial
reviews, a pushed finish checkpoint, green CI and the authorized merge are required.
This is a prose correction; no paragraph-mirroring test or new routing rail is added.
