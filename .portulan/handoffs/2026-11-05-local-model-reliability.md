# Local-model reliability — November 5, 2026

Issue: https://github.com/sleepy-panda-srl/portulan/issues/564

The source runner now bounds complete loopback chat responses to 15 minutes and
256 KiB, preserves explicit transports/remote/embedding behavior, rejects truncated
output before edits, and parses whitespace/inline-backtick fences correctly.
Operator-selected profiles and earned routing are unchanged. Source-owned wrappers
must explicitly adopt the exported transport; no installed host was updated here.

Fresh session-open `/root/qwen_reliability_checkpoint` approved the shared repair
with complete-body, boundary, compatibility and rollback adjustments. Live local
calls demonstrated a 78-second verified documentation edit and a 534-second complete
HTTP response ending in length exhaustion, safely rejected. Other completed drafts
exposed and regression-tested the two fence parsing bugs. These are reliability
demonstrations, not model-quality or savings measurements.

Run every yielded recipe before commit; verbose logs and per-recipe statuses are
in `/tmp/portulan-local-reliability/`. Fresh pre-commit and final results are recorded
with the PR. The regenerated synthetic capture changes only its source fingerprint.
No release publication, merge or installed Claude/Gemma update is authorized.

Initial fresh pre-commit returned REQUEST-CHANGES: environment-proxy routing,
shorter closing fences and the companion portfolio version bump were corrected.
Both new regressions were observed red before the code fixes. A second full
fresh pre-commit pass is required before commit; no self-certification.
