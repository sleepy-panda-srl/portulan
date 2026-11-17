# Task 0063 — consumer hybrid development adoption

**Lane:** full · **Opened:** 2026-11-17 · **Status:** implemented; review pending

Addresses [#566](https://github.com/sleepy-panda-srl/portulan/issues/566), including
its upgrade-verification comment. No roadmap row or versioning/resolution ownership
changes. The operator's phrase should discover the existing code-delegation path.

**Acceptance criteria.**

- When the skill is discovered, its description shall include “hybrid development,”
  and existing skill goldens and prompt-footprint limits shall remain green.
- When a consumer adopts the pack, the README shall list named edits or commands
  for composition, root-preserving compilation, status, earned code role/low effort,
  bounded input, prompt preparation and a verified transform.
- When a workspace has not composed the pack, the skill shall require proposing
  composition first unless an explicit operator instruction authorizes one-off
  runner use under the same rails, without implying persistent adoption.
- When an upgrade reports success, the guide shall require comparing executed
  runner/adapter bytes with an intended source snapshot and provide supported
  host-specific recovery while preserving installation state.

**Plan and opening review.** Fresh session-open APPROVE-WITH-ADJUSTMENTS folded:
preserve all resolution roots; bound the example to in-repository governance;
separate composition, host registration and CI; compare snapshot bytes rather than
HEAD alone; preserve scope/configuration/enabled state during recovery; keep Node,
server/model and verifier prerequisites explicit. Detailed steps move to the README
while the skill body shrinks. The one-off rule resolves the ambiguity recorded by
the operator's 2026-11-05 instruction in #566; it changes no workspace policy.
Independent review corrected three prose claims: doctor supplies per-pack paths,
skills-set uses write/check rather than a nonexistent help path, and managed
Claude installations follow their delivery owner rather than local removal.

**Verification.** Existing goldens, footprint checks, all yielded recipes, strict
plugin validation and independent adversarial review are required before the finish
checkpoint, green CI and authorized merge. No model-quality claim or new live model
run is part of this documentation change; #424 and #273 retain their scopes.
