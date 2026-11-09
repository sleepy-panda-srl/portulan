# Task 0036 — Cache-prefix stability baseline

**Lane:** full · **Opened:** 2026-11-09 · **Status:** approved for PR

**Criterion.** [#516](https://github.com/sleepy-panda-srl/portulan/issues/516),
row 13: a recipe scans loaded text and hook text against a committed golden;
inserting volatile content makes it red.

**Acceptance criteria.**

- When any scanned text changes, the recipe shall report drift against the golden.
- When a surface, import or composed pack is unavailable or malformed,
  the scanner shall refuse both checking and refreshing with exit 2.
- When an existing golden is malformed or duplicated, both modes shall refuse;
  when the golden is absent, checking shall refuse and explicit refresh may create it.
- When dates, hashes, IDs, absolute paths or labeled counts occur, the inventory
  shall identify their lexical forms without normalizing content bytes.
- When a new or removed surface changes coverage, the recipe shall report it.

**Plan.** Inventory actual always-tier files, all hook runners, compiled hook
commands, the policy and composed gate fragments from repository-pinned packs.
Hash complete content bytes and record suspicious literal forms. Compare with
the committed golden; refresh only through an explicit command. Add negative
fixtures, a real recipe drill, documentation, packaging exclusion and fragment.
Run all yielded recipes, strict plugin validation, seam scan, independent
pre-commit review and finish one labeled PR. Row 13 remains open.

**Session-open.** Independent `/root/checkpoint_516_open` returned
APPROVE-WITH-ADJUSTMENTS: include policy/pack explanation inputs, verify exact
coverage and missing/duplicate inputs, separate lexical detection from digest
drift, drill the actual recipe and document runtime limits. All are included.

**Limits.** Baseline change detection, not proof of runtime cache safety. Runtime
session values, arbitrary helpers and host-generated prefixes are not captured.
Existing suspicious literals are visible in the reviewed baseline, not erased.

**Pre-commit.** Independent `/root/checkpoint_516_precommit` returned APPROVE on
staged tree `149206a7645544aca2346641dbd089ae4379bc4e`. All 32 recipes were
exercised; after repairs, eight affected recipes passed again, including all
3,527 tests with none skipped, with earlier green results for the 24 unaffected
recipes. The review repaired runtime policy-selection divergence and malformed
hook/rule/golden handling, each reproduced by failing regressions before repair.
All 11 actual baseline surfaces were independently forced red. The real drill
fired on synthesized `3f7ba41`; missing, duplicate, external and lexical-bypass
controls held. Strict plugin validation and the staged seam scan passed, with
seven planted refusal controls. The runtime limits above remain undemonstrated.
Final record-fold review and the finishing command follow.
