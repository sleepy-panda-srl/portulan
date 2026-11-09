# Task — Put spend doctrine in its canonical context section

**Goal.** Resolve [#518](https://github.com/sleepy-panda-srl/portulan/issues/518): `context.md` carries row 13's spend doctrine once, and `sessions.md` points to it while keeping its lifecycle details.

**Acceptance criteria.**
- When reading `context.md`'s spend part, an agent shall find usage-record pricing with its numbers-only boundary, the computed restart/handoff rule, stable-prefix creation choices, declared and A/B-earned routing, and budgeted tool/recipe/hook output.
- When the session guide discusses restart or the general spend rules, it shall link to the canonical clauses instead of restating them; startup, lifetime and switch-specific guards shall remain.
- When existing anchors are opened, they shall still resolve, and the compiled `Every request pays…` source section shall remain byte-identical.
- When a present-tense mechanism claim is checked, it shall agree with current code; outstanding output rails and persona demonstrations shall remain distinguished from doctrine.

**Plan and verify.** Add the second part from accepted proposal 0038, relocate the restart policy and volatility guidance, preserve the local model's specific constraints, and replace repeated general rules with pointers. Use the existing documentation, compilation and context rails plus anchor/section preservation checks; add no per-paragraph test. Run all yielded recipes, strict plugin validation, the seam scan and independent pre-commit review before a separate labeled PR.

**Constraints.** Full lane. No runtime, kernel, manifest or plan-status change; no milestone closure.

**Session-open.** Fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE-WITH-ADJUSTMENTS. Folded: retain the spawner's effort and context-count declaration, identify the absence of context-count compilation, update both introductory scopes and general A/B pointers, and preserve the frozen reading section.

**Baseline.** The canonical `## What a change spends` heading was absent (`rg` exit 1). The edit preserved the compiled reading section byte for byte against the base.

**Pre-commit.** Fresh-context Sleepy Panda Codex, 2026-11-09: APPROVE-WITH-ADJUSTMENTS on tree `dd578b3d725ee789c90a339c70c60cbda7366d22`. Independently ran all 31 recipes, 3,440 tests, strict plugin validation and the seam scan with rejected planted control. All 18 original headings remain unique; the frozen section is 4,126 bytes, SHA256 `3c9953b91cfd9b79253e2a3887ace134ab3cc70027f9a19853f6a05a0e05bb84`. Folded: qualify advice after compaction and remove the trailing blank line. Runtime and remaining row-13 demonstrations are outside this change.

**Fold review.** Sleepy Panda Codex, 2026-11-09: APPROVE of tree `0c4221fd369d6388ef6584b2ede71aaa124e5c1e`, grading only its delta from `dd578b3d725ee789c90a339c70c60cbda7366d22` in the context that did not perform the fold. The delta contains the two requested adjustments and the preceding evidence record. The documentation recipe, whitespace check and both existing compaction tests passed; the frozen section remains byte-identical. The full-tree verification above is not repeated, and the remaining runtime rails and persona demonstrations remain undemonstrated by this change. This signed record is the sole post-grade metadata addition.
